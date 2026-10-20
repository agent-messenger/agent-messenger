import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'

import { escapeHtml, markdownToHtml } from '@/shared/utils/markdown-to-html'

import { SUBSTRATE_SEARCH_URL } from './app-config'
import { TeamsCredentialManager } from './credential-manager'
import { TeamsGraph, graphMessage, graphTeam, graphChannel, graphUser, graphFile, segment } from './graph'
import { sanitizeTeamsHtml } from './html-sanitizer'
import { parseTeamsContent, teamsHtmlToText } from './message-content'
import { TeamsTokenProvider } from './token-provider'
import type {
  TeamsAccountType,
  TeamsChannel,
  TeamsChat,
  TeamsChatType,
  TeamsFile,
  TeamsMessage,
  TeamsMessageFormat,
  TeamsRegion,
  TeamsSearchResult,
  TeamsTeam,
  TeamsUser,
} from './types'
import { TeamsAuthCapabilityError, TeamsError } from './types'

interface RateLimitBucket {
  remaining: number
  resetAt: number
}

interface RawTeamsMessage extends TeamsMessage {
  rootMessageId?: string
  parentMessageId?: string
  properties?: unknown
}

type JsonRecord = Record<string, unknown>

const PERSONAL_MSG_API_BASE = 'https://msgapi.teams.live.com/v1'
const MAX_RETRIES = 3
const BASE_BACKOFF_MS = 100
const DEFAULT_REGION: TeamsRegion = 'amer'
const REGIONS: TeamsRegion[] = ['amer', 'emea', 'apac']
const CSA_API_BASE = 'https://teams.microsoft.com/api'
const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0'

function reactionUnicode(emoji: string): string {
  const aliases: Record<string, string> = {
    like: '👍',
    heart: '❤️',
    laugh: '😆',
    surprised: '😮',
    sad: '😢',
    angry: '😠',
  }
  return Object.hasOwn(aliases, emoji) ? aliases[emoji] : emoji
}

// Personal (Teams for Life) skypetokens carry a consumer `skypeid` (e.g.
// "live:..." or "8:live:..."); work/school tokens carry an org identity. Used
// only to guess the account type when a caller logs in with a bare token.
function isPersonalToken(token: string): boolean {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')) as {
      skypeid?: string
    }
    const skypeId = payload.skypeid ?? ''
    return skypeId.includes('live:') || skypeId.startsWith('8:live:')
  } catch {
    return false
  }
}

function parsePropertyArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {}
  }
  return []
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringFrom(record: JsonRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.length > 0) return value
  }
  return undefined
}

function recordFrom(record: JsonRecord, keys: string[]): JsonRecord | undefined {
  for (const key of keys) {
    const value = record[key]
    if (isRecord(value)) return value
  }
  return undefined
}

function arrayFrom(record: JsonRecord, keys: string[]): unknown[] {
  for (const key of keys) {
    const value = record[key]
    if (Array.isArray(value)) return value
  }
  return []
}

function propertyValue(record: JsonRecord, names: string[]): string | undefined {
  const properties = arrayFrom(record, ['Properties', 'properties'])
  const normalized = names.map((name) => name.toLowerCase())
  for (const property of properties) {
    if (!isRecord(property)) continue
    const name = stringFrom(property, ['Name', 'name', 'Key', 'key'])
    if (!name || !normalized.includes(name.toLowerCase())) continue
    const value = property.Value ?? property.value
    if (typeof value === 'string' && value.length > 0) return value
  }
  return undefined
}

function resultString(record: JsonRecord, keys: string[]): string | undefined {
  return stringFrom(record, keys) ?? propertyValue(record, keys)
}

function parseSubstrateResult(value: unknown): TeamsSearchResult | null {
  if (!isRecord(value)) return null
  const source = recordFrom(value, ['Source', 'source']) ?? value
  const author = recordFrom(source, ['Author', 'author', 'From', 'from'])
  const email = author && recordFrom(author, ['EmailAddress', 'emailAddress'])
  const extensions = recordFrom(source, ['Extensions'])
  const id = resultString(source, ['InternetMessageId', 'MessageId', 'id', 'Id', 'ReferenceId'])
  const channelId = resultString(source, ['channel_id', 'ChannelId', 'ClientThreadId', 'ThreadId', 'ConversationId'])
  if (!id || !channelId) return null
  const htmlContent = resultString(source, ['content', 'Content'])
  const preview = resultString(source, ['Preview', 'Summary'])
  const content =
    htmlContent !== undefined
      ? teamsHtmlToText(htmlContent)
      : (preview ?? teamsHtmlToText(resultString(value, ['HitHighlightedSummary']) ?? ''))
  return {
    id,
    channel_id: channelId,
    content,
    author: {
      id:
        (extensions && stringFrom(extensions, ['SkypeSpaces_ConversationPost_Extension_FromSkypeInternalId'])) ??
        (author && stringFrom(author, ['id', 'Id', 'ObjectId'])) ??
        propertyValue(source, ['AuthorId']) ??
        '',
      displayName:
        (email && stringFrom(email, ['Name'])) ??
        (author && stringFrom(author, ['displayName', 'DisplayName', 'Name'])) ??
        propertyValue(source, ['AuthorDisplayName', 'Author']) ??
        'Unknown',
    },
    thread_id:
      resultString(source, ['ClientConversationId'])?.split(';messageid=')[1] ??
      resultString(source, ['thread_id', 'ClientConversationId', 'ThreadId']),
    team_name: resultString(source, ['team_name', 'TeamName']),
    channel_name: resultString(source, ['channel_name', 'ChannelName']),
    timestamp: resultString(source, ['timestamp', 'Timestamp', 'DateTimeSent', 'LastModifiedTime']) ?? '',
    permalink: resultString(source, ['permalink', 'Permalink', 'WebUrl', 'Url']),
    raw: value,
  }
}

