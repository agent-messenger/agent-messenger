import { Long } from 'bson'

import { LocoSession } from './protocol/session'
import type { ChatListResponse, LoginListResponse } from './protocol/types'
import type { KakaoChat, KakaoMessage, KakaoSendResult } from './types'

export class KakaoTalkError extends Error {
  code: string

  constructor(message: string, code: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'KakaoTalkError'
    this.code = code
  }
}

type ChatData = Record<string, unknown>

interface SessionState {
  session: LocoSession
  loginResult: LoginListResponse
}

function bsonToLong(v: unknown): Long | undefined {
  if (v && typeof v === 'object' && 'high' in v && 'low' in v) {
    const { high, low } = v as { high: number; low: number }
    return new Long(low, high)
  }
  return undefined
}

function longToString(v: unknown): string {
  if (v && typeof v === 'object' && 'high' in v && 'low' in v) {
    const { high, low } = v as { high: number; low: number }
    return ((BigInt(high >>> 0) << 32n) | BigInt(low >>> 0)).toString()
  }
  return String(v ?? 0)
}

function parseLong(s: string): Long {
  const big = BigInt(s)
  const low = Number(big & 0xffffffffn)
  const high = Number((big >> 32n) & 0xffffffffn)
  return new Long(low, high)
}

function formatChat(chat: ChatData): KakaoChat {
  const memberNames = (chat.k ?? []) as string[]
  const lastLog = chat.l as Record<string, unknown> | null
  const displayName = memberNames.join(', ') || null

  return {
    chat_id: String(chat.c),
    type: chat.t as number,
    display_name: displayName,
    active_members: chat.a as number,
    unread_count: chat.n as number,
    last_message: lastLog
      ? {
          author_id: lastLog.authorId as number,
          message: lastLog.message as string,
          sent_at: lastLog.sendAt as number,
        }
      : null,
  }
}

function matchesSearch(chat: ChatData, term: string): boolean {
  const names = (chat.k ?? []) as string[]
  const lower = term.toLowerCase()
  return names.some((n) => n.toLowerCase().includes(lower))
}

function collectChats(chatDatas: ChatData[], into: ChatData[], seen: Set<string>): void {
  for (const chat of chatDatas) {
    const id = String(chat.c)
    if (!seen.has(id)) {
      seen.add(id)
      into.push(chat)
    }
  }
}

function wrapError(error: unknown, code: string): KakaoTalkError {
  if (error instanceof KakaoTalkError) return error
  const message = error instanceof Error ? error.message : String(error)
  return new KakaoTalkError(message, code, { cause: error })
}

const MAX_PAGES = 50

export class KakaoTalkClient {
  private oauthToken: string | null = null
  private userId: string | null = null
  private deviceUuid: string | null = null
  private state: SessionState | null = null
  private initPromise: Promise<SessionState> | null = null
  private closed = false

  async login(
    credentials?: { oauthToken: string; userId: string; deviceUuid?: string },
    accountId?: string,
  ): Promise<this> {
    if (credentials) {
      if (!credentials.oauthToken) throw new KakaoTalkError('OAuth token is required', 'missing_token')
      if (!credentials.userId) throw new KakaoTalkError('User ID is required', 'missing_user_id')
      this.oauthToken = credentials.oauthToken
      this.userId = credentials.userId
      this.deviceUuid = credentials.deviceUuid ?? `agent-messenger-${credentials.userId}`
      return this
    }
    const { ensureKakaoAuth } = await import('./ensure-auth')
    const account = await ensureKakaoAuth(accountId)
    return this.login({ oauthToken: account.oauth_token, userId: account.user_id, deviceUuid: account.device_uuid })
  }

  getCredentials(): { oauthToken: string; userId: string; deviceUuid: string } {
    this.ensureAuth()
    return {
      oauthToken: this.oauthToken!,
      userId: this.userId!,
      deviceUuid: this.deviceUuid!,
    }
  }

  private ensureAuth(): void {
    if (this.oauthToken === null) {
      throw new KakaoTalkError('Not authenticated. Call .login() first.', 'not_authenticated')
    }
  }

  private async ensureSession(): Promise<SessionState> {
    this.ensureAuth()
    if (this.closed) throw new KakaoTalkError('Client is closed', 'client_closed')
    if (this.state) return this.state

    // Guard against concurrent init — reuse the in-flight promise
    if (!this.initPromise) {
      this.initPromise = this.connect()
    }

    try {
      const state = await this.initPromise
      // close() may have been called while we were awaiting connect()
      if (this.closed) {
        state.session.close()
        throw new KakaoTalkError('Client is closed', 'client_closed')
      }
      this.state = state
      return state
    } catch (error) {
      // Reset so next call retries cleanly; connect() already wraps in KakaoTalkError
      this.state = null
      this.initPromise = null
      throw error
    }
  }

