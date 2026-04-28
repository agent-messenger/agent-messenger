import { EventEmitter } from 'events'

import WebSocket from 'ws'

import type { DiscordBotClient } from './client'
import type { DiscordBotListenerEventMap, DiscordGatewayGenericEvent } from './types'
import { DiscordGatewayOpcode, DiscordIntent } from './types'

const GATEWAY_URL = 'wss://gateway.discord.gg/?v=10&encoding=json'
const RECONNECT_BASE_DELAY = 1_000
const RECONNECT_MAX_DELAY = 30_000
const NON_RECOVERABLE_CLOSE_CODES = [4004, 4010, 4011, 4012, 4013, 4014]
const SESSION_RESET_CLOSE_CODES = [4007, 4009]

const DEFAULT_INTENTS =
  DiscordIntent.Guilds |
  DiscordIntent.GuildMessages |
  DiscordIntent.GuildMessageReactions |
  DiscordIntent.GuildMessageTyping |
  DiscordIntent.DirectMessages |
  DiscordIntent.DirectMessageReactions |
  DiscordIntent.DirectMessageTyping

type EventKey = keyof DiscordBotListenerEventMap

export class DiscordBotListener {
  private client: DiscordBotClient
  private intents: number
  private running = false
  private ws: WebSocket | null = null
  private emitter = new EventEmitter()
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private heartbeatAckReceived = true
  private heartbeatJitterTimer: ReturnType<typeof setTimeout> | null = null
  private invalidSessionTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  private sequence: number | null = null
  private sessionId: string | null = null
  private resumeGatewayUrl: string | null = null
  private token: string | null = null
  private cachedUser: { id: string; username: string } | null = null

  constructor(client: DiscordBotClient, options?: { intents?: number }) {
    this.client = client
    this.intents = options?.intents ?? DEFAULT_INTENTS
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
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.sequence = null
    this.sessionId = null
    this.resumeGatewayUrl = null
    this.token = null
    this.cachedUser = null
  }

  on<K extends EventKey>(event: K, listener: (...args: DiscordBotListenerEventMap[K]) => void): this {
    this.emitter.on(event, listener as (...args: any[]) => void)
    return this
  }

  off<K extends EventKey>(event: K, listener: (...args: DiscordBotListenerEventMap[K]) => void): this {
    this.emitter.off(event, listener as (...args: any[]) => void)
    return this
  }

  once<K extends EventKey>(event: K, listener: (...args: DiscordBotListenerEventMap[K]) => void): this {
    this.emitter.once(event, listener as (...args: any[]) => void)
    return this
  }

  private async connect(): Promise<void> {
    if (!this.running) return

    try {
      const { token } = await this.client.gatewayConnect()
      if (!this.running) return

      this.token = token

      const url = this.resumeGatewayUrl ?? GATEWAY_URL
      const ws = new WebSocket(url)
      this.ws = ws

      ws.on('open', () => {
        if (!this.running) {
          ws.close()
          return
        }
        this.reconnectAttempts = 0
      })

      ws.on('message', (raw) => {
        try {
          const data = JSON.parse(raw.toString())
          this.handleMessage(data)
        } catch {
          // malformed gateway frame; ignore and let heartbeat handle liveness
        }
      })

      ws.on('close', (code) => {
        this.clearTimers()
        if (this.ws === ws) this.ws = null
        if (NON_RECOVERABLE_CLOSE_CODES.includes(code)) {
          this.emitter.emit('error', new Error(`Discord gateway closed with non-recoverable code ${code}`))
          this.running = false
          return
        }
        if (SESSION_RESET_CLOSE_CODES.includes(code)) {
          this.sequence = null
          this.sessionId = null
          this.resumeGatewayUrl = null
        }
        if (this.running) {
          this.emitter.emit('disconnected')
          this.scheduleReconnect()
        }
      })

      ws.on('error', (err) => {
        this.emitter.emit('error', err instanceof Error ? err : new Error(String(err)))
      })
    } catch (error) {
      this.emitter.emit('error', error instanceof Error ? error : new Error(String(error)))
      if (this.running) {
        this.scheduleReconnect()
      }
    }
  }