function parseSubstrateResults(data: unknown): TeamsSearchResult[] {
  if (!isRecord(data)) return []
  const results: TeamsSearchResult[] = []
  for (const entitySet of arrayFrom(data, ['EntitySets', 'entitySets'])) {
    if (!isRecord(entitySet)) continue
    for (const resultSet of arrayFrom(entitySet, ['ResultSets', 'resultSets'])) {
      if (!isRecord(resultSet)) continue
      for (const rawResult of arrayFrom(resultSet, ['Results', 'results'])) {
        const result = parseSubstrateResult(rawResult)
        if (result) results.push(result)
      }
    }
  }
  return results
}

function validateSearchLimit(value: number | undefined): number {
  if (value === undefined) return 20
  if (!Number.isInteger(value) || value < 1) {
    throw new TeamsError('Search limit must be a positive integer.', 'invalid_pagination')
  }
  return value
}

function validateSearchFrom(value: number | undefined): number {
  if (value === undefined) return 0
  if (!Number.isInteger(value) || value < 0) {
    throw new TeamsError('Search from offset must be a non-negative integer.', 'invalid_pagination')
  }
  return value
}

function isSharePointOrOneDriveUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url)
    const normalizedHost = hostname.toLowerCase()
    return (
      normalizedHost.includes('sharepoint.com') ||
      normalizedHost.includes('-my.sharepoint') ||
      normalizedHost === '1drv.ms' ||
      normalizedHost.endsWith('.1drv.ms') ||
      normalizedHost === 'onedrive.live.com' ||
      normalizedHost.endsWith('.onedrive.live.com')
    )
  } catch {
    return false
  }
}

// Only these hosts receive the Skype token on a raw download fetch. Teams file
// metadata can carry arbitrary URLs, so we never attach credentials to a host
// outside this allowlist — that would leak the token to a third party.
function isTrustedSkypeDownloadHost(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return (
      host === 'teams.microsoft.com' ||
      host.endsWith('.teams.microsoft.com') ||
      host.endsWith('.asm.skype.com') ||
      host.endsWith('.asyncgw.teams.microsoft.com') ||
      host === 'substrate.office.com' ||
      host.endsWith('.substrate.office.com')
    )
  } catch {
    return false
  }
}

function getFileDownloadSource(file: TeamsFile): { route: 'graph' | 'skype'; url: string } {
  const shareUrl = [file.sharepoint_url, file.url, file.object_url].find((candidate): candidate is string =>
    Boolean(candidate && isSharePointOrOneDriveUrl(candidate)),
  )
  if (shareUrl) return { route: 'graph', url: shareUrl }

  const directUrl = file.object_url ?? file.url
  if (!directUrl) {
    throw new TeamsError(`File has no downloadable URL: ${file.id}`, 'file_url_missing')
  }
  if (!isTrustedSkypeDownloadHost(directUrl)) {
    throw new TeamsError(`Refusing to download ${file.id} from an untrusted host: ${directUrl}`, 'file_url_untrusted')
  }
  return { route: 'skype', url: directUrl }
}

async function readDownloadResponse(response: Response, codePrefix: string): Promise<Buffer> {
  if (!response.ok) {
    throw new TeamsError(`File download failed with HTTP ${response.status}`, `${codePrefix}_${response.status}`)
  }

  return Buffer.from(await response.arrayBuffer())
}

function downloadFilename(response: Response, url: string): string {
  const disposition = response.headers.get('content-disposition') ?? ''
  const encoded = disposition.match(/filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i)?.[1]
  const quoted = disposition.match(/filename\s*=\s*"?([^";]+)"?/i)?.[1]
  const fromHeader = encoded ? safeDecodeURIComponent(encoded.trim()) : quoted?.trim()
  if (fromHeader) return basename(fromHeader.replace(/\\/g, '/'))

  const { pathname } = new URL(url)
  // AMS URLs end in `/views/<view>`; the object id is the meaningful part.
  const amsObjectId = pathname.match(/\/objects\/([^/]+)/)?.[1]
  if (amsObjectId) return `${amsObjectId}.${extensionFor(response.headers.get('content-type'))}`
  return basename(safeDecodeURIComponent(pathname)) || 'download'
}

function extensionFor(contentType: string | null): string {
  const subtype = contentType?.split(';')[0].split('/')[1]?.trim().toLowerCase()
  if (!subtype) return 'bin'
  return subtype === 'jpeg' ? 'jpg' : subtype.replace(/\+.*$/, '')
}

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function formatContent(content: string, format: TeamsMessageFormat): string {
  if (format === 'html') return sanitizeTeamsHtml(content)
  return format === 'markdown' ? markdownToHtml(content) : escapeHtml(content).replace(/\r?\n/g, '<br>')
}

interface RawChatMessage {
  id: string
  content?: string
  from?: string
  imdisplayname?: string
  composetime?: string
  originalarrivaltime?: string
  messagetype?: string
  properties?: Record<string, unknown>
}

function toChatMessage(message: RawChatMessage, chatId: string): TeamsMessage {
  return {
    id: message.id,
    channel_id: chatId,
    author: {
      id: message.from ?? '',
      displayName: message.imdisplayname ?? 'Unknown',
    },
    ...parseTeamsContent(message.content, { messagetype: message.messagetype, properties: message.properties }),
    timestamp: message.composetime ?? message.originalarrivaltime ?? '',
    raw_content: message.content ?? '',
    content_type: message.messagetype ?? '',
    mentions: parsePropertyArray(message.properties?.mentions),
    attachments: parsePropertyArray(message.properties?.files),
    raw: { ...message },
  }
}

