import { EventEmitter } from 'events'

import type { KakaoTalkClient } from './client'
import { LocoSession } from './protocol/session'
import type { LocoPacket } from './protocol/types'
import type {
  KakaoTalkListenerEventMap,
  KakaoTalkPushGenericEvent,
  KakaoTalkPushMemberEvent,
  KakaoTalkPushMessageEvent,
  KakaoTalkPushReadEvent,
} from './types'

const RECONNECT_BASE_DELAY = 1_000
const RECONNECT_MAX_DELAY = 30_000

type EventKey = keyof KakaoTalkListenerEventMap

function longToString(v: unknown): string {
  if (v && typeof v === 'object' && 'high' in v && 'low' in v) {
    const { high, low } = v as { high: number; low: number }
    return ((BigInt(high >>> 0) << 32n) | BigInt(low >>> 0)).toString()
  }
  return String(v ?? 0)
}

export class KakaoTalkListener {
  private client: KakaoTalkClient
  private running = false
  private session: LocoSession | null = null
  private emitter = new EventEmitter()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectAttempts = 0
  private userId: string | null = null

  constructor(client: KakaoTalkClient) {
    this.client = client
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
    if (this.session) {
      this.session.close()
      this.session = null
    }
  }

  on<K extends EventKey>(event: K, listener: (...args: KakaoTalkListenerEventMap[K]) => void): this {
    this.emitter.on(event, listener as (...args: any[]) => void)
    return this
  }

  off<K extends EventKey>(event: K, listener: (...args: KakaoTalkListenerEventMap[K]) => void): this {
    this.emitter.off(event, listener as (...args: any[]) => void)
    return this
  }

  once<K extends EventKey>(event: K, listener: (...args: KakaoTalkListenerEventMap[K]) => void): this {
    this.emitter.once(event, listener as (...args: any[]) => void)
    return this
  }

  private async connect(): Promise<void> {
    if (!this.running) return

    try {
      const { oauthToken, userId, deviceUuid, deviceType } = this.client.getCredentials()
      if (!this.running) return

      this.userId = userId
      const session = new LocoSession()

      session.onPush((packet) => this.handlePush(packet))
      session.onClose(() => {
        if (this.session !== session) return
        this.session = null
        if (this.running) {
          this.emitter.emit('disconnected')
          this.scheduleReconnect()
        }
      })

      await session.login(oauthToken, userId, deviceUuid, undefined, deviceType)

      if (!this.running) {
        session.close()
        return
      }

      this.reconnectAttempts = 0
      this.session = session
      this.emitter.emit('connected', { userId })
    } catch (error) {
      this.emitter.emit('error', error instanceof Error ? error : new Error(String(error)))
      if (this.running) {
        this.scheduleReconnect()
      }
    }
  }

  private handlePush(packet: LocoPacket): void {
    const { method, body } = packet

    switch (method) {
      case 'MSG': {
        const chatLog = body.chatLog as Record<string, unknown>
        const event: KakaoTalkPushMessageEvent = {
          type: 'MSG',
          chat_id: longToString(body.chatId),
          log_id: longToString(chatLog.logId),
          author_id: chatLog.authorId as number,
          message: chatLog.message as string,
          message_type: chatLog.type as number,
          sent_at: chatLog.sendAt as number,
        }
        this.emitter.emit('message', event)
        this.emitter.emit('kakaotalk_event', { type: method, ...body })
        break
      }

      case 'NEWMEM': {
        const chatLog = body.chatLog as Record<string, unknown>
        const event: KakaoTalkPushMemberEvent = {
          type: 'NEWMEM',
          chat_id: longToString(body.chatId),
          member: { user_id: chatLog.authorId as number },
        }
        this.emitter.emit('member_joined', event)
        this.emitter.emit('kakaotalk_event', { type: method, ...body })
        break
      }

      case 'DELMEM': {
        const chatLog = body.chatLog as Record<string, unknown>
        const event: KakaoTalkPushMemberEvent = {
          type: 'DELMEM',
          chat_id: longToString(body.chatId),
          member: { user_id: chatLog.authorId as number },
        }
        this.emitter.emit('member_left', event)
        this.emitter.emit('kakaotalk_event', { type: method, ...body })
        break
      }

      case 'DECUNREAD': {
        const event: KakaoTalkPushReadEvent = {
          type: 'DECUNREAD',
          chat_id: longToString(body.chatId),
          user_id: body.userId as number,
          watermark: longToString(body.watermark),
        }
        this.emitter.emit('read', event)
        this.emitter.emit('kakaotalk_event', { type: method, ...body })
        break
      }

      case 'CHANGESVR': {
        this.reconnectAttempts = 0
        const prev = this.session
        this.session = null
        prev?.close()
        this.connect()
        break
      }

      case 'KICKOUT': {
        this.emitter.emit('error', new Error('Session kicked — another device logged in'))
        this.running = false
        this.session?.close()
        this.session = null
        break
      }

      default: {
        const event: KakaoTalkPushGenericEvent = { type: method, ...body }
        this.emitter.emit('kakaotalk_event', event)
        break
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
