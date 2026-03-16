import { readFile } from 'node:fs/promises'

import type { DiscordChannel, DiscordFile, DiscordGuild, DiscordMessage, DiscordUser } from './types'
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
  private token: string
  private buckets: Map<string, RateLimitBucket> = new Map()
  private globalRateLimitUntil: number = 0

  constructor(token: string) {
    if (!token) {
      throw new DiscordBotError('Token is required', 'missing_token')
    }
    this.token = token
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bot ${this.token}`,
      'User-Agent': 'DiscordBot (https://github.com/devxoul/agent-messenger, 1.0)',
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
        Authorization: `Bot ${this.token}`,
        'User-Agent': 'DiscordBot (https://github.com/devxoul/agent-messenger, 1.0)',
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

  async sendMessage(channelId: string, content: string, options?: { thread_id?: string }): Promise<DiscordMessage> {
    const body: Record<string, string> = { content }
    if (options?.thread_id) {
      body.thread_id = options.thread_id
    }
    return this.request<DiscordMessage>('POST', `/channels/${channelId}/messages`, body)
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

  async uploadFile(channelId: string, filePath: string): Promise<DiscordFile> {
    const fileBuffer = await readFile(filePath)
    const filename = filePath.split('/').pop() || 'file'

    const formData = new FormData()
    formData.append('files[0]', new Blob([fileBuffer]), filename)

    interface MessageWithAttachments extends DiscordMessage {
      attachments: DiscordFile[]
    }
    const message = await this.requestFormData<MessageWithAttachments>(`/channels/${channelId}/messages`, formData)

    if (!message.attachments || message.attachments.length === 0) {
      throw new DiscordBotError('Upload succeeded but no attachments returned', 'no_attachments')
    }

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
}
