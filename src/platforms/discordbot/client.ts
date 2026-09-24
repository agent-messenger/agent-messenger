import {
  createMessage as createMessageHelper,
  findFile as findFileHelper,
  listFiles as listFilesHelper,
  uploadFile as uploadFileHelper,
} from './client-message'
import { listThreads as listThreadsHelper, resolveThread as resolveThreadHelper } from './client-threads'
import type {
  DiscordChannel,
  DiscordCreateMessageOptions,
  DiscordFile,
  DiscordGuild,
  DiscordMessage,
  DiscordUser,
} from './types'
import { DiscordBotError } from './types'

const BASE_URL = 'https://discord.com/api/v10'
const MAX_RETRIES = 3
const BASE_BACKOFF_MS = 100

interface RateLimitBucket {
  remaining: number
  resetAt: number
  bucketHash: string
}

export class DiscordBotClient {
  private token: string | null = null
  private buckets: Map<string, RateLimitBucket> = new Map()
  private globalRateLimitUntil: number = 0

  async login(credentials?: { token: string }): Promise<this> {
    if (credentials) {
      if (!credentials.token) {
        throw new DiscordBotError('Token is required', 'missing_token')
      }
      this.token = credentials.token
      return this
    }

    const { DiscordBotCredentialManager } = await import('./credential-manager')
    const credManager = new DiscordBotCredentialManager()
    const creds = await credManager.getCredentials()
    if (!creds?.token) {
      throw new DiscordBotError('No Discord bot credentials found. Run "auth set <token>" first.', 'no_credentials')
    }
    return this.login({ token: creds.token })
  }

  private ensureAuth(): string {
    if (!this.token) {
      throw new DiscordBotError('Not authenticated. Call .login() first.', 'not_authenticated')
    }
    return this.token
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bot ${this.ensureAuth()}`,
      'User-Agent': 'DiscordBot (https://github.com/agent-messenger/agent-messenger, 1.0)',
      'Content-Type': 'application/json',
    }
  }

  private getBucketKey(method: string, path: string): string {
    const normalized = path
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

  private handleErrorResponse(response: Response, errorBody: Record<string, string | number>): never {
    if (errorBody.code === 40005 || response.status === 413) {
      throw new DiscordBotError(
        'File(s) too large for this server upload limit (Discord error 40005)',
        errorBody.code?.toString() ?? 'http_413',
      )
    }

    throw new DiscordBotError(
      (errorBody.message as string) || `HTTP ${response.status}`,
      errorBody.code?.toString() || `http_${response.status}`,
    )
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${BASE_URL}${path}`
    const bucketKey = this.getBucketKey(method, path)
    let lastError: Error | undefined

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      await this.waitForRateLimit(bucketKey)

      const headers: Record<string, string> = this.getHeaders()

      const options: RequestInit = {
        method,
        headers,
      }

      if (body !== undefined) {
        options.body = JSON.stringify(body)
      }

      let response: Response
      try {
        response = await fetch(url, options)
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        if (attempt < MAX_RETRIES) {
          await this.sleep(BASE_BACKOFF_MS * 2 ** attempt)
          continue
        }
        throw new DiscordBotError(`Network error: ${lastError.message}`, 'network_error')
      }

      this.updateBucket(bucketKey, response)

      if (response.status === 429) {
        if (attempt < MAX_RETRIES) {
          await this.handleRateLimitResponse(response)
          continue
        }
        const errorBody = await response.json().catch(() => ({}))
        throw new DiscordBotError((errorBody as Record<string, string>).message || 'Rate limited', 'rate_limited')
      }

      if (response.status >= 500 && attempt < MAX_RETRIES) {
        await this.sleep(BASE_BACKOFF_MS * 2 ** attempt)
        continue
      }

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        this.handleErrorResponse(response, errorBody as Record<string, string | number>)
      }

      if (response.status === 204) {
        return undefined as T
      }

