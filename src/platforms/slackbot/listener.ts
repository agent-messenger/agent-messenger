import { EventEmitter } from 'events'

import WebSocket from 'ws'

import type { SlackBotClient } from './client'
import { SlackBotError } from './types'
import type {
  SlackBotListenerEventMap,
  SlackSocketModeAck,
  SlackSocketModeEnvelope,
  SlackSocketModeEventsApiArgs,
  SlackSocketModeEventsApiEnvelope,
  SlackSocketModeGenericEvent,
  SlackSocketModeInteractiveArgs,
  SlackSocketModeInteractiveEnvelope,
  SlackSocketModeSlashCommandArgs,
  SlackSocketModeSlashCommandEnvelope,
} from './types'

const RECONNECT_BASE_DELAY = 1_000
const RECONNECT_MAX_DELAY = 30_000
const PING_INTERVAL = 30_000
const PONG_TIMEOUT = 10_000
const HELLO_TIMEOUT = 10_000

const FATAL_ERROR_CODES = new Set([
  'not_authed',
  'invalid_auth',
  'account_inactive',
  'user_removed_from_team',
  'team_disabled',
  'not_allowed_token_type',
  'missing_app_token',
  'invalid_app_token_type',
])

const TERMINAL_DISCONNECT_REASONS = new Set(['link_disabled'])

type EventKey = keyof SlackBotListenerEventMap

export interface SlackBotListenerOptions {
  appToken: string
  debugReconnects?: boolean
}

export class SlackBotListener {
  private client: SlackBotClient
  private appToken: string
  private debugReconnects: boolean
  private running = false
  private ws: WebSocket | null = null
  private emitter = new EventEmitter()
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private pongTimer: ReturnType<typeof setTimeout> | null = null
  private helloTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  private nextReconnectFloorMs = 0
  private generation = 0

  constructor(client: SlackBotClient, options: SlackBotListenerOptions) {
    if (!options?.appToken) {
      throw new SlackBotError('App-level token (xapp-) is required for Socket Mode', 'missing_app_token')
    }
    this.client = client
    this.appToken = options.appToken
    this.debugReconnects = options.debugReconnects ?? false
  }

  async start(): Promise<void> {
    if (this.running) return
    this.running = true
    this.reconnectAttempts = 0
    this.nextReconnectFloorMs = 0
    this.generation++
    await this.connect(this.generation)
  }

