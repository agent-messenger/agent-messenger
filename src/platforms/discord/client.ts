import { readFile } from 'node:fs/promises'

import { getDiscordHeaders } from './super-properties'
import { DiscordSearchIndexNotReadyResponseSchema, DiscordSearchResponseSchema } from './types'
import type {
  DiscordChannel,
  DiscordDMChannel,
  DiscordFile,
  DiscordGuild,
  DiscordGuildMember,
  DiscordMention,
  DiscordMessage,
  DiscordReadState,
  DiscordReadStateSnapshot,
  DiscordRelationship,
  DiscordRole,
  DiscordSearchOptions,
  DiscordSearchResult,
  DiscordUnreadDM,
  DiscordUnreadDMsResult,
  DiscordUnreadMention,
  DiscordUnreadMentionsResult,
  DiscordUser,
  DiscordUserNote,
  DiscordUserProfile,
} from './types'

const MENTIONS_WINDOW_DAYS = 7
const MENTIONS_PAGE_SIZE = 100
const UNREAD_MENTIONS_MAX = 500

function isSnowflakeNewer(candidate: string, marker: string): boolean {
  try {
    return BigInt(candidate) > BigInt(marker)
  } catch {
    return false
  }
}

interface ReadStateCandidateChannel {
  id: string
  last_message_id?: string | null
}

export interface UnreadChannel<T> {
  channel: T
  lastMessageId: string
  unreadCount: number | null
}

export function selectUnreadChannels<T extends ReadStateCandidateChannel>(
  channels: T[],
  readState: DiscordReadStateSnapshot,
): UnreadChannel<T>[] {
  const readStateByChannel = new Map(readState.states.map((state) => [state.channelId, state]))

  const unread: UnreadChannel<T>[] = []
  for (const channel of channels) {
    const lastMessageId = channel.last_message_id
    if (!lastMessageId) continue

    const state = readStateByChannel.get(channel.id)
    // An absent entry only carries meaning when the collection is complete. In a
    // complete payload Discord omits read states for channels it never tracked, so a
    // channel holding messages with no marker is far more likely never-opened than
    // read: surface it with an unknown count rather than silently hiding it. In a
    // partial payload the entry may simply have been left out, so reporting it would
    // be a false positive on an already-read channel.
    if (!state) {
      if (!readState.partial) unread.push({ channel, lastMessageId, unreadCount: null })
      continue
    }

    if (state.lastMessageId !== null && !isSnowflakeNewer(lastMessageId, state.lastMessageId)) continue
    unread.push({ channel, lastMessageId, unreadCount: state.mentionCount })
  }

  return unread.sort((a, b) => (isSnowflakeNewer(a.lastMessageId, b.lastMessageId) ? -1 : 1))
}

export class DiscordError extends Error {
  code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'DiscordError'
    this.code = code
  }
}

interface RateLimitBucket {
  remaining: number
  resetAt: number
  bucketHash: string
}

const BASE_URL = 'https://discord.com/api/v10'
const MAX_RETRIES = 3
const BASE_BACKOFF_MS = 100
const MAX_SEARCH_INDEX_RETRY_MS = 30_000

export class DiscordClient {
  private token: string | null = null
  private buckets: Map<string, RateLimitBucket> = new Map()
  private globalRateLimitUntil: number = 0

  async login(credentials?: { token: string }): Promise<this> {
    if (credentials) {
      if (!credentials.token) {
        throw new DiscordError('Token is required', 'missing_token')
      }
      this.token = credentials.token
      return this
    }

    const { ensureDiscordAuth } = await import('./ensure-auth')
    await ensureDiscordAuth()
    const { DiscordCredentialManager } = await import('./credential-manager')
    const credManager = new DiscordCredentialManager()
    const token = await credManager.getToken()
    if (!token) {
      throw new DiscordError(
        'No Discord credentials found. Make sure Discord is logged in to the desktop app or a supported Chromium browser.',
        'no_credentials',
      )
    }
    return this.login({ token })
  }

  private ensureAuth(): string {
    if (!this.token) {
      throw new DiscordError('Not authenticated. Call .login() first.', 'not_authenticated')
    }
    return this.token
  }