// Membership changes, call events and similar records; hidden from history unless requested.
function isSystemMessageType(messagetype: string | undefined): boolean {
  return /^(?:ThreadActivity|Event|Control)\//.test(messagetype ?? '')
}

function withCsaContent(message: RawTeamsMessage, rootMessageId?: string): TeamsMessage {
  const { rootMessageId: messageRootId, parentMessageId, properties, ...rest } = message
  const isThreadReply = Boolean(
    rootMessageId ||
    (messageRootId !== undefined && messageRootId !== message.id) ||
    (parentMessageId !== undefined && parentMessageId !== message.id),
  )
  const rootId = rootMessageId ?? messageRootId
  return {
    ...rest,
    ...parseTeamsContent(message.content, { properties }),
    root_message_id: isThreadReply ? rootId : undefined,
    parent_message_id: isThreadReply ? (parentMessageId ?? rootId) : undefined,
    is_thread_reply: isThreadReply ? true : undefined,
  }
}

// groupId => Teams/channel thread (handled by listTeams). "48:notes"/
// streamofnotes => the user's self ("to me") chat. Anything else without a
// non-chat threadType is a chat: 1:1 chats are productThreadType
// "OneToOneChat" with an "@unq.gbl.spaces" id; everything else (including
// untitled "@thread.v2" group chats) is a group. Topic presence is not a
// signal — unnamed group chats have no topic either.
function classifyChat(
  id: string,
  tp?: { topic?: string; threadType?: string; productThreadType?: string; groupId?: string },
): TeamsChatType | null {
  if (tp?.groupId) return null
  if (id === '48:notes' || tp?.threadType === 'streamofnotes') return 'self'
  if (tp?.threadType && tp.threadType !== 'chat') return null
  if (tp?.productThreadType) return tp.productThreadType === 'OneToOneChat' ? 'oneOnOne' : 'group'
  return id.endsWith('@unq.gbl.spaces') ? 'oneOnOne' : 'group'
}

export class TeamsClient {
  private token: string | null = null
  private tokenExpiresAt?: Date
  private isPersonalAccount: boolean = false
  private region: TeamsRegion = DEFAULT_REGION
  private regionDiscovered: boolean = false
  private tokenProvider?: TeamsTokenProvider
  private buckets: Map<string, RateLimitBucket> = new Map()
  private globalRateLimitUntil: number = 0

  constructor(private credManager: TeamsCredentialManager = new TeamsCredentialManager()) {}

  async login(credentials?: {
    token: string
    tokenExpiresAt?: string
    accountType?: TeamsAccountType
    region?: TeamsRegion
  }): Promise<this> {
    if (credentials) {
      if (!credentials.token) {
        throw new TeamsError('Token is required', 'missing_token')
      }
      this.token = credentials.token
      this.getTokenProvider().expectSkypeToken(credentials.token)
      if (credentials.tokenExpiresAt) {
        this.tokenExpiresAt = new Date(credentials.tokenExpiresAt)
      }
      this.isPersonalAccount = credentials.accountType
        ? credentials.accountType === 'personal'
        : isPersonalToken(credentials.token)
      if (credentials.region) {
        this.region = credentials.region
        this.regionDiscovered = true
      }
      if (credentials.accountType) {
        this.getTokenProvider().bindAccount(credentials.accountType)
      }
      return this
    }

    const { ensureTeamsAuth } = await import('./ensure-auth')
    await ensureTeamsAuth()
    const creds = await this.credManager.getTokenWithExpiry()
    if (!creds) {
      throw new TeamsError(
        'No Teams credentials found. Make sure Microsoft Teams is logged in via the desktop app or a supported Chromium browser.',
        'no_credentials',
      )
    }
    return this.login({
      token: creds.token,
      tokenExpiresAt: creds.tokenExpiresAt,
      accountType: creds.accountType,
      region: creds.region,
    })
  }

  getRegion(): TeamsRegion {
    return this.region
  }

  getToken(): string {
    return this.ensureAuth()
  }

  getAccountType(): TeamsAccountType {
    return this.isPersonalAccount ? 'personal' : 'work'
  }

  async getIdToken(): Promise<string | null> {
    const { TeamsTokenExtractor } = await import('./token-extractor')
    const extractor = new TeamsTokenExtractor()
    return extractor.extractIdToken(this.getAccountType())
  }

  private ensureAuth(): string {
    if (this.token === null) {
      throw new TeamsError('Not authenticated. Call .login() first.', 'not_authenticated')
    }
    return this.token
  }

  private isTokenExpired(): boolean {
    if (!this.tokenExpiresAt) {
      return false
    }
    return this.tokenExpiresAt.getTime() < Date.now()
  }

  private getBucketKey(method: string, path: string): string {
    const normalized = path
      .replace(/\/teams\/[^/]+/, '/teams/{team_id}')
      .replace(/\/channels\/[^/]+/, '/channels/{channel_id}')
      .replace(/\/messages\/[^/]+/, '/messages/{message_id}')
      .replace(/\/users\/[^/]+/, '/users/{user_id}')
      .replace(/\/members\/[^/]+/, '/members/{member_id}')
    return `${method}:${normalized}`
  }

  private async waitForRateLimit(bucketKey: string): Promise<void> {
    const now = Date.now()

    if (this.globalRateLimitUntil > now) {
      await this.sleep(this.globalRateLimitUntil - now)
    }

    const bucket = this.buckets.get(bucketKey)
    if (bucket && bucket.remaining === 0 && bucket.resetAt * 1000 > now) {
      await this.sleep(bucket.resetAt * 1000 - now)
    }
  }

