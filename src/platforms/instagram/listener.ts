import { EventEmitter } from 'events'

import type { InstagramClient } from './client'
import type { InstagramMessageSummary } from './types'

export interface InstagramListenerEventMap {
  message: [InstagramMessageSummary]
  error: [Error]
  connected: [{ userId: string }]
  disconnected: []
}

type EventKey = keyof InstagramListenerEventMap

const DEFAULT_POLL_INTERVAL = 5_000

export class InstagramListener {
  private client: InstagramClient
  private running = false
  private emitter = new EventEmitter()
  private pollInterval: number
  private pollTimer: ReturnType<typeof setTimeout> | null = null
  private seenMessageIds = new Set<string>()
  private initialized = false

  constructor(client: InstagramClient, options?: { pollInterval?: number }) {
    this.client = client
    this.pollInterval = options?.pollInterval ?? DEFAULT_POLL_INTERVAL
  }

  async start(): Promise<void> {
    if (this.running) return
    this.running = true
    this.initialized = false
    this.seenMessageIds.clear()

    try {
      const chats = await this.client.listChats(20)
      for (const chat of chats) {
        if (chat.last_message?.id) {
          this.seenMessageIds.add(chat.last_message.id)
        }
      }
      this.initialized = true
      this.emitter.emit('connected', { userId: this.client.getUserId() ?? '' })
      this.schedulePoll()
    } catch (error) {
      this.emitter.emit('error', error instanceof Error ? error : new Error(String(error)))
      if (this.running) this.schedulePoll()
    }
  }

  stop(): void {
    this.running = false
    if (this.pollTimer) {
      clearTimeout(this.pollTimer)
      this.pollTimer = null
    }
    this.emitter.emit('disconnected')
  }

  on<K extends EventKey>(event: K, listener: (...args: InstagramListenerEventMap[K]) => void): this {
    this.emitter.on(event, listener as (...args: unknown[]) => void)
    return this
  }

  off<K extends EventKey>(event: K, listener: (...args: InstagramListenerEventMap[K]) => void): this {
    this.emitter.off(event, listener as (...args: unknown[]) => void)
    return this
  }

  once<K extends EventKey>(event: K, listener: (...args: InstagramListenerEventMap[K]) => void): this {
    this.emitter.once(event, listener as (...args: unknown[]) => void)
    return this
  }

  private schedulePoll(): void {
    if (!this.running) return
    this.pollTimer = setTimeout(() => this.poll(), this.pollInterval)
  }

  private async poll(): Promise<void> {
    if (!this.running) return

    try {
      const chats = await this.client.listChats(20)

      for (const chat of chats) {
        if (!chat.last_message) continue
        const msgId = chat.last_message.id
        if (!msgId || this.seenMessageIds.has(msgId)) continue

        this.seenMessageIds.add(msgId)
        if (this.initialized) {
          this.emitter.emit('message', chat.last_message)
        }
      }

      this.initialized = true
    } catch (error) {
      this.emitter.emit('error', error instanceof Error ? error : new Error(String(error)))
    }

    this.schedulePoll()
  }
}
