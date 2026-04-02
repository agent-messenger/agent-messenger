import { Long } from 'bson'
import { existsSync } from 'node:fs'
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { warn } from '@/shared/utils/stderr'

import { APP_VERSION, LANG, OS } from './protocol/config'
import { LocoSession } from './protocol/session'
import type { ChatListResponse, LoginListResponse, SyncState } from './protocol/types'
import type { KakaoChat, KakaoMessage, KakaoProfile, KakaoSendResult } from './types'

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

function findMaxLogId(logs: Array<Record<string, unknown>>, field: string): Long | null {
  return logs.reduce<Long | null>((max, log) => {
    const current = bsonToLong(log[field])
    if (!current) return max
    return !max || current.greaterThan(max) ? current : max
  }, null)
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

const CONFIG_DIR = join(homedir(), '.config', 'agent-messenger')

function syncStatePath(deviceUuid: string): string {
  return join(CONFIG_DIR, `kakaotalk-sync-state-${deviceUuid}.json`)
}

async function loadSyncState(deviceUuid: string): Promise<SyncState | undefined> {
  const path = syncStatePath(deviceUuid)
  if (!existsSync(path)) return undefined
  const content = await readFile(path, 'utf-8')
  const parsed = JSON.parse(content) as Partial<SyncState>

  if (
    parsed.version !== 2 ||
    typeof parsed.revision !== 'number' ||
    !Array.isArray(parsed.chatIds) ||
    !Array.isArray(parsed.maxIds) ||
    parsed.chatIds.length !== parsed.maxIds.length ||
    !parsed.lastTokenId ||
    typeof parsed.lbk !== 'number'
  ) {
    return undefined
  }

  return parsed as SyncState
}

async function saveSyncState(deviceUuid: string, state: SyncState): Promise<void> {
  await mkdir(CONFIG_DIR, { recursive: true })
  const path = syncStatePath(deviceUuid)
  await writeFile(path, JSON.stringify(state, null, 2))
  await chmod(path, 0o600)
}

function toLongLike(v: unknown): { low: number; high: number } {
  if (v && typeof v === 'object' && 'low' in v && 'high' in v) {
    const { low, high } = v as { low: number; high: number }
    return { low, high }
  }
  if (typeof v === 'number') {
    const big = BigInt(v)
    return { low: Number(big & 0xffffffffn), high: Number((big >> 32n) & 0xffffffffn) }
  }
  return { low: 0, high: 0 }
}

function buildSyncState(loginResult: LoginListResponse, previousRevision: number): SyncState {
  const chatDatas = (loginResult.chatDatas ?? []) as Array<Record<string, unknown>>
  return {
    version: 2,
    revision: typeof loginResult.revision === 'number' ? loginResult.revision : previousRevision,
    chatIds: chatDatas.map((chat) => toLongLike(chat.c)),
    maxIds: chatDatas.map((chat) => toLongLike(chat.ll)),
    lastTokenId: toLongLike(loginResult.lastTokenId),
    lbk: typeof loginResult.lbk === 'number' ? loginResult.lbk : 0,
  }
}

function deleteFromSyncState(state: SyncState, chatId: string): void {
  const index = state.chatIds.findIndex((entry) => longToString(entry) === chatId)
  if (index === -1) return

  state.chatIds.splice(index, 1)
  state.maxIds.splice(index, 1)
}

function upsertSyncState(state: SyncState, chatId: unknown, maxId: unknown): void {
  const chatIdString = longToString(chatId)
  const nextChatId = toLongLike(chatId)
  const nextMaxId = toLongLike(maxId)
  const index = state.chatIds.findIndex((entry) => longToString(entry) === chatIdString)

  if (index === -1) {
    state.chatIds.push(nextChatId)
    state.maxIds.push(nextMaxId)
    return
  }

  state.chatIds[index] = nextChatId
  state.maxIds[index] = nextMaxId
}

function mergeSyncState(previous: SyncState | undefined, loginResult: LoginListResponse): SyncState {
  const next = previous
    ? {
        version: 2 as const,
        revision: previous.revision,
        chatIds: [...previous.chatIds],
        maxIds: [...previous.maxIds],
        lastTokenId: previous.lastTokenId,
        lbk: previous.lbk,
      }
    : buildSyncState(loginResult, 0)

  next.revision = typeof loginResult.revision === 'number' ? loginResult.revision : next.revision
  next.lastTokenId = toLongLike(loginResult.lastTokenId)
  next.lbk = typeof loginResult.lbk === 'number' ? loginResult.lbk : next.lbk

  const delChatIds = Array.isArray(loginResult.delChatIds) ? loginResult.delChatIds : []
  for (const chatId of delChatIds) {
    deleteFromSyncState(next, longToString(chatId))
  }

  const chatDatas = Array.isArray(loginResult.chatDatas) ? loginResult.chatDatas : []
  for (const chat of chatDatas) {
    upsertSyncState(next, chat.c, chat.ll)
  }

  return next
}

function formatMessages(logs: Array<Record<string, unknown>>, count: number): KakaoMessage[] {
  logs.sort((a, b) => (a.sendAt as number) - (b.sendAt as number))

  return logs.slice(-count).map((log) => ({
    log_id: longToString(log.logId),
    type: log.type as number,
    author_id: log.authorId as number,
    message: log.message as string,
    sent_at: log.sendAt as number,
  }))
}

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
      const syncState = await loadSyncState(this.deviceUuid!)
      const loginResult = await session.login(this.oauthToken!, this.userId!, this.deviceUuid!, syncState)

      const newSyncState = mergeSyncState(syncState, loginResult)
      await saveSyncState(this.deviceUuid!, newSyncState)

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

        // Paginate via LCHATLIST when explicitly requested (--all / --search) OR when
        // the login snapshot is empty. New device registrations often return an empty
        // chatDatas with eof=true because the server has no prior sync state for the
        // device — LCHATLIST fetches the canonical chat list regardless of device history.
        const snapshotEmpty = allChats.length === 0
        if (options?.all || options?.search || snapshotEmpty) {
          let cursor: ChatListResponse = loginResult
          let pages = 0

          while (pages < MAX_PAGES) {
            // Trust eof only when the snapshot had data. When the snapshot was empty
            // (new device), ignore eof for the first iteration so we always attempt
            // at least one LCHATLIST call.
            if (cursor.eof && !snapshotEmpty) break
            if (cursor.eof && snapshotEmpty && pages > 0) break

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
        const count = options?.count ?? 20
        const cursor = options?.from ? parseLong(options.from) : undefined

        const cid = parseLong(chatId)

        const allMessages: Array<Record<string, unknown>> = []
        const seenLogIds = new Set<string>()
        let cur = cursor ?? Long.fromNumber(0)

        try {
          for (let page = 0; page < MAX_PAGES; page++) {
            const response = await session.getChatLogs([cid], [cur])
            const responseStatus = response.body.status
            if (typeof responseStatus === 'number' && responseStatus !== 0) {
              throw new Error(`MCHATLOGS failed: ${responseStatus}`)
            }

            const batch = ((response.body.chatLogs ?? []) as Array<Record<string, unknown>>).filter(
              (log) => longToString(log.chatId) === chatId,
            )
            if (batch.length === 0) {
              return formatMessages(allMessages, count)
            }

            for (const log of batch) {
              const lid = longToString(log.logId)
              if (!seenLogIds.has(lid)) {
                seenLogIds.add(lid)
                allMessages.push(log)
              }
            }

            const maxLog = findMaxLogId(batch, 'logId')
            if (!maxLog || maxLog.equals(cur) || response.body.eof) {
              return formatMessages(allMessages, count)
            }

            cur = maxLog
          }
        } catch {
          allMessages.length = 0
          seenLogIds.clear()
          cur = cursor ?? Long.fromNumber(0)
        }

        warn(`[agent-kakaotalk] Warning: message fetch capped at ${MAX_PAGES} pages. Results may be incomplete.`)
        if (allMessages.length > 0) {
          return formatMessages(allMessages, count)
        }

        // Fetch fresh lastLogId via CHATONROOM (not the stale login-time snapshot)
        const chatInfo = await session.getChatInfo(cid)
        const chatBody = chatInfo.body as Record<string, unknown>
        const maxLogId = bsonToLong(chatBody.l)

        let reachedEnd = false
        for (let page = 0; page < MAX_PAGES; page++) {
          const response = await session.syncMessages(cid, 80, cur, maxLogId)
          const batch = (response.body.chatLogs ?? []) as Array<Record<string, unknown>>
          if (batch.length === 0) { reachedEnd = true; break }

          for (const log of batch) {
            const lid = longToString(log.logId)
            if (!seenLogIds.has(lid)) {
              seenLogIds.add(lid)
              allMessages.push(log)
            }
          }

          const maxLog = findMaxLogId(batch, 'logId')

          if (!maxLog || maxLog.equals(cur) || response.body.isOK) { reachedEnd = true; break }
          cur = maxLog
        }
        if (!reachedEnd) {
          warn(`[agent-kakaotalk] Warning: message fetch capped at ${MAX_PAGES} pages. Results may be incomplete.`)
        }

        return formatMessages(allMessages, count)
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

  async getProfile(): Promise<KakaoProfile> {
    this.ensureAuth()
    try {
      const headers = {
        Authorization: `${this.oauthToken}-${this.deviceUuid}`,
        A: `${OS}/${APP_VERSION}/${LANG}`,
        'User-Agent': `KT/${APP_VERSION} Md/macOS ${LANG}`,
        Accept: '*/*',
        'Accept-Language': LANG,
      }

      const [profileRes, settingsRes] = await Promise.all([
        fetch('https://katalk.kakao.com/mac/profile3/me.json', { headers }),
        fetch('https://katalk.kakao.com/mac/account/more_settings.json?since=0&lang=ko', { headers }),
      ])

      if (!profileRes.ok) {
        throw new KakaoTalkError(`Profile request failed: ${profileRes.status}`, 'profile_request_failed')
      }

      const profileData = await profileRes.json() as Record<string, unknown>
      const profile = profileData.profile as Record<string, unknown> | undefined

      let accountDisplayId: string | null = null
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json() as Record<string, unknown>
        accountDisplayId = (settingsData.accountDisplayId as string) || null
      }

      return {
        user_id: this.userId!,
        nickname: (profile?.nickName as string) || '',
        profile_image_url: (profile?.profileImageUrl as string) || null,
        original_profile_image_url: (profile?.originalProfileImageUrl as string) || null,
        status_message: (profile?.statusMessage as string) || null,
        account_display_id: accountDisplayId,
      }
    } catch (error) {
      throw wrapError(error, 'get_profile_failed')
    }
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