  private handleMessage(data: { op: number; d: any; s?: number; t?: string }): void {
    const { op, d, s, t } = data

    switch (op) {
      case DiscordGatewayOpcode.Hello:
        this.startHeartbeat(d.heartbeat_interval)
        if (this.sessionId) {
          this.sendResume()
        } else {
          this.sendIdentify()
        }
        break

      case DiscordGatewayOpcode.HeartbeatACK:
        this.heartbeatAckReceived = true
        break

      case DiscordGatewayOpcode.Dispatch:
        if (typeof s === 'number') this.sequence = s
        if (t) this.handleDispatch(t, d)
        break

      case DiscordGatewayOpcode.Reconnect:
        this.reconnectAttempts = 0
        this.ws?.close()
        break

      case DiscordGatewayOpcode.InvalidSession: {
        const currentWs = this.ws
        if (d === true) {
          const delay = 1000 + Math.random() * 4000
          this.invalidSessionTimer = setTimeout(() => {
            this.invalidSessionTimer = null
            if (currentWs && currentWs === this.ws) currentWs.close()
          }, delay)
        } else {
          this.sequence = null
          this.sessionId = null
          this.resumeGatewayUrl = null
          currentWs?.close()
        }
        break
      }

      case DiscordGatewayOpcode.Heartbeat:
        this.sendHeartbeat()
        break
    }
  }

  private handleDispatch(t: string, d: any): void {
    if (t === 'READY') {
      this.sessionId = d.session_id
      this.resumeGatewayUrl = d.resume_gateway_url
      this.cachedUser = d.user
      this.emitter.emit('connected', { user: d.user, sessionId: d.session_id })
      return
    }

    if (t === 'RESUMED') {
      this.emitter.emit('connected', { user: this.cachedUser!, sessionId: this.sessionId! })
      return
    }

    const eventType = t.toLowerCase()
    const event: DiscordGatewayGenericEvent = { ...d, type: t }
    this.emitter.emit(eventType, event)
    this.emitter.emit('discord_event', event)
  }

  private sendIdentify(): void {
    this.ws?.send(
      JSON.stringify({
        op: DiscordGatewayOpcode.Identify,
        d: {
          token: this.token,
          intents: this.intents,
          properties: {
            os: 'linux',
            browser: 'agent-messenger',
            device: 'agent-messenger',
          },
        },
      }),
    )
  }

  private sendResume(): void {
    this.ws?.send(
      JSON.stringify({
        op: DiscordGatewayOpcode.Resume,
        d: {
          token: this.token,
          session_id: this.sessionId,
          seq: this.sequence,
        },
      }),
    )
  }

  private sendHeartbeat(): void {
    this.ws?.send(JSON.stringify({ op: DiscordGatewayOpcode.Heartbeat, d: this.sequence }))
  }

  private startHeartbeat(interval: number): void {
    this.clearHeartbeatTimers()
    this.heartbeatAckReceived = true

    this.heartbeatJitterTimer = setTimeout(() => {
      this.heartbeatJitterTimer = null
      this.heartbeatAckReceived = false
      this.sendHeartbeat()

      this.heartbeatTimer = setInterval(() => {
        if (!this.heartbeatAckReceived) {
          this.ws?.close()
          return
        }
        this.heartbeatAckReceived = false
        this.sendHeartbeat()
      }, interval)
    }, Math.random() * interval)
  }

  private scheduleReconnect(): void {
    const delay = Math.min(RECONNECT_BASE_DELAY * 2 ** this.reconnectAttempts, RECONNECT_MAX_DELAY)
    this.reconnectAttempts++
    this.reconnectTimer = setTimeout(() => this.connect(), delay)
  }

  private clearHeartbeatTimers(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    if (this.heartbeatJitterTimer) {
      clearTimeout(this.heartbeatJitterTimer)
      this.heartbeatJitterTimer = null
    }
  }

  private clearTimers(): void {
    this.clearHeartbeatTimers()
    if (this.invalidSessionTimer) {
      clearTimeout(this.invalidSessionTimer)
      this.invalidSessionTimer = null
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }
}
