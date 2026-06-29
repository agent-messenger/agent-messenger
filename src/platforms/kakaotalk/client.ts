import { existsSync } from 'node:fs'
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { Long } from 'bson'

import { getConfigDir } from '@/shared/utils/config-dir'
import { warn } from '@/shared/utils/stderr'

import { type AttachmentInput, type ResolvedAttachment, planAttachments } from './attachment-router'
import { detectImageDimensions } from './image-meta'
import { sha1Hex } from './media-upload'
import { LANG, PC_OS_NAME, getLocoDeviceConfig } from './protocol/config'
import { uploadMediaToLoco, uploadMultiMediaEntry } from './protocol/media-uploader'
import { LocoSession } from './protocol/session'
import type { ChatListResponse, LocoPacket, LoginListResponse, SyncState } from './protocol/types'
import {
  KAKAO_MESSAGE_TYPE,
  type KakaoChat,
  type KakaoDeviceType,
  type KakaoMarkReadResult,
  type KakaoMember,
  type KakaoMessage,
  type KakaoMultiPhotoExtra,
  type KakaoProfile,
  type KakaoReplyExtra,
  type KakaoReplyTarget,
  type KakaoSendResult,
} from './types'

export type KakaoSessionEvent =
  | { type: 'connected'; userId: string }
  | { type: 'disconnected' }
  | { type: 'kicked'; reason: string }

export type KakaoPushHandler = (packet: LocoPacket) => void
export type KakaoSessionEventHandler = (event: KakaoSessionEvent) => void

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

class MemberNameCache {
  private byChatId = new Map<string, Map<number, string>>()

  ingest(chatDatas: readonly ChatData[]): void {
    for (const chat of chatDatas) {
      const ids = chat.i as Array<{ low: number; high: number } | number> | undefined
      const names = chat.k as string[] | undefined
      if (!Array.isArray(ids) || !Array.isArray(names)) continue

      const chatId = longToString(chat.c)
      let map = this.byChatId.get(chatId)
      if (!map) {
        map = new Map()
        this.byChatId.set(chatId, map)
      }

      const len = Math.min(ids.length, names.length)
      for (let i = 0; i < len; i++) {
        const numericId = toNumericUserId(ids[i])
        if (numericId === null) continue
        const name = names[i]
        if (typeof name === 'string' && name.length > 0) {
          map.set(numericId, name)
        }
      }
    }
  }

  lookup(chatId: string, userId: number): string | null {
    return this.byChatId.get(chatId)?.get(userId) ?? null
  }

  forget(chatId: string): void {
    this.byChatId.delete(chatId)
  }

  clear(): void {
    this.byChatId.clear()
  }
}

function toNumericUserId(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (v && typeof v === 'object' && 'low' in v && 'high' in v) {
    const { low, high } = v as { low: number; high: number }
    // chatDatas[].i entries are member user IDs. KakaoTalk user IDs fit in
    // 53 bits — safe to flatten the BSON Long pair to a JS number for keying.
    return (high >>> 0) * 0x100000000 + (low >>> 0)
  }
  return null
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

function parseAttachmentJson(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== 'string' || raw.length === 0) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    const attachment = parsed as Record<string, unknown>
    return Object.keys(attachment).length > 0 ? attachment : null
  } catch {
    return null
  }
}

function parseLong(s: string): Long {
  const big = BigInt(s)
  const low = Number(big & 0xffffffffn)
  const high = Number((big >> 32n) & 0xffffffffn)
  return new Long(low, high)
}

function parseChatId(chatId: string): Long {
  try {
    return parseLong(chatId)
  } catch (cause) {
    throw new KakaoTalkError(`Invalid chatId: ${chatId}`, 'invalid_chat_id', { cause })
  }
}

function parseUserId(userId: string): Long {
  try {
    return parseLong(userId)
  } catch (cause) {
    throw new KakaoTalkError(`Invalid userId: ${userId}`, 'invalid_user_id', { cause })
  }
}

function parseLogId(logId: string): Long {
  try {
    return parseLong(logId)
  } catch (cause) {
    throw new KakaoTalkError(`Invalid logId: ${logId}`, 'invalid_log_id', { cause })
  }
}

function parseLinkId(linkId: string): Long {
  try {
    return parseLong(linkId)
  } catch (cause) {
    throw new KakaoTalkError(`Invalid linkId: ${linkId}`, 'invalid_link_id', { cause })
  }
}