  stop(): void {
    this.running = false
    this.generation++
    this.clearTimers()
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  on<K extends EventKey>(event: K, listener: (...args: SlackBotListenerEventMap[K]) => void): this {
    this.emitter.on(event, listener as (...args: any[]) => void)
    return this
  }

  off<K extends EventKey>(event: K, listener: (...args: SlackBotListenerEventMap[K]) => void): this {
    this.emitter.off(event, listener as (...args: any[]) => void)
    return this
  }

  once<K extends EventKey>(event: K, listener: (...args: SlackBotListenerEventMap[K]) => void): this {
    this.emitter.once(event, listener as (...args: any[]) => void)
    return this
  }

  private isCurrent(generation: number, ws?: WebSocket): boolean {
    if (generation !== this.generation || !this.running) return false
    if (ws !== undefined && this.ws !== ws) return false
    return true
  }

  private async connect(generation: number): Promise<void> {
    if (!this.isCurrent(generation)) return

    try {
      const { url } = await this.client.appsConnectionsOpen(this.appToken)
      if (!this.isCurrent(generation)) return

      const wsUrl = this.debugReconnects ? `${url}${url.includes('?') ? '&' : '?'}debug_reconnects=true` : url
      const ws = new WebSocket(wsUrl)
      this.ws = ws

      ws.on('open', () => {
        if (!this.isCurrent(generation, ws)) {
          ws.close()
          return
        }
        this.startPing(generation, ws)
        this.armHelloTimeout(generation, ws)
      })

      ws.on('message', (raw) => {
        if (!this.isCurrent(generation, ws)) return
        try {
          const data = JSON.parse(raw.toString()) as SlackSocketModeEnvelope
          this.handleEnvelope(data, generation, ws)
        } catch {
          // Malformed frame; ignore — ping/pong handles liveness.
        }
      })

      ws.on('pong', () => {
        if (!this.isCurrent(generation, ws)) return
        this.clearPongTimer()
      })

      ws.on('close', () => {
        if (!this.isCurrent(generation, ws)) return
        this.clearTimers()
        this.ws = null
        if (this.running) {
          this.emitter.emit('disconnected')
          this.scheduleReconnect()
        }
      })

      ws.on('error', (err) => {
        if (!this.isCurrent(generation, ws)) return
        this.emitter.emit('error', err instanceof Error ? err : new Error(String(err)))
      })
    } catch (error) {
      if (!this.isCurrent(generation)) return
      const wrapped = error instanceof Error ? error : new Error(String(error))
      this.emitter.emit('error', wrapped)

      const code = (error as { code?: string })?.code
      if (code && FATAL_ERROR_CODES.has(code)) {
        this.running = false
        return
      }

      const retryAfter = (error as { retryAfter?: number })?.retryAfter
      if (typeof retryAfter === 'number' && retryAfter > 0) {
        this.nextReconnectFloorMs = retryAfter * 1000
      }

      if (this.running) {
        this.scheduleReconnect()
      }
    }
  }

  private handleEnvelope(envelope: SlackSocketModeEnvelope, generation: number, ws: WebSocket): void {
    if (!this.isCurrent(generation, ws)) return

    switch (envelope.type) {
      case 'hello': {
        const hello = envelope as { connection_info?: { app_id?: string }; num_connections?: number }
        this.clearHelloTimer()
        this.reconnectAttempts = 0
        this.emitter.emit('connected', {
          app_id: hello.connection_info?.app_id,
          num_connections: hello.num_connections,
        })
        return
      }

      case 'disconnect': {
        // Server-requested reconnect (warning, refresh_requested) — analogous to
        // Discord opcode 7, so reset backoff. `link_disabled` is terminal: the app
        // was disabled, reconnecting would loop forever.
        const reason = (envelope as { reason?: string }).reason
        if (reason && TERMINAL_DISCONNECT_REASONS.has(reason)) {
          this.emitter.emit(
            'error',
            new SlackBotError(`Slack closed the Socket Mode session: ${reason}`, 'disconnect_terminal'),
          )
          this.running = false
          ws.close()
          return
        }
        this.reconnectAttempts = 0
        ws.close()
        return
      }

      case 'events_api': {
        this.dispatchEventsApi(envelope as SlackSocketModeEventsApiEnvelope, generation, ws)
        return
      }

      case 'slash_commands': {
        this.dispatchSlashCommand(envelope as SlackSocketModeSlashCommandEnvelope, generation, ws)
        return
      }

      case 'interactive': {
        this.dispatchInteractive(envelope as SlackSocketModeInteractiveEnvelope, generation, ws)
        return
      }

      default: {
        this.emitter.emit('slack_event', envelope)
      }
    }
  }

  private dispatchEventsApi(envelope: SlackSocketModeEventsApiEnvelope, generation: number, ws: WebSocket): void {
    const event = envelope.payload?.event as SlackSocketModeGenericEvent | undefined
    if (!event?.type) return

    const ack = this.makeAck(envelope.envelope_id, generation, ws)
    const args: SlackSocketModeEventsApiArgs = {
      ack,
      envelope_id: envelope.envelope_id,
      body: envelope.payload,
      event,
      retry_num: envelope.retry_attempt,
      retry_reason: envelope.retry_reason,
      accepts_response_payload: envelope.accepts_response_payload,
    }

    this.emitter.emit(event.type, args)
    this.emitter.emit('slack_event', args)
  }

  private dispatchSlashCommand(envelope: SlackSocketModeSlashCommandEnvelope, generation: number, ws: WebSocket): void {
    const ack = this.makeAck(envelope.envelope_id, generation, ws)
    const args: SlackSocketModeSlashCommandArgs = {
      ack,
      envelope_id: envelope.envelope_id,
      body: envelope.payload,
      accepts_response_payload: envelope.accepts_response_payload,
    }
    this.emitter.emit('slash_commands', args)
  }

  private dispatchInteractive(envelope: SlackSocketModeInteractiveEnvelope, generation: number, ws: WebSocket): void {
    const ack = this.makeAck(envelope.envelope_id, generation, ws)
    const args: SlackSocketModeInteractiveArgs = {
      ack,
      envelope_id: envelope.envelope_id,
      body: envelope.payload,
      accepts_response_payload: envelope.accepts_response_payload,
    }
    this.emitter.emit('interactive', args)
  }

  private makeAck(envelopeId: string, generation: number, ws: WebSocket): SlackSocketModeAck {
    let acked = false
    return (responsePayload?: Record<string, unknown>) => {
      if (acked) return
      acked = true
      if (!this.isCurrent(generation, ws)) return
      if (ws.readyState !== WebSocket.OPEN) return
      const message =
        responsePayload === undefined
          ? { envelope_id: envelopeId }
          : { envelope_id: envelopeId, payload: responsePayload }
      ws.send(JSON.stringify(message))
    }
  }

  private armHelloTimeout(generation: number, ws: WebSocket): void {
    this.clearHelloTimer()
    this.helloTimer = setTimeout(() => {
      this.helloTimer = null
      if (!this.isCurrent(generation, ws)) return
      ws.close()
    }, HELLO_TIMEOUT)
  }

  private clearHelloTimer(): void {
    if (this.helloTimer) {
      clearTimeout(this.helloTimer)
      this.helloTimer = null
    }
  }

  private startPing(generation: number, ws: WebSocket): void {
    this.clearPingTimers()
    this.pingTimer = setInterval(() => {
      if (!this.isCurrent(generation, ws)) {
        this.clearPingTimers()
        return
      }
      if (ws.readyState !== WebSocket.OPEN) return

      ws.ping()

      this.clearPongTimer()
      this.pongTimer = setTimeout(() => {
        if (!this.isCurrent(generation, ws)) return
        ws.close()
      }, PONG_TIMEOUT)
    }, PING_INTERVAL)
  }

  private scheduleReconnect(): void {
    const exponential = Math.min(RECONNECT_BASE_DELAY * 2 ** this.reconnectAttempts, RECONNECT_MAX_DELAY)
    const delay = Math.max(exponential, this.nextReconnectFloorMs)
    this.nextReconnectFloorMs = 0
    this.reconnectAttempts++
    const generation = this.generation
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect(generation)
    }, delay)
  }

  private clearPongTimer(): void {
    if (this.pongTimer) {
      clearTimeout(this.pongTimer)
      this.pongTimer = null
    }
  }

  private clearPingTimers(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
    this.clearPongTimer()
  }

  private clearTimers(): void {
    this.clearPingTimers()
    this.clearHelloTimer()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }
}
