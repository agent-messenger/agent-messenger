import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'

import { escapeHtml, markdownToHtml } from '@/shared/utils/markdown-to-html'

import { SUBSTRATE_SEARCH_URL } from './app-config'
import { TeamsCredentialManager } from './credential-manager'
import { sanitizeTeamsHtml } from './html-sanitizer'
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
import { TeamsError } from './types'

interface RateLimitBucket {
  remaining: number
  resetAt: number
}

interface RawTeamsMessage extends TeamsMessage {
  rootMessageId?: string
  parentMessageId?: string
}

type JsonRecord = Record<string, unknown>

const PERSONAL_MSG_API_BASE = 'https://msgapi.teams.live.com/v1'
const CSA_API_BASE = 'https://teams.microsoft.com/api'
const MAX_RETRIES = 3
const BASE_BACKOFF_MS = 100
const DEFAULT_REGION: TeamsRegion = 'amer'
const REGIONS: TeamsRegion[] = ['amer', 'emea', 'apac']
const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0'

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

function stripHtml(content: string | undefined): string | undefined {
  if (content === undefined) return undefined
  const stripped = content.replace(/<[^>]*>/g, '')
  return stripped
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
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
  const author = recordFrom(value, ['Author', 'author', 'From', 'from'])
  const id = resultString(value, ['id', 'Id', 'ReferenceId', 'MessageId'])
  const channelId = resultString(value, ['channel_id', 'ChannelId', 'ConversationId', 'ThreadId'])
  if (!id || !channelId) return null

  return {
    id,
    content:
      stripHtml(resultString(value, ['content', 'Content', 'HitHighlightedSummary', 'Summary', 'Preview'])) ?? '',
    author: {
      id: author ? (stringFrom(author, ['id', 'Id', 'ObjectId']) ?? '') : (propertyValue(value, ['AuthorId']) ?? ''),
      displayName: author
        ? (stringFrom(author, ['displayName', 'DisplayName', 'Name']) ?? 'Unknown')
        : (propertyValue(value, ['AuthorDisplayName', 'Author']) ?? 'Unknown'),
    },
    channel_id: channelId,
    thread_id: resultString(value, ['thread_id', 'ThreadId']),
    team_name: resultString(value, ['team_name', 'TeamName']),
    channel_name: resultString(value, ['channel_name', 'ChannelName']),
    timestamp: resultString(value, ['timestamp', 'Timestamp', 'DateTimeSent', 'LastModifiedTime']) ?? '',
    permalink: resultString(value, ['permalink', 'Permalink', 'WebUrl', 'Url']),
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

function formatContent(content: string, format: TeamsMessageFormat): string {
  if (format === 'html') return sanitizeTeamsHtml(content)
  return format === 'markdown' ? markdownToHtml(content) : escapeHtml(content)
}

function withThreadMetadata(message: RawTeamsMessage, rootMessageId?: string): TeamsMessage {
  const { rootMessageId: messageRootMessageId, parentMessageId, ...teamsMessage } = message
  const rawRootMessageId = rootMessageId ?? messageRootMessageId
  const isThreadReply = Boolean(
    rootMessageId ||
    (messageRootMessageId !== undefined && messageRootMessageId !== message.id) ||
    (parentMessageId !== undefined && parentMessageId !== message.id),
  )

  return {
    ...teamsMessage,
    root_message_id: isThreadReply ? rawRootMessageId : undefined,
    parent_message_id: isThreadReply ? (parentMessageId ?? rawRootMessageId) : undefined,
    is_thread_reply: isThreadReply ? true : undefined,
  }
}

// groupId => Teams/channel thread (handled by listTeams). "48:notes"/
// streamofnotes => the user's self ("to me") chat. Anything else without a
// non-chat threadType is a normal 1:1 (no topic) or group (has topic) chat.
function classifyChat(
  id: string,
  tp?: { topic?: string; threadType?: string; groupId?: string },
): TeamsChatType | null {
  if (tp?.groupId) return null
  if (id === '48:notes' || tp?.threadType === 'streamofnotes') return 'self'
  if (tp?.threadType && tp.threadType !== 'chat') return null
  return tp?.topic ? 'group' : 'oneOnOne'
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
        if (attempt < MAX_RETRIES) {
          await this.handleRateLimitResponse(response)
          continue
        }
        const errorBody = (await response.json().catch(() => null)) as {
          message?: string
        } | null
        throw new TeamsError(errorBody?.message || 'Rate limited', 'rate_limited')
      }

      if (response.status >= 500 && attempt < MAX_RETRIES) {
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

      return response.json() as Promise<T>
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
        last_message: stripHtml(conv.lastMessage?.content),
        last_message_at: conv.lastMessage?.composetime ?? conv.lastMessage?.originalarrivaltime,
      })
    }

    return chats
  }

  async getChatMessages(chatId: string, limit: number = 50): Promise<TeamsMessage[]> {
    interface ChatMessage {
      id: string
      content?: string
      from?: string
      imdisplayname?: string
      composetime?: string
      originalarrivaltime?: string
      messagetype?: string
    }
    interface MessagesResponse {
      messages: ChatMessage[]
    }
    const encodedChatId = encodeURIComponent(chatId)
    const data = await this.request<MessagesResponse>(
      'GET',
      `/users/ME/conversations/${encodedChatId}/messages?startTime=0&view=msnp24Equivalent&pageSize=${limit}`,
    )

    const userMessageTypes = new Set(['Text', 'RichText/Html', 'RichText/Media_CallRecording'])
    return (data.messages ?? [])
      .filter((msg) => !msg.messagetype || userMessageTypes.has(msg.messagetype))
      .slice(0, limit)
      .map((msg) => ({
        id: msg.id,
        channel_id: chatId,
        author: {
          id: msg.from ?? '',
          displayName: msg.imdisplayname ?? 'Unknown',
        },
        content: stripHtml(msg.content) ?? '',
        timestamp: msg.composetime ?? msg.originalarrivaltime ?? '',
      }))
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

  async getTeam(teamId: string): Promise<TeamsTeam> {
    return this.request<TeamsTeam>('GET', `/csa/api/v1/teams/${teamId}`, undefined, CSA_API_BASE)
  }

  async listChannels(teamId: string): Promise<TeamsChannel[]> {
    return this.request<TeamsChannel[]>('GET', `/csa/api/v1/teams/${teamId}/channels`, undefined, CSA_API_BASE)
  }

  async getChannel(teamId: string, channelId: string): Promise<TeamsChannel> {
    return this.request<TeamsChannel>(
      'GET',
      `/csa/api/v1/teams/${teamId}/channels/${channelId}`,
      undefined,
      CSA_API_BASE,
    )
  }

  async sendMessage(
    teamId: string,
    channelId: string,
    content: string,
    rootMessageId?: string,
    format: TeamsMessageFormat = 'text',
  ): Promise<TeamsMessage> {
    const body = formatContent(content, format)

    if (rootMessageId) {
      const response = await this.request<RawTeamsMessage>(
        'POST',
        `/csa/${this.region}/api/v2/teams/${teamId}/channels/${channelId}/messages/${rootMessageId}/replies`,
        { content: body, parentMessageId: rootMessageId },
        CSA_API_BASE,
      )
      return withThreadMetadata(response, rootMessageId)
    }

    return this.request<TeamsMessage>(
      'POST',
      `/csa/${this.region}/api/v2/teams/${teamId}/channels/${channelId}/messages`,
      { content: body },
      CSA_API_BASE,
    )
  }

  async getMessages(teamId: string, channelId: string, limit: number = 50): Promise<TeamsMessage[]> {
    const messages = await this.request<RawTeamsMessage[]>(
      'GET',
      `/csa/${this.region}/api/v2/teams/${teamId}/channels/${channelId}/messages?limit=${limit}`,
      undefined,
      CSA_API_BASE,
    )
    return messages.map((message) => withThreadMetadata(message))
  }

  async getThreadReplies(
    teamId: string,
    channelId: string,
    rootMessageId: string,
    limit: number = 50,
  ): Promise<TeamsMessage[]> {
    const replies = await this.request<RawTeamsMessage[]>(
      'GET',
      `/csa/${this.region}/api/v2/teams/${teamId}/channels/${channelId}/messages/${rootMessageId}/replies?limit=${limit}`,
      undefined,
      CSA_API_BASE,
    )
    return replies.map((reply) => withThreadMetadata(reply, rootMessageId))
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
        'x-anchormailbox': `Oid:${userId}@${tenantId}`,
      },
      body: JSON.stringify({
        cvid: randomUUID(),
        logicalId: randomUUID(),
        query: { queryString: query },
        entityRequests: [
          {
            entityType: 'Message',
            contentSources: ['Teams'],
            from,
            size,
            query: { queryString: query },
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

  async getMessage(teamId: string, channelId: string, messageId: string): Promise<TeamsMessage> {
    return this.request<TeamsMessage>(
      'GET',
      `/csa/${this.region}/api/v2/teams/${teamId}/channels/${channelId}/messages/${messageId}`,
      undefined,
      CSA_API_BASE,
    )
  }

  async deleteMessage(teamId: string, channelId: string, messageId: string): Promise<void> {
    return this.request<void>(
      'DELETE',
      `/csa/${this.region}/api/v2/teams/${teamId}/channels/${channelId}/messages/${messageId}`,
      undefined,
      CSA_API_BASE,
    )
  }

  async addReaction(teamId: string, channelId: string, messageId: string, emoji: string): Promise<void> {
    return this.request<void>(
      'POST',
      `/csa/${this.region}/api/v2/teams/${teamId}/channels/${channelId}/messages/${messageId}/reactions`,
      { emoji },
      CSA_API_BASE,
    )
  }

  async removeReaction(teamId: string, channelId: string, messageId: string, emoji: string): Promise<void> {
    return this.request<void>(
      'DELETE',
      `/csa/${this.region}/api/v2/teams/${teamId}/channels/${channelId}/messages/${messageId}/reactions/${emoji}`,
      undefined,
      CSA_API_BASE,
    )
  }

  async listUsers(teamId: string): Promise<TeamsUser[]> {
    return this.request<TeamsUser[]>('GET', `/csa/api/v1/teams/${teamId}/members`, undefined, CSA_API_BASE)
  }

  async getUser(userId: string): Promise<TeamsUser> {
    return this.request<TeamsUser>('GET', `/csa/api/v1/users/${userId}`, undefined, CSA_API_BASE)
  }

  async uploadFile(teamId: string, channelId: string, filePath: string): Promise<TeamsFile> {
    const fileBuffer = await readFile(filePath)
    const filename = basename(filePath) || 'file'

    const formData = new FormData()
    formData.append('file', new Blob([fileBuffer]), filename)

    return this.requestFormData<TeamsFile>(
      `/csa/${this.region}/api/v2/teams/${teamId}/channels/${channelId}/files`,
      formData,
      CSA_API_BASE,
    )
  }

  async listFiles(teamId: string, channelId: string): Promise<TeamsFile[]> {
    return this.request<TeamsFile[]>(
      'GET',
      `/csa/${this.region}/api/v2/teams/${teamId}/channels/${channelId}/files`,
      undefined,
      CSA_API_BASE,
    )
  }

  async downloadFile(teamId: string, channelId: string, fileId: string): Promise<{ buffer: Buffer; file: TeamsFile }> {
    const files = await this.listFiles(teamId, channelId)
    const file = files.find((candidate) => candidate.id === fileId)
    if (!file) {
      throw new TeamsError(`File not found: ${fileId}`, 'file_not_found')
    }

    const source = getFileDownloadSource(file)
    if (source.route === 'graph') {
      const graphToken = await new TeamsTokenProvider(this.credManager).getGraphToken()
      const shareId = `u!${Buffer.from(source.url).toString('base64url').replace(/=+$/, '')}`
      const response = await fetch(`${GRAPH_API_BASE}/shares/${shareId}/driveItem/content`, {
        headers: {
          Authorization: `Bearer ${graphToken}`,
        },
        redirect: 'follow',
      })
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
}