function formatChat(chat: ChatData, title: string | null, nameCache: MemberNameCache): KakaoChat {
  const memberNames = (chat.k ?? []) as string[]
  const lastLog = chat.l as Record<string, unknown> | null
  const displayName = memberNames.join(', ') || null
  const chatId = longToString(chat.c)

  return {
    chat_id: chatId,
    type: chat.t as number,
    display_name: displayName,
    title,
    active_members: chat.a as number,
    unread_count: chat.n as number,
    last_message: lastLog
      ? {
          author_id: lastLog.authorId as number,
          author_name: nameCache.lookup(chatId, lastLog.authorId as number),
          message: lastLog.message as string,
          sent_at: lastLog.sendAt as number,
        }
      : null,
  }
}

const META_TYPE_TITLE = 3

interface ChannelMetaEntry {
  type?: number
  content?: string
}

interface ChannelInfoResponse {
  chatInfo?: {
    chatMetas?: ChannelMetaEntry[]
  }
}

function extractTitle(body: Record<string, unknown>): string | null {
  const info = (body as ChannelInfoResponse).chatInfo
  const metas = info?.chatMetas
  if (!Array.isArray(metas)) return null

  const titleMeta = metas.find((m) => m?.type === META_TYPE_TITLE)
  const content = titleMeta?.content
  return typeof content === 'string' && content.length > 0 ? content : null
}

interface OpenLinkInfoResponse {
  ols?: Array<{ ln?: unknown }>
}

function extractOpenLinkName(body: Record<string, unknown>): string | null {
  const ols = (body as OpenLinkInfoResponse).ols
  if (!Array.isArray(ols) || ols.length === 0) return null
  const ln = ols[0]?.ln
  return typeof ln === 'string' && ln.length > 0 ? ln : null
}

const OPEN_CHAT_TYPES = new Set(['OM', 'OD'])

function isOpenChat(chat: ChatData): boolean {
  return typeof chat.t === 'string' && OPEN_CHAT_TYPES.has(chat.t)
}