      return response.json() as Promise<T>
    }

    throw lastError || new DiscordBotError('Request failed after retries', 'max_retries')
  }

  private async requestFormData<T>(path: string, formData: FormData): Promise<T> {
    const url = `${BASE_URL}${path}`
    const bucketKey = this.getBucketKey('POST', path)
    let lastError: Error | undefined

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      await this.waitForRateLimit(bucketKey)

      const headers: Record<string, string> = {
        Authorization: `Bot ${this.ensureAuth()}`,
        'User-Agent': 'DiscordBot (https://github.com/agent-messenger/agent-messenger, 1.0)',
      }

      let response: Response
      try {
        response = await fetch(url, {
          method: 'POST',
          headers,
          body: formData,
        })
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        if (attempt < MAX_RETRIES) {
          await this.sleep(BASE_BACKOFF_MS * 2 ** attempt)
          continue
        }
        throw new DiscordBotError(`Network error: ${lastError.message}`, 'network_error')
      }

      this.updateBucket(bucketKey, response)

      if (response.status === 429) {
        if (attempt < MAX_RETRIES) {
          await this.handleRateLimitResponse(response)
          continue
        }
        const errorBody = await response.json().catch(() => ({}))
        throw new DiscordBotError((errorBody as Record<string, string>).message || 'Rate limited', 'rate_limited')
      }

      if (response.status >= 500 && attempt < MAX_RETRIES) {
        await this.sleep(BASE_BACKOFF_MS * 2 ** attempt)
        continue
      }

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        this.handleErrorResponse(response, errorBody as Record<string, string | number>)
      }

      return response.json() as Promise<T>
    }

    throw lastError || new DiscordBotError('Request failed after retries', 'max_retries')
  }

  async testAuth(): Promise<DiscordUser> {
    return this.request<DiscordUser>('GET', '/users/@me')
  }

  async listGuilds(): Promise<DiscordGuild[]> {
    return this.request<DiscordGuild[]>('GET', '/users/@me/guilds')
  }

  async getGuild(guildId: string): Promise<DiscordGuild> {
    return this.request<DiscordGuild>('GET', `/guilds/${guildId}`)
  }

  async listChannels(guildId: string): Promise<DiscordChannel[]> {
    return this.request<DiscordChannel[]>('GET', `/guilds/${guildId}/channels`)
  }

  async getChannel(channelId: string): Promise<DiscordChannel> {
    return this.request<DiscordChannel>('GET', `/channels/${channelId}`)
  }

  async createMessage(channelId: string, options: DiscordCreateMessageOptions): Promise<DiscordMessage> {
    return createMessageHelper(
      (method, path, body) => this.request(method, path, body),
      (path, formData) => this.requestFormData(path, formData),
      channelId,
      options,
    )
  }

  async sendMessage(
    channelId: string,
    content: string,
    options?: { thread_id?: string; reply_to?: string },
  ): Promise<DiscordMessage> {
    return this.createMessage(channelId, { content, thread_id: options?.thread_id, reply_to: options?.reply_to })
  }

  async getMessages(channelId: string, limit: number = 50): Promise<DiscordMessage[]> {
    return this.request<DiscordMessage[]>('GET', `/channels/${channelId}/messages?limit=${limit}`)
  }

  async getMessage(channelId: string, messageId: string): Promise<DiscordMessage> {
    return this.request<DiscordMessage>('GET', `/channels/${channelId}/messages/${messageId}`)
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

  async listUsers(guildId: string): Promise<DiscordUser[]> {
    interface GuildMember {
      user: DiscordUser
    }
    const members = await this.request<GuildMember[]>('GET', `/guilds/${guildId}/members?limit=1000`)
    return members.map((m) => m.user)
  }

  async getUser(userId: string): Promise<DiscordUser> {
    return this.request<DiscordUser>('GET', `/users/${userId}`)
  }

  async uploadFile(
    channelId: string,
    filePath: string,
    options?: { content?: string; filename?: string; reply_to?: string; thread_id?: string },
  ): Promise<DiscordFile> {
    return uploadFileHelper(
      (id, messageOptions) => this.createMessage(id, messageOptions),
      channelId,
      filePath,
      options,
    )
  }

  async listFiles(channelId: string): Promise<DiscordFile[]> {
    return listFilesHelper((method, path, body) => this.request(method, path, body), channelId)
  }

  async findFile(channelId: string, fileId: string): Promise<DiscordFile | undefined> {
    return findFileHelper((method, path, body) => this.request(method, path, body), channelId, fileId)
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
    return this.request<DiscordChannel>('PATCH', `/channels/${threadId}`, { archived })
  }

  async gatewayConnect(): Promise<{ token: string }> {
    return { token: this.ensureAuth() }
  }

  async resolveChannel(guildId: string, channel: string): Promise<string> {
    if (/^\d+$/.test(channel)) return channel

    const channels = await this.listChannels(guildId)
    const found = channels.find((c) => c.name === channel || c.name === channel.replace(/^#/, ''))
    if (!found) {
      throw new DiscordBotError(
        `Channel not found: "${channel}". Use channel ID or exact channel name.`,
        'channel_not_found',
      )
    }
    return found.id
  }

  async listThreads(guildId: string, options?: { parentId?: string; archived?: boolean }) {
    return listThreadsHelper({ request: (method, path, body) => this.request(method, path, body) }, guildId, options)
  }

  async resolveThread(guildId: string, parentChannelId: string, thread: string) {
    return resolveThreadHelper(
      { request: (method, path, body) => this.request(method, path, body) },
      guildId,
      parentChannelId,
      thread,
    )
  }
}
