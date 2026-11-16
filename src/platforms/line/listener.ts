import { EventEmitter } from 'events'

import { getReplyToMessageId } from './client'
import type { LineClient, LineRawMessage } from './client'
import type { LineListenerEventMap, LinePushGenericEvent, LinePushMessageEvent } from './types'

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

      const profile = await this.lineClient.getProfile()
      if (!this.running) return
      this.abortController = new AbortController()
      this.reconnectAttempts = 0
      this.emitter.emit('connected', { account_id: profile.mid })

      void this.pump(this.abortController.signal)
    } catch (error) {
      this.emitter.emit('error', error instanceof Error ? error : new Error(String(error)))
      if (this.running) {
        this.scheduleReconnect()
      }
    }
  }

  private async pump(signal: AbortSignal): Promise<void> {
    try {
      for await (const event of this.lineClient.streamEvents(signal)) {
        if (event.kind === 'message') {
          this.emitMessage(event.message)
        } else {
          this.emitOperation(event.op)
        }
      }
    } catch (error) {
      if (!this.running || signal.aborted) return
      const err = error instanceof Error ? error : new Error(String(error))
      if (err.name === 'AbortError') return
      this.emitter.emit('error', err)
      this.emitter.emit('disconnected')
      this.scheduleReconnect()
    }
  }

  private emitMessage(msg: LineRawMessage): void {
    try {
      const toType = msg.raw.toType
      const isGroupOrRoom = toType === 'GROUP' || toType === 'ROOM' || toType === 0 || toType === 1
      const chatId = String(isGroupOrRoom ? msg.to.id : msg.isMyMessage ? msg.to.id : msg.from.id)

      const contentType = String(msg.raw.contentType ?? 'NONE')
      const replyTo = getReplyToMessageId(msg.raw)
      const event: LinePushMessageEvent = {
        type: 'message',
        chat_id: chatId,
        message_id: String(msg.raw.id),
        author_id: String(msg.from.id),
        text: getMessageText(msg.text, msg.raw, contentType),
        ...(msg.decryption_error && { decryption_error: msg.decryption_error }),
        content_type: contentType,
        content_metadata: normalizeContentMetadata(msg.raw.contentMetadata),
        ...(replyTo && { reply_to_message_id: replyTo }),
        sent_at: new Date(Number(msg.raw.createdTime)).toISOString(),
      }
      this.emitter.emit('message', event)
      this.emitter.emit('line_event', { ...event })
    } catch (error) {
      this.emitter.emit('error', error instanceof Error ? error : new Error(String(error)))
    }
  }

  private emitOperation(op: any): void {
    const event: LinePushGenericEvent = {
      type: String(op.type ?? 'unknown'),
      ...(op.revision !== undefined && { revision: String(op.revision) }),
      ...(op.createdTime !== undefined && {
        created_time: new Date(Number(op.createdTime)).toISOString(),
      }),
    }
    this.emitter.emit('line_event', event)
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

function normalizeContentMetadata(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {}
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value !== null && value !== undefined) result[key] = String(value)
  }
  return result
}

function getMessageText(text: unknown, raw: unknown, contentType: string): string | null {
  const direct = normalizeText(text)
  if (direct !== null) return direct
  if (!isTextContentType(contentType)) return null

  if (!raw || typeof raw !== 'object') return null
  return normalizeText((raw as Record<string, unknown>).text)
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  return value.length > 0 ? value : null
}

function isTextContentType(contentType: string): boolean {
  return contentType === 'NONE' || contentType === '0'
}