  private updateBucket(bucketKey: string, response: Response): void {
    const remaining = response.headers.get('X-RateLimit-Remaining')
    const reset = response.headers.get('X-RateLimit-Reset')

    if (remaining !== null && reset !== null) {
      this.buckets.set(bucketKey, {
        remaining: parseInt(remaining, 10),
        resetAt: parseFloat(reset),
      })
    }
  }

  private async handleRateLimitResponse(response: Response): Promise<number> {
    const retryAfter = response.headers.get('Retry-After')
    const waitMs = parseFloat(retryAfter || '1') * 1000

    this.globalRateLimitUntil = Date.now() + waitMs
    await this.sleep(waitMs)
    return waitMs
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private getMsgApiBase(): string {
    if (this.isPersonalAccount) return PERSONAL_MSG_API_BASE
    return `https://${this.region}.ng.msg.teams.microsoft.com/v1`
  }

  private async discoverRegion(): Promise<void> {
    if (this.isPersonalAccount) {
      this.regionDiscovered = true
      return
    }

    const token = this.ensureAuth()

    for (const region of REGIONS) {
      try {
        const response = await fetch(`https://${region}.ng.msg.teams.microsoft.com/v1/users/ME/properties`, {
          headers: {
            'X-Skypetoken': token,
          },
        })

        if (response.ok || response.status !== 403) {
          this.region = region
          break
        }
      } catch {}
    }

    this.regionDiscovered = true
  }

  private async request<T>(method: string, path: string, body?: unknown, baseUrl?: string): Promise<T> {
    if (this.isTokenExpired()) {
      throw new TeamsError('Token has expired. Run "auth login" or "auth extract" to refresh.', 'token_expired')
    }

    if (baseUrl === undefined && !this.regionDiscovered) {
      await this.discoverRegion()
    }

    const url = `${baseUrl ?? this.getMsgApiBase()}${path}`
    const bucketKey = this.getBucketKey(method, path)

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      await this.waitForRateLimit(bucketKey)

      const headers: Record<string, string> = {
        'X-Skypetoken': this.ensureAuth(),
        'Content-Type': 'application/json',
      }

      const options: RequestInit = {
        method,
        headers,
      }

      if (body !== undefined) {
        options.body = JSON.stringify(body)
      }

      const response = await fetch(url, options)
      this.updateBucket(bucketKey, response)

      if (response.status === 429) {
        if (method === 'GET' && attempt < MAX_RETRIES) {
          await this.handleRateLimitResponse(response)
          continue
        }
        const errorBody = (await response.json().catch(() => null)) as {
          message?: string
        } | null
        throw new TeamsError(errorBody?.message || 'Rate limited', 'rate_limited')
      }

      if (method === 'GET' && response.status >= 500 && attempt < MAX_RETRIES) {
        await this.sleep(BASE_BACKOFF_MS * 2 ** attempt)
        continue
      }

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as {
          message?: string
          code?: string | number
        } | null
        throw new TeamsError(
          errorBody?.message || `HTTP ${response.status}`,
          errorBody?.code?.toString() ?? `http_${response.status}`,
        )
      }

      if (response.status === 204) {
        return undefined as T
      }

      const text = await response.text()
      return (text.trim() ? JSON.parse(text) : undefined) as T
    }