  private getBucketKey(method: string, path: string): string {
    const queryIndex = path.indexOf('?')
    const route = queryIndex === -1 ? path : path.slice(0, queryIndex)
    const normalized = route
      .replace(/\/channels\/\d+/, '/channels/{channel_id}')
      .replace(/\/guilds\/\d+/, '/guilds/{guild_id}')
      .replace(/\/users\/\d+/, '/users/{user_id}')
      .replace(/\/messages\/\d+/, '/messages/{message_id}')
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
    const bucketHash = response.headers.get('X-RateLimit-Bucket')

    if (remaining !== null && reset !== null && bucketHash !== null) {
      this.buckets.set(bucketKey, {
        remaining: parseInt(remaining, 10),
        resetAt: parseFloat(reset),
        bucketHash,
      })
    }
  }

  private async handleRateLimitResponse(response: Response): Promise<number> {
    const retryAfter = response.headers.get('Retry-After')
    const isGlobal = response.headers.get('X-RateLimit-Global') === 'true'
    const waitMs = parseFloat(retryAfter || '1') * 1000

    if (isGlobal) {
      this.globalRateLimitUntil = Date.now() + waitMs
    }

    await this.sleep(waitMs)
    return waitMs
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${BASE_URL}${path}`
    const bucketKey = this.getBucketKey(method, path)

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      await this.waitForRateLimit(bucketKey)

      const headers: Record<string, string> = getDiscordHeaders(this.ensureAuth())

      const options: RequestInit = {
        method,
        headers,
      }

      if (body !== undefined) {
        headers['Content-Type'] = 'application/json'
        options.body = JSON.stringify(body)
      }

      const response = await fetch(url, options)
      this.updateBucket(bucketKey, response)

      if (response.status === 429) {
        if (attempt < MAX_RETRIES) {
          await this.handleRateLimitResponse(response)
          continue
        }
        const errorBody = await response.json().catch(() => ({}))
        throw new DiscordError((errorBody as any).message || 'Rate limited', 'rate_limited')
      }

      if (response.status >= 500 && attempt < MAX_RETRIES) {
        await this.sleep(BASE_BACKOFF_MS * 2 ** attempt)
        continue
      }

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        throw new DiscordError(
          (errorBody as any).message || `HTTP ${response.status}`,
          (errorBody as any).code?.toString() || `http_${response.status}`,
        )
      }

      if (response.status === 204) {
        return undefined as T
      }

      return response.json() as Promise<T>
    }

    throw new DiscordError('Request failed after retries', 'max_retries')
  }

  private async requestFormData<T>(path: string, formData: FormData): Promise<T> {
    const url = `${BASE_URL}${path}`
    const bucketKey = this.getBucketKey('POST', path)

    await this.waitForRateLimit(bucketKey)

    const headers = getDiscordHeaders(this.ensureAuth())
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    })

    this.updateBucket(bucketKey, response)

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      throw new DiscordError(
        (errorBody as any).message || `HTTP ${response.status}`,
        (errorBody as any).code?.toString() || `http_${response.status}`,
      )
    }

    return response.json() as Promise<T>
  }

  async testAuth(): Promise<DiscordUser> {
    return this.request<DiscordUser>('GET', '/users/@me')
  }

  async listServers(): Promise<DiscordGuild[]> {
    return this.request<DiscordGuild[]>('GET', '/users/@me/guilds')
  }

  async getServer(serverId: string): Promise<DiscordGuild> {
    return this.request<DiscordGuild>('GET', `/guilds/${serverId}`)
  }

  async listChannels(serverId: string): Promise<DiscordChannel[]> {
    return this.request<DiscordChannel[]>('GET', `/guilds/${serverId}/channels`)
  }

  async getChannel(channelId: string): Promise<DiscordChannel> {
    return this.request<DiscordChannel>('GET', `/channels/${channelId}`)
  }

  async sendMessage(channelId: string, content: string, options?: { reply_to?: string }): Promise<DiscordMessage> {
    const body: Record<string, unknown> = { content }
    if (options?.reply_to) {
      body.message_reference = { message_id: options.reply_to }
    }
    return this.request<DiscordMessage>('POST', `/channels/${channelId}/messages`, body)
  }

  async getMessages(channelId: string, limit: number = 50, options?: { around?: string }): Promise<DiscordMessage[]> {
    const params = new URLSearchParams()
    if (options?.around) {
      params.set('around', options.around)
    }
    params.set('limit', limit.toString())
    return this.request<DiscordMessage[]>('GET', `/channels/${channelId}/messages?${params}`)
  }

  async getMessage(channelId: string, messageId: string): Promise<DiscordMessage> {
    const messages = await this.getMessages(channelId, 1, { around: messageId })
    const message = messages[0]
    if (!message || message.id !== messageId) {
      throw new DiscordError('Message not found', '10008')
    }
    return message
  }

  async editMessage(channelId: string, messageId: string, content: string): Promise<DiscordMessage> {
    return this.request<DiscordMessage>('PATCH', `/channels/${channelId}/messages/${messageId}`, { content })
  }

  async deleteMessage(channelId: string, messageId: string): Promise<void> {
    return this.request<void>('DELETE', `/channels/${channelId}/messages/${messageId}`)
  }

  async addReaction(channelId: string, messageId: string, emoji: string): Promise<void> {
    const encodedEmoji = encodeURIComponent(emoji)
    return this.request<void>('PUT', `/channels/${channelId}/messages/${messageId}/reactions/${encodedEmoji}/@me`)
  }

  async removeReaction(channelId: string, messageId: string, emoji: string): Promise<void> {
    const encodedEmoji = encodeURIComponent(emoji)
    return this.request<void>('DELETE', `/channels/${channelId}/messages/${messageId}/reactions/${encodedEmoji}/@me`)
  }

  async ackMessage(channelId: string, messageId: string): Promise<void> {
    return this.request<void>('POST', `/channels/${channelId}/messages/${messageId}/ack`, {
      token: null,
    })
  }

  async listUsers(serverId: string): Promise<DiscordUser[]> {
    interface GuildMember {
      user: DiscordUser
    }
    const members = await this.request<GuildMember[]>('GET', `/guilds/${serverId}/members?limit=1000`)
    return members.map((m) => m.user)
  }

  async getUser(userId: string): Promise<DiscordUser> {
    return this.request<DiscordUser>('GET', `/users/${userId}`)
  }

  async uploadFile(channelId: string, filePath: string, options?: { reply_to?: string }): Promise<DiscordFile> {
    const fileBuffer = await readFile(filePath)
    const filename = filePath.split('/').pop() || 'file'

    const formData = new FormData()
    if (options?.reply_to) {
      formData.append('payload_json', JSON.stringify({ message_reference: { message_id: options.reply_to } }))
    }
    formData.append('files[0]', new Blob([fileBuffer]), filename)

    interface MessageWithAttachments extends DiscordMessage {
      attachments: DiscordFile[]
    }
    const message = await this.requestFormData<MessageWithAttachments>(`/channels/${channelId}/messages`, formData)

    return message.attachments[0]
  }

  async listFiles(channelId: string): Promise<DiscordFile[]> {
    interface MessageWithAttachments extends DiscordMessage {
      attachments: DiscordFile[]
    }
    const messages = await this.request<MessageWithAttachments[]>('GET', `/channels/${channelId}/messages?limit=100`)

    const files: DiscordFile[] = []
    for (const msg of messages) {
      if (msg.attachments && msg.attachments.length > 0) {
        files.push(...msg.attachments)
      }
    }
    return files
  }

  async listDMChannels(): Promise<DiscordDMChannel[]> {
    return this.request<DiscordDMChannel[]>('GET', '/users/@me/channels')
  }

  async createDM(userId: string): Promise<DiscordDMChannel> {
    return this.request<DiscordDMChannel>('POST', '/users/@me/channels', {
      recipient_id: userId,
    })
  }

  async getUnreadDMs(options?: { limit?: number }): Promise<DiscordUnreadDMsResult> {
    const [readState, channels] = await Promise.all([this.fetchReadStateSnapshot(), this.listDMChannels()])

    const unread = selectUnreadChannels(channels, readState).map(
      ({ channel, lastMessageId, unreadCount }): DiscordUnreadDM => ({
        id: channel.id,
        type: channel.type,
        name: channel.name ?? null,
        recipients: channel.recipients,
        lastMessageId,
        unreadCount,
      }),
    )

    const totalUnread = unread.reduce((sum, channel) => sum + (channel.unreadCount ?? 0), 0)
    const limited = options?.limit === undefined ? unread : unread.slice(0, options.limit)

    return {
      channels: limited,
      count: unread.length,
      totalUnread,
      complete: !readState.partial,
    }
  }

  async getMentions(options?: { limit?: number; guildId?: string; before?: string }): Promise<DiscordMention[]> {
    const params = new URLSearchParams()
    params.set('limit', (options?.limit ?? 25).toString())
    params.set('roles', 'true')
    params.set('everyone', 'true')

    if (options?.guildId) {
      params.set('guild_id', options.guildId)
    }
    if (options?.before) {
      params.set('before', options.before)
    }

    return this.request<DiscordMention[]>('GET', `/users/@me/mentions?${params.toString()}`)
  }

  async fetchReadState(): Promise<DiscordReadState[]> {
    return (await this.fetchReadStateSnapshot()).states
  }

  async fetchReadStateSnapshot(): Promise<DiscordReadStateSnapshot> {
    const { DiscordListener } = await import('./listener')
    const listener = new DiscordListener(this)
    try {
      await listener.start()
      const snapshot = listener.getReadStateSnapshot()
      if (snapshot === null) {
        throw new DiscordError('Discord gateway did not deliver read state', 'no_read_state')
      }
      return snapshot
    } finally {
      listener.stop()
    }
  }

  async getUnreadMentions(options?: { guildId?: string; limit?: number }): Promise<DiscordUnreadMentionsResult> {
    const limit = options?.limit ?? UNREAD_MENTIONS_MAX
    const [readState, scan] = await Promise.all([
      this.fetchReadState(),
      this.collectMentions({ guildId: options?.guildId, limit }),
    ])

    const readStateByChannel = new Map(readState.map((state) => [state.channelId, state]))

    const unread: DiscordUnreadMention[] = []
    for (const mention of scan.mentions) {
      const state = readStateByChannel.get(mention.channel_id)
      // A channel with no read-state entry is unknown, not unread: omit rather than assume unread.
      if (!state || state.mentionCount === 0) continue
      if (state.lastMessageId !== null && !isSnowflakeNewer(mention.id, state.lastMessageId)) continue
      unread.push({ ...mention, mention_count: state.mentionCount })
    }

    // READY read states carry no guild association, so badgeCount is always the
    // account-wide unread-mention total even when mentions are guild-filtered.
    const badgeCount = readState.reduce((sum, state) => sum + state.mentionCount, 0)

    return {
      mentions: unread,
      count: unread.length,
      badgeCount,
      complete: scan.complete,
      windowDays: MENTIONS_WINDOW_DAYS,
    }
  }

  private async collectMentions(options: {
    guildId?: string
    limit: number
  }): Promise<{ mentions: DiscordMention[]; complete: boolean }> {
    const collected: DiscordMention[] = []
    const seen = new Set<string>()
    let before: string | undefined

    while (collected.length < options.limit) {
      const pageSize = Math.min(MENTIONS_PAGE_SIZE, options.limit - collected.length)
      const page = await this.getMentions({ limit: pageSize, guildId: options.guildId, before })

      // An empty or short page is the natural end of history: the scan is exhaustive.
      if (page.length < pageSize) {
        for (const mention of page) {
          if (seen.has(mention.id)) continue
          seen.add(mention.id)
          collected.push(mention)
        }
        return { mentions: collected, complete: true }
      }

      let added = 0
      for (const mention of page) {
        if (collected.length >= options.limit) break
        if (seen.has(mention.id)) continue
        seen.add(mention.id)
        collected.push(mention)
        added++
      }

      // Discord returns pages newest-first; a non-advancing cursor means a repeated
      // page, so stop to avoid looping. Either way the scan did not reach history's end.
      const oldest = page[page.length - 1].id
      if (added === 0 || oldest === before) return { mentions: collected, complete: false }
      before = oldest
    }

    return { mentions: collected, complete: false }
  }

  async getUserNote(userId: string): Promise<DiscordUserNote | null> {
    try {
      return await this.request<DiscordUserNote>('GET', `/users/@me/notes/${userId}`)
    } catch (error) {
      if (error instanceof DiscordError && error.code === 'http_404') {
        return null
      }
      throw error
    }
  }

  async setUserNote(userId: string, note: string): Promise<DiscordUserNote> {
    return this.request<DiscordUserNote>('PUT', `/users/@me/notes/${userId}`, {
      note,
    })
  }

  async getRelationships(): Promise<DiscordRelationship[]> {
    return this.request<DiscordRelationship[]>('GET', '/users/@me/relationships')
  }

  async searchMembers(guildId: string, query: string, limit: number = 10): Promise<DiscordGuildMember[]> {
    const params = new URLSearchParams()
    params.set('query', query)
    params.set('limit', limit.toString())

    return this.request<DiscordGuildMember[]>('GET', `/guilds/${guildId}/members/search?${params.toString()}`)
  }

  async getMyGuildMember(guildId: string): Promise<DiscordGuildMember> {
    return this.request<DiscordGuildMember>('GET', `/users/@me/guilds/${guildId}/member`)
  }

  async listRoles(guildId: string): Promise<DiscordRole[]> {
    return this.request<DiscordRole[]>('GET', `/guilds/${guildId}/roles`)
  }

  async searchMessages(
    guildId: string,
    query: string,
    options: DiscordSearchOptions = {},
  ): Promise<{ results: DiscordSearchResult[]; total: number }> {
    const params = new URLSearchParams()
    params.set('content', query)

    if (options.channelId) {
      params.set('channel_id', options.channelId)
    }
    if (options.authorId) {
      params.set('author_id', options.authorId)
    }
    if (options.has) {
      params.set('has', options.has)
    }
    if (options.sortBy) {
      params.set('sort_by', options.sortBy)
    }
    if (options.sortOrder) {
      params.set('sort_order', options.sortOrder)
    }
    if (options.limit !== undefined) {
      params.set('limit', Math.max(1, Math.min(options.limit, 25)).toString())
    }
    if (options.offset !== undefined) {
      params.set('offset', options.offset.toString())
    }

    const path = `/guilds/${guildId}/messages/search?${params.toString()}`

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const response: unknown = await this.request('GET', path)
      const searchResponse = DiscordSearchResponseSchema.safeParse(response)

      if (searchResponse.success) {
        const results = searchResponse.data.messages
          .flat()
          .filter((msg) => msg.hit)
          .map((msg) => ({
            id: msg.id,
            channel_id: msg.channel_id,
            guild_id: msg.guild_id,
            content: msg.content,
            author: msg.author,
            timestamp: msg.timestamp,
            hit: msg.hit,
          }))

        return {
          results,
          total: searchResponse.data.total_results,
        }
      }

      const indexNotReadyResponse = DiscordSearchIndexNotReadyResponseSchema.safeParse(response)
      if (!indexNotReadyResponse.success) {
        throw new DiscordError('Discord returned an invalid search response', 'invalid_search_response')
      }

      if (attempt === MAX_RETRIES) {
        throw new DiscordError('Search index is not ready after retries', 'search_index_not_ready')
      }

      const requestedDelayMs = indexNotReadyResponse.data.retry_after * 1000
      const retryDelayMs = Math.min(
        requestedDelayMs === 0 ? BASE_BACKOFF_MS : requestedDelayMs,
        MAX_SEARCH_INDEX_RETRY_MS,
      )
      await this.sleep(retryDelayMs)
    }

    throw new DiscordError('Search failed after retries', 'max_retries')
  }

  async getUserProfile(userId: string): Promise<DiscordUserProfile> {
    return this.request<DiscordUserProfile>('GET', `/users/${userId}/profile`)
  }

  async createThread(
    channelId: string,
    name: string,
    options?: {
      auto_archive_duration?: number
      rate_limit_per_user?: number
    },
  ): Promise<DiscordChannel> {
    return this.request<DiscordChannel>('POST', `/channels/${channelId}/threads`, {
      name,
      ...options,
    })
  }

  async archiveThread(threadId: string, archived: boolean = true): Promise<DiscordChannel> {
    return this.request<DiscordChannel>('PATCH', `/channels/${threadId}`, {
      archived,
    })
  }

  async gatewayConnect(): Promise<{ token: string }> {
    return { token: this.ensureAuth() }
  }
}