  private async executeWithReconnect<T>(operation: (state: SessionState) => Promise<T>): Promise<T> {
    let state = await this.ensureSession()
    try {
      return await operation(state)
    } catch (error) {
      // Only retry when the session we started with is dead (desktop app eviction,
      // network drop, etc.). Comparing session identity (not just null) handles the case
      // where a concurrent call already reconnected and replaced this.state.
      if (this.state?.session === state.session) throw error

      try { state.session.close() } catch {}
      this.initPromise = null
      state = await this.ensureSession()
      return operation(state)
    }
  }

  private async connect(): Promise<SessionState> {
    const session = new LocoSession()
    try {
      const loginResult = await session.login(this.oauthToken!, this.userId!, this.deviceUuid!)

      session.onClose(() => {
        if (this.state?.session === session) {
          this.state = null
          this.initPromise = null
        }
      })

      return { session, loginResult }
    } catch (error) {
      session.close()
      throw new KakaoTalkError(
        error instanceof Error ? error.message : String(error),
        'login_failed',
        { cause: error },
      )
    }
  }

  async getChats(options?: { all?: boolean; search?: string }): Promise<KakaoChat[]> {
    return this.executeWithReconnect(async ({ session, loginResult }) => {
      try {
        const allChats: ChatData[] = []
        const seenChatIds = new Set<string>()

        collectChats((loginResult.chatDatas ?? []) as ChatData[], allChats, seenChatIds)

        if (options?.all || options?.search) {
          let cursor: ChatListResponse = loginResult
          let pages = 0

          while (!cursor.eof && pages < MAX_PAGES) {
            const lastTokenId = bsonToLong(cursor.lastTokenId)
            const lastChatId = bsonToLong(cursor.lastChatId)

            const response = await session.getChatList(lastTokenId, lastChatId)
            const body = response.body as unknown as ChatListResponse
            const chatDatas = (body.chatDatas ?? []) as ChatData[]

            if (chatDatas.length === 0) break

            collectChats(chatDatas, allChats, seenChatIds)
            cursor = body
            pages++
          }
        }

        allChats.sort((a, b) => ((b.o as number) ?? 0) - ((a.o as number) ?? 0))

        let results = allChats
        if (options?.search) {
          results = allChats.filter((c) => matchesSearch(c, options.search!))
        }

        return results.map(formatChat)
      } catch (error) {
        throw wrapError(error, 'get_chats_failed')
      }
    })
  }

  async getMessages(chatId: string, options?: { count?: number; from?: string }): Promise<KakaoMessage[]> {
    return this.executeWithReconnect(async ({ session }) => {
      try {
        const maxLogId = undefined

        const count = options?.count ?? 20
        const cursor = options?.from ? parseLong(options.from) : undefined

        const cid = parseLong(chatId)
        const startCursor = cursor ?? Long.fromNumber(0)
        const allMessages: Array<Record<string, unknown>> = []
        const seenLogIds = new Set<string>()
        let cur = startCursor

        for (;;) {
          const response = await session.syncMessages(cid, 80, cur, maxLogId)
          const batch = (response.body.chatLogs ?? []) as Array<Record<string, unknown>>
          if (batch.length === 0) break

          for (const log of batch) {
            const lid = longToString(log.logId)
            if (!seenLogIds.has(lid)) {
              seenLogIds.add(lid)
              allMessages.push(log)
            }
          }

          const maxLog = batch.reduce<Long | null>((max, l) => {
            const lid = l.logId as { high: number; low: number }
            const long = new Long(lid.low, lid.high)
            return !max || long.greaterThan(max) ? long : max
          }, null)

          if (!maxLog || maxLog.equals(cur) || response.body.isOK) break
          cur = maxLog
        }

        allMessages.sort((a, b) => (a.sendAt as number) - (b.sendAt as number))

        return allMessages.slice(-count).map((log) => ({
          log_id: longToString(log.logId),
          type: log.type as number,
          author_id: log.authorId as number,
          message: log.message as string,
          sent_at: log.sendAt as number,
        }))
      } catch (error) {
        throw wrapError(error, 'get_messages_failed')
      }
    })
  }

  async sendMessage(chatId: string, text: string): Promise<KakaoSendResult> {
    return this.executeWithReconnect(async ({ session }) => {
      try {
        const response = await session.sendMessage(parseLong(chatId), text)

        return {
          success: response.statusCode === 0,
          status_code: response.statusCode,
          chat_id: chatId,
          log_id: longToString(response.body.logId),
          sent_at: response.body.sendAt as number,
        }
      } catch (error) {
        throw wrapError(error, 'send_message_failed')
      }
    })
  }

  close(): void {
    this.closed = true
    if (this.state) {
      this.state.session.close()
    } else if (this.initPromise) {
      this.initPromise.then((s) => s.session.close()).catch(() => {})
    }
    this.state = null
    this.initPromise = null
  }
}