function getOpenLinkId(chat: ChatData): Long | null {
  return bsonToLong(chat.li) ?? null
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
    const id = longToString(chat.c)
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

function syncStatePath(deviceUuid: string): string {
  return join(getConfigDir(), `kakaotalk-sync-state-${deviceUuid}.json`)
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
  await mkdir(getConfigDir(), { recursive: true })
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

function nullableString(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null
}

function nullableNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function isNonZeroLong(v: unknown): boolean {
  if (typeof v === 'number') return v !== 0
  if (v && typeof v === 'object' && 'low' in v && 'high' in v) {
    const { low, high } = v as { low: number; high: number }
    return low !== 0 || high !== 0
  }
  return v !== undefined && v !== null
}

// Reject synthetic LocoConnection close packets ({ statusCode: -1, body.error: 'connection closed' })
// and explicit body-level failures. Required for any SDK method whose response body has no
// caller-visible error channel (e.g. GETMEM/MEMBER return `[]` for both empty rooms and dead
// sockets). Throwing here lets executeWithReconnect detect session death and reconnect.
function assertLocoOk(response: LocoPacket, command: string): void {
  if (response.statusCode !== 0) {
    throw new Error(`${command} failed: statusCode=${response.statusCode}`)
  }
  const bodyStatus = response.body.status
  if (typeof bodyStatus === 'number' && bodyStatus !== 0) {
    throw new Error(`${command} failed: body.status=${bodyStatus}`)
  }
}

function formatMember(member: Record<string, unknown>): KakaoMember {
  return {
    user_id: longToString(member.userId),
    nickname: typeof member.nickName === 'string' ? member.nickName : '',
    profile_image_url: nullableString(member.profileImageUrl ?? member.pi),
    full_profile_image_url: nullableString(member.fullProfileImageUrl ?? member.fpi),
    original_profile_image_url: nullableString(member.originalProfileImageUrl ?? member.opi),
    status_message: nullableString(member.statusMessage),
    country_iso: nullableString(member.countryIso),
    user_type: nullableNumber(member.type),
    open_token: nullableNumber(member.opt),
    open_profile_link_id: isNonZeroLong(member.pli) ? longToString(member.pli) : null,
    open_permission: nullableNumber(member.mt),
  }
}

function memberIdKey(member: Record<string, unknown>): string | null {
  if (member.userId === undefined || member.userId === null) return null
  const key = longToString(member.userId)
  return key === '0' ? null : key
}

function mergeMemberRecords(
  primaryMembers: Array<Record<string, unknown>>,
  fallbackMembers: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const merged: Array<Record<string, unknown>> = []
  const indexByUserId = new Map<string, number>()

  const upsert = (member: Record<string, unknown>) => {
    const userId = memberIdKey(member)
    if (!userId) return

    const existingIndex = indexByUserId.get(userId)
    if (existingIndex === undefined) {
      indexByUserId.set(userId, merged.length)
      merged.push(member)
      return
    }

    merged[existingIndex] = { ...member, ...merged[existingIndex] }
  }

  for (const member of primaryMembers) upsert(member)
  for (const member of fallbackMembers) upsert(member)

  return merged
}

function extractChatInfoMembers(body: unknown): Array<Record<string, unknown>> {
  if (!body || typeof body !== 'object') return []

  const record = body as Record<string, unknown>
  if (Array.isArray(record.m)) {
    return record.m as Array<Record<string, unknown>>
  }

  const chatInfo = record.chatInfo
  if (!chatInfo || typeof chatInfo !== 'object') return []

  const displayMembers = (chatInfo as Record<string, unknown>).displayMembers
  return Array.isArray(displayMembers) ? (displayMembers as Array<Record<string, unknown>>) : []
}

function formatMessages(
  logs: Array<Record<string, unknown>>,
  count: number,
  chatId: string,
  nameCache: MemberNameCache,
): KakaoMessage[] {
  logs.sort((a, b) => (a.sendAt as number) - (b.sendAt as number))

  return logs.slice(-count).map((log) => ({
    log_id: longToString(log.logId),
    type: log.type as number,
    author_id: log.authorId as number,
    author_name: nameCache.lookup(chatId, log.authorId as number),
    message: log.message as string,
    attachment: parseAttachmentJson(log.attachment),
    sent_at: log.sendAt as number,
  }))
}

function buildReplyExtra(target: KakaoReplyTarget): KakaoReplyExtra {
  return {
    attach_only: false,
    attach_type: target.type,
    src_logId: target.log_id,
    src_userId: target.author_id,
    src_message: target.message,
    src_type: target.type,
    src_mentions: [],
    mentions: [],
  }
}

export class KakaoTalkClient {
  private oauthToken: string | null = null
  private userId: string | null = null
  private deviceUuid: string | null = null
  private deviceType: KakaoDeviceType = 'tablet'
  private state: SessionState | null = null
  private initPromise: Promise<SessionState> | null = null
  private closed = false
  private pushHandlers = new Set<KakaoPushHandler>()
  private sessionEventHandlers = new Set<KakaoSessionEventHandler>()
  private nameCache = new MemberNameCache()

  async login(
    credentials?: { oauthToken: string; userId: string; deviceUuid?: string; deviceType?: KakaoDeviceType },
    accountId?: string,
  ): Promise<this> {
    if (credentials) {
      if (!credentials.oauthToken) throw new KakaoTalkError('OAuth token is required', 'missing_token')
      if (!credentials.userId) throw new KakaoTalkError('User ID is required', 'missing_user_id')
      this.oauthToken = credentials.oauthToken
      this.userId = credentials.userId
      this.deviceUuid = credentials.deviceUuid ?? `agent-messenger-${credentials.userId}`
      this.deviceType = credentials.deviceType ?? 'tablet'
      return this
    }
    const { ensureKakaoAuth } = await import('./ensure-auth')
    const account = await ensureKakaoAuth(accountId)
    return this.login({
      oauthToken: account.oauth_token,
      userId: account.user_id,
      deviceUuid: account.device_uuid,
      deviceType: account.device_type,
    })
  }

  getCredentials(): { oauthToken: string; userId: string; deviceUuid: string; deviceType: KakaoDeviceType } {
    this.ensureAuth()
    return {
      oauthToken: this.oauthToken!,
      userId: this.userId!,
      deviceUuid: this.deviceUuid!,
      deviceType: this.deviceType,
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
    const isOwner = !this.initPromise
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
      const wasNew = this.state !== state
      this.state = state
      if (isOwner && wasNew) {
        this.emitSessionEvent({ type: 'connected', userId: this.userId! })
      }
      return state
    } catch (error) {
      // Reset so next call retries cleanly; connect() already wraps in KakaoTalkError
      this.state = null
      this.initPromise = null
      throw error
    }
  }

  async acquireSession(): Promise<LocoSession> {
    const state = await this.ensureSession()
    return state.session
  }

  onPush(handler: KakaoPushHandler): () => void {
    this.pushHandlers.add(handler)
    return () => {
      this.pushHandlers.delete(handler)
    }
  }

  onSessionEvent(handler: KakaoSessionEventHandler): () => void {
    this.sessionEventHandlers.add(handler)
    return () => {
      this.sessionEventHandlers.delete(handler)
    }
  }

  isConnected(): boolean {
    return this.state !== null && !this.closed
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

      try {
        state.session.close()
      } catch {}
      // initPromise is intentionally NOT cleared here: a concurrent caller may already
      // be awaiting an in-flight replacement, and starting a parallel one would send a
      // second LOGINLIST with the same duuid — re-introducing the very self-eviction
      // this layer prevents. Lifecycle paths (onClose / invalidateSession) own that field.
      state = await this.ensureSession()
      return operation(state)
    }
  }

  private async connect(): Promise<SessionState> {
    const session = new LocoSession()
    session.onPush((packet) => this.dispatchPush(session, packet))
    session.onClose(() => {
      if (this.state?.session === session) {
        this.state = null
        this.initPromise = null
        this.emitSessionEvent({ type: 'disconnected' })
      }
    })

    try {
      const syncState = await loadSyncState(this.deviceUuid!)
      const loginResult = await session.login(
        this.oauthToken!,
        this.userId!,
        this.deviceUuid!,
        syncState,
        this.deviceType,
      )

      const newSyncState = mergeSyncState(syncState, loginResult)
      await saveSyncState(this.deviceUuid!, newSyncState)

      this.nameCache.ingest((loginResult.chatDatas ?? []) as ChatData[])

      return { session, loginResult }
    } catch (error) {
      session.close()
      throw new KakaoTalkError(error instanceof Error ? error.message : String(error), 'login_failed', { cause: error })
    }
  }

  private dispatchPush(session: LocoSession, packet: LocoPacket): void {
    // Only fan out pushes from the currently adopted session. While state is null
    // (pre-adoption during connect, or post-invalidation during reconnect) the
    // packet is discarded — we never want a not-yet-adopted or already-dead session
    // to reach subscribers and look "live".
    if (this.state?.session !== session) return

    if (packet.method === 'KICKOUT') {
      this.emitSessionEvent({ type: 'kicked', reason: 'Session kicked — another device logged in' })
      this.invalidateSession(session)
      return
    }

    if (packet.method === 'CHANGESVR') {
      for (const handler of this.pushHandlers) {
        try {
          handler(packet)
        } catch {}
      }
      this.invalidateSession(session)
      this.emitSessionEvent({ type: 'disconnected' })
      this.ensureSession().catch(() => {
        // ensureSession already cleared state on failure; subsequent API calls will retry
        // and surface the error. Listeners do not receive 'connected' until a reconnect
        // succeeds, which is the correct outcome.
      })
      return
    }

    for (const handler of this.pushHandlers) {
      try {
        handler(packet)
      } catch {}
    }
  }

  private invalidateSession(session: LocoSession): void {
    if (this.state?.session === session) {
      this.state = null
      this.initPromise = null
    }
    try {
      session.close()
    } catch {}
  }

  private emitSessionEvent(event: KakaoSessionEvent): void {
    for (const handler of this.sessionEventHandlers) {
      try {
        handler(event)
      } catch {}
    }
  }

  async getChats(options?: { all?: boolean; search?: string; resolveTitles?: boolean }): Promise<KakaoChat[]> {
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
            this.nameCache.ingest(chatDatas)
            cursor = body
            pages++
          }
        }

        allChats.sort((a, b) => ((b.o as number) ?? 0) - ((a.o as number) ?? 0))

        let results = allChats
        if (options?.search) {
          results = allChats.filter((c) => matchesSearch(c, options.search!))
        }

        const titles = options?.resolveTitles
          ? await Promise.all(
              results.map((chat) => this.fetchChatTitle(session, parseLong(longToString(chat.c)), chat)),
            )
          : null

        return results.map((chat, i) => formatChat(chat, titles ? titles[i] : null, this.nameCache))
      } catch (error) {
        throw wrapError(error, 'get_chats_failed')
      }
    })
  }

  /**
   * Resolve the user-set room title via CHATINFO. Returns null on any error
   * (network, malformed response, or no TITLE meta present). Designed to be
   * fire-and-forget per chat — failures don't poison the whole `getChats` call.
   */
  async getChatTitle(chatId: string): Promise<string | null> {
    let parsed: Long
    try {
      parsed = parseLong(chatId)
    } catch {
      return null
    }
    return this.executeWithReconnect(async ({ session, loginResult }) => {
      const chat = (loginResult.chatDatas ?? []).find((c) => String(c.c) === chatId)
      return this.fetchChatTitle(session, parsed, chat)
    })
  }

  private async fetchChatTitle(session: LocoSession, chatId: Long, chat: ChatData | undefined): Promise<string | null> {
    let title: string | null = null
    try {
      const response = await session.getChannelInfo(chatId)
      title = extractTitle(response.body as Record<string, unknown>)
    } catch {
      title = null
    }

    if (title) return title
    if (!chat || !isOpenChat(chat)) return null

    const linkId = getOpenLinkId(chat)
    if (!linkId) return null

    try {
      const response = await session.getOpenLinkInfo([linkId])
      return extractOpenLinkName(response.body as Record<string, unknown>)
    } catch {
      return null
    }
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
              return formatMessages(allMessages, count, chatId, this.nameCache)
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
              return formatMessages(allMessages, count, chatId, this.nameCache)
            }

            cur = maxLog
          }
        } catch {
          allMessages.length = 0
          seenLogIds.clear()
          cur = cursor ?? Long.fromNumber(0)
        }

        if (allMessages.length > 0) {
          warn(`[agent-kakaotalk] Warning: message fetch capped at ${MAX_PAGES} pages. Results may be incomplete.`)
          return formatMessages(allMessages, count, chatId, this.nameCache)
        }

        // Fetch fresh lastLogId via CHATONROOM (not the stale login-time snapshot)
        const chatInfo = await session.getChatInfo(cid)
        const chatBody = chatInfo.body as Record<string, unknown>
        const maxLogId = bsonToLong(chatBody.l)

        let reachedEnd = false
        for (let page = 0; page < MAX_PAGES; page++) {
          const response = await session.syncMessages(cid, 80, cur, maxLogId)
          const batch = (response.body.chatLogs ?? []) as Array<Record<string, unknown>>
          if (batch.length === 0) {
            reachedEnd = true
            break
          }

          for (const log of batch) {
            const lid = longToString(log.logId)
            if (!seenLogIds.has(lid)) {
              seenLogIds.add(lid)
              allMessages.push(log)
            }
          }

          const maxLog = findMaxLogId(batch, 'logId')

          if (!maxLog || maxLog.equals(cur) || response.body.isOK) {
            reachedEnd = true
            break
          }
          cur = maxLog
        }
        if (!reachedEnd) {
          warn(`[agent-kakaotalk] Warning: message fetch capped at ${MAX_PAGES} pages. Results may be incomplete.`)
        }

        return formatMessages(allMessages, count, chatId, this.nameCache)
      } catch (error) {
        throw wrapError(error, 'get_messages_failed')
      }
    })
  }

  async getMembers(chatId: string): Promise<KakaoMember[]> {
    const parsedChatId = parseChatId(chatId)
    return this.executeWithReconnect(async ({ session }) => {
      try {
        const response = await session.getAllMembers(parsedChatId)
        assertLocoOk(response, 'GETMEM')
        const members = (response.body.members ?? []) as Array<Record<string, unknown>>
        let fallbackMembers: Array<Record<string, unknown>> = []
        try {
          // Some KakaoTalk rooms return only a subset from GETMEM even though
          // CHATONROOM carries the full active member list in `m`.
          const chatInfo = await session.getChatInfo(parsedChatId)
          fallbackMembers = extractChatInfoMembers(chatInfo.body)
        } catch {
          fallbackMembers = []
        }

        return mergeMemberRecords(members, fallbackMembers).map(formatMember)
      } catch (error) {
        throw wrapError(error, 'get_members_failed')
      }
    })
  }

  async getMembersByIds(chatId: string, userIds: string[]): Promise<KakaoMember[]> {
    if (userIds.length === 0) return []
    const parsedChatId = parseChatId(chatId)
    const memberIds = userIds.map((id) => parseUserId(id))
    return this.executeWithReconnect(async ({ session }) => {
      try {
        const response = await session.getMembersByIds(parsedChatId, memberIds)
        assertLocoOk(response, 'MEMBER')
        const members = (response.body.members ?? []) as Array<Record<string, unknown>>
        return members.map(formatMember)
      } catch (error) {
        throw wrapError(error, 'get_members_failed')
      }
    })
  }

  async sendMessage(chatId: string, text: string, options?: { replyTo?: KakaoReplyTarget }): Promise<KakaoSendResult> {
    return this.executeWithReconnect(async ({ session }) => {
      try {
        const response = options?.replyTo
          ? await session.sendReply(
              parseLong(chatId),
              text,
              buildReplyExtra(options.replyTo) as unknown as Record<string, unknown>,
            )
          : await session.sendMessage(parseLong(chatId), text)

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

  async sendAttachment(
    chatId: string,
    data: Uint8Array | Buffer,
    filename: string,
    mimeType?: string,
  ): Promise<KakaoSendResult>
  async sendAttachment(chatId: string, attachments: ReadonlyArray<AttachmentInput>): Promise<KakaoSendResult>
  async sendAttachment(
    chatId: string,
    dataOrAttachments: Uint8Array | Buffer | ReadonlyArray<AttachmentInput>,
    filename?: string,
    mimeType?: string,
  ): Promise<KakaoSendResult> {
    const inputs: ReadonlyArray<AttachmentInput> = Array.isArray(dataOrAttachments)
      ? dataOrAttachments
      : [{ data: dataOrAttachments, filename: filename!, mime: mimeType }]
    const plan = planAttachments(inputs)
    switch (plan.kind) {
      case 'single':
        return this.dispatchSingleAttachment(chatId, plan.resolved)
      case 'multiphoto':
        return this.sendMultiPhoto(
          chatId,
          plan.items.map((it) => ({ data: it.data, filename: it.filename })),
        )
      case 'sequential': {
        let last: KakaoSendResult | null = null
        for (const r of plan.resolved) {
          const result = await this.dispatchSingleAttachment(chatId, r)
          if (!result.success) return result
          last = result
        }
        return last!
      }
    }
  }

  private dispatchSingleAttachment(chatId: string, r: ResolvedAttachment): Promise<KakaoSendResult> {
    switch (r.kind) {
      case 'photo':
        return this.sendPhoto(chatId, r.data, r.filename)
      case 'video':
        return this.sendVideo(chatId, r.data, r.filename)
      case 'audio':
        return this.sendAudio(chatId, r.data, r.filename)
      case 'file':
        return this.sendFile(chatId, r.data, r.filename, r.mime)
    }
  }

  async sendPhoto(chatId: string, photo: Uint8Array | Buffer, filename = 'image.jpg'): Promise<KakaoSendResult> {
    this.ensureAuth()
    const data = photo instanceof Uint8Array ? photo : new Uint8Array(photo)
    const dim = detectImageDimensions(data)
    const checksum = await sha1Hex(data)
    const ext = filename.includes('.') ? filename.split('.').pop()! : 'jpg'

    return this.sendMediaViaLoco({
      chatId,
      data,
      msgType: KAKAO_MESSAGE_TYPE.PHOTO,
      filename,
      checksum,
      extension: ext,
      width: dim.width,
      height: dim.height,
      errorCode: 'send_photo_failed',
    })
  }

  async sendVideo(chatId: string, video: Uint8Array | Buffer, filename = 'video.mp4'): Promise<KakaoSendResult> {
    this.ensureAuth()
    const data = video instanceof Uint8Array ? video : new Uint8Array(video)
    const checksum = await sha1Hex(data)
    const ext = filename.includes('.') ? filename.split('.').pop()! : 'mp4'

    return this.sendMediaViaLoco({
      chatId,
      data,
      msgType: KAKAO_MESSAGE_TYPE.VIDEO,
      filename,
      checksum,
      extension: ext,
      errorCode: 'send_video_failed',
    })
  }

  async sendAudio(chatId: string, audio: Uint8Array | Buffer, filename = 'audio.m4a'): Promise<KakaoSendResult> {
    this.ensureAuth()
    const data = audio instanceof Uint8Array ? audio : new Uint8Array(audio)
    const checksum = await sha1Hex(data)
    const ext = filename.includes('.') ? filename.split('.').pop()! : 'm4a'

    return this.sendMediaViaLoco({
      chatId,
      data,
      msgType: KAKAO_MESSAGE_TYPE.AUDIO,
      filename,
      checksum,
      extension: ext,
      errorCode: 'send_audio_failed',
    })
  }

  async sendFile(
    chatId: string,
    file: Uint8Array | Buffer,
    filename: string,
    mimeType = 'application/octet-stream',
  ): Promise<KakaoSendResult> {
    void mimeType
    this.ensureAuth()
    const data = file instanceof Uint8Array ? file : new Uint8Array(file)
    const checksum = await sha1Hex(data)
    const ext = filename.includes('.') ? filename.split('.').pop()! : ''

    return this.sendMediaViaLoco({
      chatId,
      data,
      msgType: KAKAO_MESSAGE_TYPE.FILE,
      filename,
      checksum,
      extension: ext,
      errorCode: 'send_file_failed',
    })
  }

  async sendMultiPhoto(
    chatId: string,
    photos: Array<{ data: Uint8Array | Buffer; filename?: string }>,
  ): Promise<KakaoSendResult> {
    this.ensureAuth()
    if (photos.length < 2) {
      throw new KakaoTalkError(
        'sendMultiPhoto requires at least 2 photos; use sendPhoto for a single image',
        'send_multi_photo_failed',
      )
    }

    const prepared = await Promise.all(
      photos.map(async (p, i) => {
        const bytes = p.data instanceof Uint8Array ? p.data : new Uint8Array(p.data)
        const filename = p.filename ?? `image-${i + 1}.jpg`
        const dim = detectImageDimensions(bytes)
        const checksum = (await sha1Hex(bytes)).toLowerCase()
        const ext = filename.includes('.') ? filename.split('.').pop()! : 'jpg'
        return { bytes, filename, dim, checksum, ext }
      }),
    )

    const parsedChatId = parseChatId(chatId)

    return this.executeWithReconnect(async ({ session }) => {
      try {
        const mshipResp = await session.shipMultiMedia(
          parsedChatId,
          KAKAO_MESSAGE_TYPE.MULTIPHOTO,
          prepared.map((p) => p.bytes.byteLength),
          prepared.map((p) => p.checksum),
          prepared.map((p) => p.ext),
        )

        if (mshipResp.statusCode !== 0) {
          throw new KakaoTalkError(`MSHIP rejected (status ${mshipResp.statusCode})`, 'send_multi_photo_failed')
        }

        const body = mshipResp.body as Record<string, unknown>
        const kl = body.kl as string[] | undefined
        const vhl = body.vhl as string[] | undefined
        const pl = body.pl as number[] | undefined
        if (
          !kl ||
          !vhl ||
          !pl ||
          kl.length !== prepared.length ||
          vhl.length !== prepared.length ||
          pl.length !== prepared.length
        ) {
          throw new KakaoTalkError(
            `MSHIP response arrays do not match prepared.length=${prepared.length}: ` +
              `kl=${kl?.length} vhl=${vhl?.length} pl=${pl?.length}`,
            'send_multi_photo_failed',
          )
        }

        await Promise.all(
          prepared.map((p, i) =>
            uploadMultiMediaEntry({
              shipToken: kl[i]!,
              shipHost: vhl[i]!,
              shipPort: pl[i]!,
              chatId: parsedChatId,
              msgType: KAKAO_MESSAGE_TYPE.MULTIPHOTO,
              userId: this.userId!,
              filename: p.filename,
              data: p.bytes,
              width: p.dim.width,
              height: p.dim.height,
              deviceType: this.deviceType,
            }),
          ),
        )

        const extra: KakaoMultiPhotoExtra = {
          kl,
          wl: prepared.map((p) => p.dim.width),
          hl: prepared.map((p) => p.dim.height),
          mtl: prepared.map((p) => p.dim.mimeType),
          sl: prepared.map((p) => p.bytes.byteLength),
          csl: prepared.map((p) => p.checksum),
          cmtl: prepared.map(() => ''),
        }

        const forwardResp = await session.forwardChat(
          parsedChatId,
          KAKAO_MESSAGE_TYPE.MULTIPHOTO,
          extra as unknown as Record<string, unknown>,
        )

        return {
          success: forwardResp.statusCode === 0,
          status_code: forwardResp.statusCode,
          chat_id: chatId,
          log_id: longToString((forwardResp.body as Record<string, unknown>).logId),
          sent_at: ((forwardResp.body as Record<string, unknown>).sendAt as number | undefined) ?? 0,
        }
      } catch (error) {
        throw wrapError(error, 'send_multi_photo_failed')
      }
    })
  }

  private async sendMediaViaLoco(opts: {
    chatId: string
    data: Uint8Array
    msgType: number
    filename: string
    checksum: string
    extension: string
    width?: number
    height?: number
    errorCode: string
  }): Promise<KakaoSendResult> {
    const parsedChatId = parseChatId(opts.chatId)
    return this.executeWithReconnect(async ({ session }) => {
      try {
        const shipResp = await session.shipMedia(
          parsedChatId,
          opts.msgType,
          opts.data.byteLength,
          opts.checksum,
          opts.extension,
        )

        if (shipResp.statusCode !== 0) {
          throw new KakaoTalkError(`SHIP rejected (status ${shipResp.statusCode})`, opts.errorCode)
        }

        const body = shipResp.body as Record<string, unknown>
        const shipToken = body.k as string | undefined
        const shipHost = body.vh as string | undefined
        const shipPort = body.p as number | undefined

        if (typeof shipToken !== 'string' || typeof shipHost !== 'string' || typeof shipPort !== 'number') {
          throw new KakaoTalkError(
            `SHIP response missing fields: k=${shipToken} vh=${shipHost} p=${shipPort}`,
            opts.errorCode,
          )
        }

        const uploadRes = await uploadMediaToLoco({
          shipToken,
          shipHost,
          shipPort,
          chatId: parsedChatId,
          msgType: opts.msgType,
          userId: this.userId!,
          filename: opts.filename,
          data: opts.data,
          width: opts.width,
          height: opts.height,
          deviceType: this.deviceType,
        })

        const completeBody = uploadRes.completePacket?.body as Record<string, unknown> | undefined
        const chatLog = completeBody?.chatLog as Record<string, unknown> | undefined
        const logId = chatLog?.logId

        return {
          success: uploadRes.completePacket !== null && uploadRes.postStatusCode === 0,
          status_code: uploadRes.postStatusCode,
          chat_id: opts.chatId,
          log_id: longToString(logId),
          sent_at: (chatLog?.sendAt as number | undefined) ?? 0,
        }
      } catch (error) {
        throw wrapError(error, opts.errorCode)
      }
    })
  }

  /**
   * Advance the read watermark for `chatId` up to and including `logId`.
   * The caller decides open vs normal: pass `opts.linkId` for open chats
   * (오픈채팅) and omit it for normal chats. Open chats without a `linkId`
   * are rejected by the server with a non-zero `body.status` — this method
   * does not auto-detect.
   */
  async markRead(chatId: string, logId: string, opts?: { linkId?: string }): Promise<KakaoMarkReadResult> {
    const parsedChatId = parseChatId(chatId)
    const parsedWatermark = parseLogId(logId)
    const parsedLinkId = opts?.linkId !== undefined ? parseLinkId(opts.linkId) : undefined

    return this.executeWithReconnect(async ({ session }) => {
      try {
        const response = await session.markRead(parsedChatId, parsedWatermark, parsedLinkId)
        // Throw on transport-level failure (incl. synthetic { statusCode: -1 }
        // from LocoConnection.handleClose) so executeWithReconnect retries on
        // a fresh session. The NOTIREAD command result lives in body.status.
        if (response.statusCode !== 0) {
          throw new Error(`NOTIREAD failed: statusCode=${response.statusCode}`)
        }
        const bodyStatus = typeof response.body.status === 'number' ? response.body.status : 0
        return {
          success: bodyStatus === 0,
          status_code: bodyStatus,
          chat_id: chatId,
          watermark: logId,
        }
      } catch (error) {
        throw wrapError(error, 'mark_read_failed')
      }
    })
  }

  async getProfile(): Promise<KakaoProfile> {
    this.ensureAuth()
    try {
      const deviceConfig = getLocoDeviceConfig(this.deviceType)
      const isPC = deviceConfig.os !== 'android'
      const apiPrefix = isPC ? 'mac' : 'android'
      const userAgent = isPC
        ? `KT/${deviceConfig.appVersion} Md/${PC_OS_NAME} ${LANG}`
        : `KT/${deviceConfig.appVersion} An/13 ${LANG}`

      const headers = {
        Authorization: `${this.oauthToken}-${this.deviceUuid}`,
        A: `${deviceConfig.os}/${deviceConfig.appVersion}/${LANG}`,
        'User-Agent': userAgent,
        Accept: '*/*',
        'Accept-Language': LANG,
      }

      const [profileRes, settingsRes] = await Promise.all([
        fetch(`https://katalk.kakao.com/${apiPrefix}/profile3/me.json`, { headers }),
        fetch(`https://katalk.kakao.com/${apiPrefix}/account/more_settings.json?since=0&lang=ko`, { headers }),
      ])

      if (!profileRes.ok) {
        throw new KakaoTalkError(`Profile request failed: ${profileRes.status}`, 'profile_request_failed')
      }

      const profileData = (await profileRes.json()) as Record<string, unknown>
      const profile = profileData.profile as Record<string, unknown> | undefined

      let accountDisplayId: string | null = null
      let accountEmail: string | null = null
      let pstnNumber: string | null = null
      let emailVerified: boolean | null = null
      if (settingsRes.ok) {
        const settingsData = (await settingsRes.json()) as Record<string, unknown>
        accountDisplayId = (settingsData.accountDisplayId as string) || null
        accountEmail = (settingsData.accountEmail as string) || null
        pstnNumber = (settingsData.pstnNumber as string) || null
        emailVerified = typeof settingsData.emailVerified === 'boolean' ? settingsData.emailVerified : null
      }

      return {
        user_id: this.userId!,
        nickname: (profile?.nickName as string) || '',
        profile_image_url: (profile?.profileImageUrl as string) || null,
        original_profile_image_url: (profile?.originalProfileImageUrl as string) || null,
        background_image_url: (profile?.backgroundImageUrl as string) || null,
        original_background_image_url: (profile?.originalBackgroundImageUrl as string) || null,
        fullname: (profile?.fullname as string) || null,
        status_message: (profile?.statusMessage as string) || null,
        account_display_id: accountDisplayId,
        account_email: accountEmail,
        pstn_number: pstnNumber,
        email_verified: emailVerified,
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
    this.pushHandlers.clear()
    this.sessionEventHandlers.clear()
    this.nameCache.clear()
  }

  lookupAuthorName(chatId: string, authorId: number): string | null {
    return this.nameCache.lookup(chatId, authorId)
  }
}
