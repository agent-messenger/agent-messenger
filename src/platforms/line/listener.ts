import { EventEmitter } from 'events'

import type { LineClient } from './client'
import type { LineListenerEventMap, LinePushGenericEvent, LinePushMessageEvent } from './types'
import { LineError } from './types'

const RECONNECT_BASE_DELAY = 1_000
const RECONNECT_MAX_DELAY = 30_000

type EventKey = keyof LineListenerEventMap

export class LineListener {
  private lineClient: LineClient
  private running = false
  private emitter = new EventEmitter()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  private abortController: AbortController | null = null

  constructor(client: LineClient) {
    this.lineClient = client
    // Prevent EventEmitter from throwing on unhandled 'error' events
    this.emitter.on('error', () => {})
  }

  async start(): Promise<void> {
    if (this.running) return
    this.running = true
    this.reconnectAttempts = 0
    await this.connect()
  }

  stop(): void {
    this.running = false
    this.clearTimers()
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }

  on<K extends EventKey>(event: K, listener: (...args: LineListenerEventMap[K]) => void): this {
    this.emitter.on(event, listener as (...args: any[]) => void)
    return this
  }

  off<K extends EventKey>(event: K, listener: (...args: LineListenerEventMap[K]) => void): this {
    this.emitter.off(event, listener as (...args: any[]) => void)
    return this
  }

  once<K extends EventKey>(event: K, listener: (...args: LineListenerEventMap[K]) => void): this {
    this.emitter.once(event, listener as (...args: any[]) => void)
    return this
  }

  private async connect(): Promise<void> {
    if (!this.running) return

    try {
      await this.lineClient.login()
      if (!this.running) return

      const internalClient = (this.lineClient as any).client
      if (!internalClient) {
        throw new LineError('not_connected', 'Failed to get internal LINE client')
      }

      this.abortController = new AbortController()

      internalClient.on('message', (msg: any) => {
        try {
          const event: LinePushMessageEvent = {
            type: 'message',
            chat_id: msg.isMyMessage ? msg.to.id : msg.from.id,
            message_id: String(msg.raw.id),
            author_id: msg.from.id,
            text: msg.text ?? null,
            content_type: String(msg.raw.contentType ?? 'NONE'),
            sent_at: new Date(Number(msg.raw.createdTime)).toISOString(),
          }
          this.emitter.emit('message', event)
          this.emitter.emit('line_event', { ...event })
        } catch {}
      })

      internalClient.on('event', (op: any) => {
        const event: LinePushGenericEvent = {
          type: String(op.type ?? 'unknown'),
          ...(op.revision !== undefined && { revision: String(op.revision) }),
          ...(op.createdTime !== undefined && {
            created_time: new Date(Number(op.createdTime)).toISOString(),
          }),
        }
        this.emitter.emit('line_event', event)
      })

      internalClient.listen({ signal: this.abortController.signal })?.catch((error: unknown) => {
        if (!this.running) return
        const err = error instanceof Error ? error : new Error(String(error))
        if (err.name === 'AbortError') return
        this.emitter.emit('error', err)
        this.emitter.emit('disconnected')
        this.scheduleReconnect()
      })

      this.reconnectAttempts = 0

      const profile = await internalClient.base.talk.getProfile()
      this.emitter.emit('connected', { account_id: profile.mid })
    } catch (error) {
      this.emitter.emit('error', error instanceof Error ? error : new Error(String(error)))
      if (this.running) {
        this.scheduleReconnect()
      }
    }
  }

  private scheduleReconnect(): void {
    this.clearTimers()
    const delay = Math.min(RECONNECT_BASE_DELAY * 2 ** this.reconnectAttempts, RECONNECT_MAX_DELAY)
    this.reconnectAttempts++
    this.reconnectTimer = setTimeout(() => this.connect(), delay)
  }

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }
}