    throw new TeamsError('Request failed after retries', 'max_retries')
  }

  private async requestFormData<T>(path: string, formData: FormData, baseUrl?: string): Promise<T> {
    if (this.isTokenExpired()) {
      throw new TeamsError('Token has expired. Run "auth login" or "auth extract" to refresh.', 'token_expired')
    }

    if (baseUrl === undefined && !this.regionDiscovered) {
      await this.discoverRegion()
    }

    const url = `${baseUrl ?? this.getMsgApiBase()}${path}`
    const bucketKey = this.getBucketKey('POST', path)

    await this.waitForRateLimit(bucketKey)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Skypetoken': this.ensureAuth(),
      },
      body: formData,
    })

    this.updateBucket(bucketKey, response)

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => null)) as {
        message?: string
        code?: string | number
      } | null
      throw new TeamsError(
        errorBody?.message || `HTTP ${response.status}`,
        errorBody?.code?.toString() ?? `http_${response.status}`,
      )
    }

    return response.json() as Promise<T>
  }

  async testAuth(): Promise<TeamsUser> {
    interface UserProperties {
      userDetails?: string
      primaryMemberName?: string
      locale?: string
    }
    const props = await this.request<UserProperties>('GET', '/users/ME/properties')
    const userDetails = props.userDetails ? JSON.parse(props.userDetails) : {}
    return {
      id: 'ME',
      displayName: userDetails.name || props.primaryMemberName || 'Teams User',
    }
  }

  async listTeams(): Promise<TeamsTeam[]> {
    interface Conversation {
      id: string
      threadProperties?: {
        groupId?: string
        spaceThreadTopic?: string
        productThreadType?: string
        threadType?: string
      }
    }
    interface ConversationsResponse {
      conversations: Conversation[]
    }
    const data = await this.request<ConversationsResponse>('GET', '/users/ME/conversations')

    const teamsMap = new Map<string, TeamsTeam>()
    for (const conv of data.conversations) {
      const tp = conv.threadProperties
      if (!tp?.groupId) continue
      if (!tp.productThreadType?.includes('Teams') && tp.threadType !== 'space') continue

      if (!teamsMap.has(tp.groupId)) {
        teamsMap.set(tp.groupId, {
          id: tp.groupId,
          name: tp.spaceThreadTopic || 'Unknown Team',
        })
      }
    }

    return Array.from(teamsMap.values())
  }

  // Graph carries team display names; Skype conversation topics name channels.
  async listJoinedTeams(): Promise<TeamsTeam[]> {
    return (await this.graph().collection('/me/joinedTeams')).map(graphTeam)
  }

  // Realtime messages only carry a conversation id; a channel's parent teamId
  // (== groupId) lives on the conversation, so the listener resolves it through
  // this channelId -> teamId map.
  async buildChannelTeamMap(): Promise<Map<string, string>> {
    interface Conversation {
      id: string
      threadProperties?: {
        groupId?: string
        productThreadType?: string
        threadType?: string
      }
    }
    interface ConversationsResponse {
      conversations: Conversation[]
    }
    const data = await this.request<ConversationsResponse>('GET', '/users/ME/conversations')

    const channelToTeam = new Map<string, string>()
    for (const conv of data.conversations ?? []) {
      const tp = conv.threadProperties
      if (!tp?.groupId) continue
      if (!tp.productThreadType?.includes('Teams') && tp.threadType !== 'space') continue
      channelToTeam.set(conv.id, tp.groupId)
    }

    return channelToTeam
  }

  async listChats(): Promise<TeamsChat[]> {
    interface ConversationMessage {
      content?: string
      composetime?: string
      originalarrivaltime?: string
    }
    interface Conversation {
      id: string
      threadProperties?: {
        topic?: string
        threadType?: string
        productThreadType?: string
        groupId?: string
      }
      lastMessage?: ConversationMessage
    }
    interface ConversationsResponse {
      conversations: Conversation[]
    }
    const data = await this.request<ConversationsResponse>(
      'GET',
      '/users/ME/conversations?view=msnp24Equivalent&pageSize=500',
    )

    const chats: TeamsChat[] = []
    for (const conv of data.conversations ?? []) {
      const type = classifyChat(conv.id, conv.threadProperties)
      if (!type) continue

      chats.push({
        id: conv.id,
        type,
        topic: conv.threadProperties?.topic,
        last_message: conv.lastMessage?.content === undefined ? undefined : teamsHtmlToText(conv.lastMessage.content),
        last_message_at: conv.lastMessage?.composetime ?? conv.lastMessage?.originalarrivaltime,
      })
    }

    return chats
  }

  async getChatMessagesPage(
    chatId: string,
    limit = 50,
    cursor?: string,
    options: { includeSystem?: boolean } = {},
  ): Promise<{ messages: TeamsMessage[]; next_cursor?: string }> {
    const { messages, next_cursor } = await this.fetchChatMessagesPage(chatId, limit, cursor, options)
    return { messages, next_cursor }
  }

  private async fetchChatMessagesPage(
    chatId: string,
    limit: number,
    cursor: string | undefined,
    options: { includeSystem?: boolean },
  ): Promise<{ messages: TeamsMessage[]; next_cursor?: string; fetched: number }> {
    if (!Number.isSafeInteger(limit) || limit < 1)
      throw new TeamsError('Limit must be a positive integer.', 'invalid_pagination')
    const encodedChatId = encodeURIComponent(chatId)
    let path = `/users/ME/conversations/${encodedChatId}/messages?startTime=0&view=msnp24Equivalent&pageSize=${Math.min(limit, 100)}`
    if (cursor) {
      if (!this.regionDiscovered) await this.discoverRegion()
      const url = new URL(cursor)
      if (
        url.origin !== new URL(this.getMsgApiBase()).origin ||
        !decodeURIComponent(url.pathname).endsWith(`/conversations/${chatId}/messages`)
      ) {
        throw new TeamsError('Untrusted message pagination URL.', 'untrusted_pagination')
      }
      path = url.pathname.replace(/^\/v1/, '') + url.search
    }
    const page = await this.request<{ messages: RawChatMessage[]; _metadata?: { backwardLink?: string } }>('GET', path)
    const fetched = page.messages ?? []
    return {
      messages: fetched
        .filter((raw) => options.includeSystem || !isSystemMessageType(raw.messagetype))
        .map((raw) => toChatMessage(raw, chatId)),
      next_cursor: page._metadata?.backwardLink || undefined,
      fetched: fetched.length,
    }
  }

  async getChatMessages(
    chatId: string,
    limit = 50,
    options: { includeSystem?: boolean } = {},
  ): Promise<TeamsMessage[]> {
    const messages: TeamsMessage[] = [],
      seen = new Set<string>()
    let cursor: string | undefined
    do {
      const page = await this.fetchChatMessagesPage(chatId, limit - messages.length, cursor, options)
      messages.push(...page.messages.slice(0, limit - messages.length))
      if (page.fetched === 0) break
      cursor = page.next_cursor
      if (cursor && seen.has(cursor)) throw new TeamsError('Repeated message pagination cursor.', 'repeated_pagination')
      if (cursor) seen.add(cursor)
    } while (cursor && messages.length < limit)
    return messages
  }

  async getChatMessage(chatId: string, messageId: string): Promise<TeamsMessage> {
    const message = await this.request<RawChatMessage>(
      'GET',
      `/users/ME/conversations/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}`,
    )
    return toChatMessage(message, chatId)
  }

  async sendChatMessage(chatId: string, content: string, format: TeamsMessageFormat = 'text'): Promise<TeamsMessage> {
    interface SendResponse {
      OriginalArrivalTime?: number
    }
    const encodedChatId = encodeURIComponent(chatId)
    const response = await this.request<SendResponse>('POST', `/users/ME/conversations/${encodedChatId}/messages`, {
      content: formatContent(content, format),
      messagetype: 'RichText/Html',
      contenttype: 'text',
    })

    const arrivalTime = response?.OriginalArrivalTime
    return {
      id: arrivalTime ? String(arrivalTime) : '',
      channel_id: chatId,
      author: { id: 'ME', displayName: 'Me' },
      content,
      timestamp: arrivalTime ? new Date(arrivalTime).toISOString() : new Date().toISOString(),
    }
  }

  async editChatMessage(
    chatId: string,
    messageId: string,
    content: string,
    format: TeamsMessageFormat = 'text',
  ): Promise<TeamsMessage> {
    interface EditResponse {
      edittime?: string | number
    }
    const encodedChatId = encodeURIComponent(chatId)
    const encodedMessageId = encodeURIComponent(messageId)
    // Skype messaging backend requires skypeeditedid to duplicate the URL message id.
    const response = await this.request<EditResponse>(
      'PUT',
      `/users/ME/conversations/${encodedChatId}/messages/${encodedMessageId}`,
      {
        content: formatContent(content, format),
        messagetype: 'RichText/Html',
        contenttype: 'text',
        skypeeditedid: messageId,
      },
    )

    const editTime = response?.edittime
    return {
      id: messageId,
      channel_id: chatId,
      author: { id: 'ME', displayName: 'Me' },
      content,
      timestamp: editTime ? new Date(Number(editTime) || editTime).toISOString() : new Date().toISOString(),
    }
  }

  // Graph needs the AAD refresh token saved by `auth login` for this client's own identity;
  // otherwise (extract-only, nothing saved, or a different saved user) the CSA routes are used.
  private async withCsaFallback<T>(viaGraph: () => Promise<T>, viaCsa: () => Promise<T>): Promise<T> {
    try {
      return await viaGraph()
    } catch (error) {
      if (error instanceof TeamsAuthCapabilityError) return viaCsa()
      throw error
    }
  }

  private graph(): TeamsGraph {
    return new TeamsGraph(() => this.getTokenProvider().getGraphToken())
  }

  private channelPath(teamId: string, channelId: string): string {
    return `/teams/${segment(teamId)}/channels/${segment(channelId)}`
  }

  private messagePath(teamId: string, channelId: string, messageId: string, rootMessageId?: string): string {
    return (
      this.channelPath(teamId, channelId) +
      '/messages/' +
      (rootMessageId ? `${segment(rootMessageId)}/replies/` : '') +
      segment(messageId)
    )
  }

  async getTeam(teamId: string): Promise<TeamsTeam> {
    return this.withCsaFallback(
      async () => graphTeam(await this.graph().request('GET', `/teams/${segment(teamId)}`)),
      () => this.request<TeamsTeam>('GET', `/csa/api/v1/teams/${teamId}`, undefined, CSA_API_BASE),
    )
  }

  async listChannels(teamId: string): Promise<TeamsChannel[]> {
    return this.withCsaFallback(
      async () =>
        (await this.graph().collection(`/teams/${segment(teamId)}/channels`)).map((raw) => graphChannel(raw, teamId)),
      () => this.request<TeamsChannel[]>('GET', `/csa/api/v1/teams/${teamId}/channels`, undefined, CSA_API_BASE),
    )
  }

  async getChannel(teamId: string, channelId: string): Promise<TeamsChannel> {
    return this.withCsaFallback(
      async () => graphChannel(await this.graph().request('GET', this.channelPath(teamId, channelId)), teamId),
      () =>
        this.request<TeamsChannel>('GET', `/csa/api/v1/teams/${teamId}/channels/${channelId}`, undefined, CSA_API_BASE),
    )
  }

  async sendMessage(
    teamId: string,
    channelId: string,
    content: string,
    rootMessageId?: string,
    format: TeamsMessageFormat = 'text',
  ): Promise<TeamsMessage> {
    const path =
      this.channelPath(teamId, channelId) + '/messages' + (rootMessageId ? `/${segment(rootMessageId)}/replies` : '')
    const html = formatContent(content, format)
    return this.withCsaFallback(
      async () =>
        graphMessage(
          await this.graph().request('POST', path, { body: { contentType: 'html', content: html } }),
          channelId,
          rootMessageId,
        ),
      async () => {
        const csaPath =
          `/csa/${this.region}/api/v2/teams/${teamId}/channels/${channelId}/messages` +
          (rootMessageId ? `/${rootMessageId}/replies` : '')
        const body = rootMessageId ? { content: html, parentMessageId: rootMessageId } : { content: html }
        return withCsaContent(await this.request<RawTeamsMessage>('POST', csaPath, body, CSA_API_BASE), rootMessageId)
      },
    )
  }

  async getMessages(teamId: string, channelId: string, limit = 50): Promise<TeamsMessage[]> {
    return this.withCsaFallback(
      async () =>
        (
          await this.graph().collection(
            this.channelPath(teamId, channelId) + `/messages?$top=${Math.min(limit, 50)}`,
            limit,
          )
        ).map((raw) => graphMessage(raw, channelId)),
      async () =>
        (
          await this.request<RawTeamsMessage[]>(
            'GET',
            `/csa/${this.region}/api/v2/teams/${teamId}/channels/${channelId}/messages?limit=${limit}`,
            undefined,
            CSA_API_BASE,
          )
        ).map((message) => withCsaContent(message)),
    )
  }

  async getThreadReplies(
    teamId: string,
    channelId: string,
    rootMessageId: string,
    limit = 50,
  ): Promise<TeamsMessage[]> {
    return this.withCsaFallback(
      async () =>
        (
          await this.graph().collection(
            this.channelPath(teamId, channelId) +
              `/messages/${segment(rootMessageId)}/replies?$top=${Math.min(limit, 50)}`,
            limit,
          )
        ).map((raw) => graphMessage(raw, channelId, rootMessageId)),
      async () =>
        (
          await this.request<RawTeamsMessage[]>(
            'GET',
            `/csa/${this.region}/api/v2/teams/${teamId}/channels/${channelId}/messages/${rootMessageId}/replies?limit=${limit}`,
            undefined,
            CSA_API_BASE,
          )
        ).map((reply) => withCsaContent(reply, rootMessageId)),
    )
  }

  async searchMessages(query: string, opts: { limit?: number; from?: number } = {}): Promise<TeamsSearchResult[]> {
    const size = validateSearchLimit(opts.limit)
    const from = validateSearchFrom(opts.from)
    const tokenProvider = this.getTokenProvider()
    const substrateToken = await tokenProvider.getSubstrateToken()
    const tenantId = await tokenProvider.getTenantId()
    const userId = await tokenProvider.getUserId()

    const response = await fetch(SUBSTRATE_SEARCH_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${substrateToken}`,
        'Content-Type': 'application/json',
        'X-Client-Flights': 'SearchV2Flight,SubstrateSearchFanoutFlight,lutmsearchmsg,TMSParseRefiningQueries',
        'X-Client-UI-Language': 'en-US',
        'x-anchormailbox': `Oid:${userId}@${tenantId}`,
      },
      body: JSON.stringify({
        cvid: randomUUID(),
        logicalId: randomUUID(),
        scenario: { Name: 'powerbar', Dimensions: [{ DimensionName: 'QueryType', DimensionValue: 'Messages' }] },
        entityRequests: [
          {
            entityType: 'Message',
            contentSources: ['Teams'],
            propertySet: 'Optimized',
            fields: [
              'Extension_SkypeSpaces_ConversationPost_Extension_FromSkypeInternalId_String',
              'Extension_SkypeSpaces_ConversationPost_Extension_ThreadType_String',
              'Extension_SkypeSpaces_ConversationPost_Extension_SkypeGroupId_String',
              'Extension_SkypeSpaces_ConversationPost_Extension_SenderTenantId_String',
            ],
            from,
            size,
            query: { queryString: query, displayQueryString: query },
          },
        ],
      }),
    })

    const data = (await response.json().catch(() => ({}))) as unknown
    if (!response.ok) {
      const message = isRecord(data)
        ? stringFrom(data, ['message', 'Message', 'error_description', 'error'])
        : undefined
      throw new TeamsError(message ?? `HTTP ${response.status}`, `substrate_${response.status}`)
    }

    return parseSubstrateResults(data)
  }

  private getTokenProvider(): TeamsTokenProvider {
    this.tokenProvider ??= new TeamsTokenProvider(this.credManager)
    return this.tokenProvider
  }

  async getMessage(
    teamId: string,
    channelId: string,
    messageId: string,
    rootMessageId?: string,
  ): Promise<TeamsMessage> {
    return this.withCsaFallback(
      async () =>
        graphMessage(
          await this.graph().request('GET', this.messagePath(teamId, channelId, messageId, rootMessageId)),
          channelId,
          rootMessageId,
        ),
      async () =>
        withCsaContent(
          await this.request<RawTeamsMessage>(
            'GET',
            `/csa/${this.region}/api/v2/teams/${teamId}/channels/${channelId}/messages/${messageId}`,
            undefined,
            CSA_API_BASE,
          ),
          rootMessageId,
        ),
    )
  }

  async deleteMessage(teamId: string, channelId: string, messageId: string, rootMessageId?: string): Promise<void> {
    // Resolve the exact team/channel/reply before writing to Chat Service, which
    // uses the existing Skype token instead of Graph's broader delete scope.
    let message: TeamsMessage
    try {
      message = await this.getMessage(teamId, channelId, messageId, rootMessageId)
    } catch (error) {
      if (!(error instanceof TeamsAuthCapabilityError)) throw error
      await this.request<void>(
        'DELETE',
        `/csa/${this.region}/api/v2/teams/${teamId}/channels/${channelId}/messages/${messageId}`,
        undefined,
        CSA_API_BASE,
      )
      return
    }
    if (message.id !== messageId)
      throw new TeamsError('Delete target did not match the message.', 'delete_target_mismatch')
    if (message.deleted_at) return
    const conversationId = rootMessageId ? `${channelId};messageid=${rootMessageId}` : channelId
    const result = await this.request<{ errorCode?: number | string } | undefined>(
      'DELETE',
      `/users/ME/conversations/${segment(conversationId)}/messages/${segment(messageId)}`,
    )
    if (result?.errorCode !== undefined && Number(result.errorCode) !== 0)
      throw new TeamsError(`Chat Service delete failed: ${result.errorCode}`, 'message_delete_failed')
  }

  async addReaction(
    teamId: string,
    channelId: string,
    messageId: string,
    emoji: string,
    rootMessageId?: string,
  ): Promise<void> {
    await this.withCsaFallback<unknown>(
      () =>
        this.graph().request('POST', this.messagePath(teamId, channelId, messageId, rootMessageId) + '/setReaction', {
          reactionType: reactionUnicode(emoji),
        }),
      () =>
        this.request<void>(
          'POST',
          `/csa/${this.region}/api/v2/teams/${teamId}/channels/${channelId}/messages/${messageId}/reactions`,
          { emoji },
          CSA_API_BASE,
        ),
    )
  }

  async removeReaction(
    teamId: string,
    channelId: string,
    messageId: string,
    emoji: string,
    rootMessageId?: string,
  ): Promise<void> {
    await this.withCsaFallback<unknown>(
      () =>
        this.graph().request('POST', this.messagePath(teamId, channelId, messageId, rootMessageId) + '/unsetReaction', {
          reactionType: reactionUnicode(emoji),
        }),
      () =>
        this.request<void>(
          'DELETE',
          `/csa/${this.region}/api/v2/teams/${teamId}/channels/${channelId}/messages/${messageId}/reactions/${emoji}`,
          undefined,
          CSA_API_BASE,
        ),
    )
  }

  async listUsers(teamId: string): Promise<TeamsUser[]> {
    return this.withCsaFallback(
      async () => (await this.graph().collection(`/teams/${segment(teamId)}/members`)).map(graphUser),
      () => this.request<TeamsUser[]>('GET', `/csa/api/v1/teams/${teamId}/members`, undefined, CSA_API_BASE),
    )
  }

  async getUser(userId: string): Promise<TeamsUser> {
    return this.withCsaFallback(
      async () => graphUser(await this.graph().request('GET', `/users/${segment(userId)}`)),
      () => this.request<TeamsUser>('GET', `/csa/api/v1/users/${userId}`, undefined, CSA_API_BASE),
    )
  }

  private async fileFolder(teamId: string, channelId: string): Promise<{ id: string; driveId: string }> {
    const folder = await this.graph().request('GET', this.channelPath(teamId, channelId) + '/filesFolder')
    if (!folder.id || !folder.parentReference?.driveId)
      throw new TeamsError('Channel drive folder unavailable.', 'file_folder_missing')
    return { id: folder.id, driveId: folder.parentReference.driveId }
  }

  async uploadFile(teamId: string, channelId: string, filePath: string): Promise<TeamsFile> {
    const bytes = await readFile(filePath)
    const filename = basename(filePath) || 'file'
    return this.withCsaFallback(
      async () => {
        const folder = await this.fileFolder(teamId, channelId)
        const path = `/drives/${segment(folder.driveId)}/items/${segment(folder.id)}:/${segment(filename)}:/content`
        return graphFile(await this.graph().request('PUT', path, undefined, new Uint8Array(bytes)), folder.driveId)
      },
      () => {
        const formData = new FormData()
        formData.append('file', new Blob([bytes]), filename)
        return this.requestFormData<TeamsFile>(
          `/csa/${this.region}/api/v2/teams/${teamId}/channels/${channelId}/files`,
          formData,
          CSA_API_BASE,
        )
      },
    )
  }

  async listFiles(teamId: string, channelId: string): Promise<TeamsFile[]> {
    return this.withCsaFallback(
      async () => {
        const folder = await this.fileFolder(teamId, channelId)
        return (
          await this.graph().collection(`/drives/${segment(folder.driveId)}/items/${segment(folder.id)}/children`)
        ).map((raw) => graphFile(raw, folder.driveId))
      },
      () =>
        this.request<TeamsFile[]>(
          'GET',
          `/csa/${this.region}/api/v2/teams/${teamId}/channels/${channelId}/files`,
          undefined,
          CSA_API_BASE,
        ),
    )
  }

  async downloadFile(teamId: string, channelId: string, fileId: string): Promise<{ buffer: Buffer; file: TeamsFile }> {
    const files = await this.listFiles(teamId, channelId)
    const file = files.find((candidate) => candidate.id === fileId)
    if (!file) {
      throw new TeamsError(`File not found: ${fileId}`, 'file_not_found')
    }

    if (file.drive_id) {
      if (file.is_folder) throw new TeamsError('Cannot download a folder as a file.', 'file_is_folder')
      const token = await this.getTokenProvider().getGraphToken()
      const response = await fetch(
        `${GRAPH_API_BASE}/drives/${segment(file.drive_id)}/items/${segment(file.id)}/content`,
        { headers: { Authorization: `Bearer ${token}` }, redirect: 'follow' },
      )
      return { buffer: await readDownloadResponse(response, 'graph_download'), file }
    }
    const source = getFileDownloadSource(file)
    if (source.route === 'graph') {
      const response = await this.fetchGraphShare(source.url)
      return { buffer: await readDownloadResponse(response, 'graph_download'), file }
    }

    if (this.isTokenExpired()) {
      throw new TeamsError('Token has expired. Run "auth login" or "auth extract" to refresh.', 'token_expired')
    }
    const skypeToken = this.getToken()
    const response = await fetch(source.url, {
      headers: {
        Authorization: `Bearer ${skypeToken}`,
        'X-Skypetoken': skypeToken,
      },
      redirect: 'follow',
    })
    return { buffer: await readDownloadResponse(response, 'skype_download'), file }
  }

  async downloadContent(url: string): Promise<{ data: Buffer; filename: string; contentType: string | null }> {
    if (isSharePointOrOneDriveUrl(url)) {
      const response = await this.fetchGraphShare(url)
      const data = await readDownloadResponse(response, 'graph_download')
      return { data, filename: downloadFilename(response, url), contentType: response.headers.get('content-type') }
    }

    if (!url.toLowerCase().startsWith('https://') || !isTrustedSkypeDownloadHost(url)) {
      throw new TeamsError(`Refusing to download from an untrusted host: ${url}`, 'file_url_untrusted')
    }
    if (this.isTokenExpired()) {
      throw new TeamsError('Token has expired. Run "auth login" or "auth extract" to refresh.', 'token_expired')
    }
    // AMS content (inline images) only accepts the `skype_token` scheme; a
    // Bearer header or a bare X-Skypetoken is rejected with 401.
    const response = await fetch(url, {
      headers: { Authorization: `skype_token ${this.getToken()}` },
      redirect: 'follow',
    })
    const data = await readDownloadResponse(response, 'skype_download')
    return { data, filename: downloadFilename(response, url), contentType: response.headers.get('content-type') }
  }

  private async fetchGraphShare(url: string): Promise<Response> {
    const graphToken = await this.getTokenProvider().getGraphToken()
    const shareId = `u!${Buffer.from(url).toString('base64url').replace(/=+$/, '')}`
    return fetch(`${GRAPH_API_BASE}/shares/${shareId}/driveItem/content`, {
      headers: {
        Authorization: `Bearer ${graphToken}`,
      },
      redirect: 'follow',
    })
  }
}
