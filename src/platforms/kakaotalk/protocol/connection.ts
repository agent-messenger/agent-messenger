import { type Socket, connect as netConnect } from 'node:net'
import { connect as tlsConnect } from 'node:tls'

import { LocoCrypto } from './crypto'
import { decodePacket, encodePacket } from './packet'
import type { LocoPacket } from './types'

export class LocoConnection {
  private socket: Socket | null = null
  private crypto: LocoCrypto | null = null
  private buffer = Buffer.alloc(0)
  private decryptedBuffer = Buffer.alloc(0)
  private packetIdCounter = 0
  private pendingResolvers = new Map<number, (packet: LocoPacket) => void>()
  private pushHandler: ((packet: LocoPacket) => void) | null = null

  async connectTls(host: string, port: number): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const socket = tlsConnect({ host, port, rejectUnauthorized: true }, () => resolve())
      this.socket = socket
      socket.on('error', reject)
      socket.on('data', (data: Buffer) => this.onData(data))
      socket.on('close', () => this.onClose())
    })
  }

  async connectSecure(host: string, port: number): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const socket = netConnect({ host, port }, () => resolve())
      this.socket = socket
      socket.on('error', reject)
      socket.on('data', (data: Buffer) => this.onData(data))
      socket.on('close', () => this.onClose())
    })
    await this.performHandshake()
  }

  private async performHandshake(): Promise<void> {
    this.crypto = new LocoCrypto()
    const handshakePacket = this.crypto.buildHandshakePacket()
    await this.write(handshakePacket)
  }

  async sendPacket(method: string, body: Record<string, unknown> = {}): Promise<LocoPacket> {
    const packetId = ++this.packetIdCounter
    const packet: LocoPacket = {
      packetId,
      statusCode: 0,
      method,
      bodyType: 0,
      body,
    }

    const raw = encodePacket(packet)
    const data = this.crypto ? this.crypto.encrypt(raw) : raw
    await this.write(data)

    return new Promise((resolve) => {
      this.pendingResolvers.set(packetId, resolve)
    })
  }

  onPush(handler: (packet: LocoPacket) => void): void {
    this.pushHandler = handler
  }

  close(): void {
    this.socket?.destroy()
    this.socket = null
  }

  private write(data: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not connected'))
        return
      }
      this.socket.write(data, (err) => (err ? reject(err) : resolve()))
    })
  }

  private onData(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk])
    this.processBuffer()
  }

  private processBuffer(): void {
    while (this.buffer.length > 0) {
      if (this.crypto) {
        // Decrypt each frame and accumulate into decryptedBuffer.
        // A single LOCO packet may span multiple encrypted frames.
        if (this.buffer.length < 4) return
        const frameSize = this.buffer.readUInt32LE(0)
        if (this.buffer.length < 4 + frameSize) return

        const encryptedBody = this.buffer.subarray(4, 4 + frameSize)
        this.buffer = this.buffer.subarray(4 + frameSize)

        let decrypted: Buffer
        try {
          decrypted = this.crypto.decrypt(encryptedBody)
        } catch {
          return
        }

        this.decryptedBuffer = Buffer.concat([this.decryptedBuffer, decrypted])

        const result = decodePacket(this.decryptedBuffer)
        if (result) {
          this.decryptedBuffer = this.decryptedBuffer.subarray(result.bytesConsumed)
          this.dispatchPacket(result.packet)
        }
      } else {
        const result = decodePacket(this.buffer)
        if (!result) return
        this.buffer = this.buffer.subarray(result.bytesConsumed)
        this.dispatchPacket(result.packet)
      }
    }
  }

  private dispatchPacket(packet: LocoPacket): void {
    const resolver = this.pendingResolvers.get(packet.packetId)
    if (resolver) {
      this.pendingResolvers.delete(packet.packetId)
      resolver(packet)
    } else {
      this.pushHandler?.(packet)
    }
  }

  private onClose(): void {
    for (const resolver of this.pendingResolvers.values()) {
      resolver({ packetId: 0, statusCode: -1, method: '', bodyType: 0, body: { error: 'connection closed' } })
    }
    this.pendingResolvers.clear()
  }
}
