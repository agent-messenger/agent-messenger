import { ChannelBotCredentialManager } from './credential-manager'
import { wrapTextInBlocks } from './message-utils'
import type {
  ChannelBotBot,
  ChannelBotChannel,
  ChannelBotGroup,
  ChannelBotManager,
  ChannelBotMessage,
  ChannelBotUser,
  ChannelBotUserChat,
  MessageBlock,
} from './types'
import { ChannelBotError as ChannelBotErrorClass } from './types'

const BASE_URL = 'https://api.channel.io/open/v5'
const MAX_RETRIES = 3
const BASE_BACKOFF_MS = 100

interface ChannelBotFileUrlResponse {
  url: string
}

export class ChannelBotClient {
  private accessKey: string | null = null
  private accessSecret: string | null = null
  private rateLimitRemaining: number | null = null
  private rateLimitResetAt: number = 0

  async login(credentials?: { accessKey: string; accessSecret: string }): Promise<this> {
    if (credentials) {
      if (!credentials.accessKey) {
        throw new ChannelBotErrorClass('Access key is required', 'missing_access_key')
      }
      if (!credentials.accessSecret) {
        throw new ChannelBotErrorClass('Access secret is required', 'missing_access_secret')
      }
      this.accessKey = credentials.accessKey
      this.accessSecret = credentials.accessSecret
      return this
    }

    const creds = await new ChannelBotCredentialManager().getCredentials()
    if (!creds) {
      throw new ChannelBotErrorClass(
        'No Channel Talk Bot credentials found. Set access key and secret via "agent-channeltalkbot auth set".',
        'no_credentials',
      )
    }
    return this.login({ accessKey: creds.access_key, accessSecret: creds.access_secret })
  }

  private ensureAuth(): void {
    if (this.accessKey === null || this.accessSecret === null) {
      throw new ChannelBotErrorClass('Not authenticated. Call .login() first.', 'not_authenticated')
    }
  }

  static wrapTextInBlocks = wrapTextInBlocks

  async getChannel(): Promise<ChannelBotChannel> {
    return this.request<ChannelBotChannel>('GET', '/channel', undefined, 'channel')
  }

  async listUserChats(params?: {
    state?: string
    sortOrder?: string
    since?: string
    limit?: number
  }): Promise<ChannelBotUserChat[]> {
    return this.request<ChannelBotUserChat[]>('GET', this.buildPath('/user-chats', params), undefined, 'userChats')
  }

  async getUserChat(id: string): Promise<ChannelBotUserChat> {
    return this.request<ChannelBotUserChat>('GET', `/user-chats/${id}`, undefined, 'userChat')
  }

  async getUserChatMessages(
    chatId: string,
    params?: {
      sortOrder?: string
      since?: string
      limit?: number
    },
  ): Promise<ChannelBotMessage[]> {
    return this.request<ChannelBotMessage[]>(
      'GET',
      this.buildPath(`/user-chats/${chatId}/messages`, params),
      undefined,
      'messages',
    )
  }

  async sendUserChatMessage(chatId: string, blocks: MessageBlock[], botName?: string): Promise<ChannelBotMessage> {
    return this.request<ChannelBotMessage>(
      'POST',
      this.buildPath(`/user-chats/${chatId}/messages`, botName ? { botName } : undefined),
      { blocks },
      'message',
    )
  }

  async closeUserChat(chatId: string, botName: string): Promise<ChannelBotUserChat> {
    return this.request<ChannelBotUserChat>(
      'PATCH',
      this.buildPath(`/user-chats/${chatId}/close`, { botName }),
      undefined,
      'userChat',
    )
  }

  async deleteUserChat(chatId: string): Promise<void> {
    return this.request<void>('DELETE', `/user-chats/${chatId}`)
  }

  async getUserChatFileUrl(chatId: string, key: string): Promise<ChannelBotFileUrlResponse> {
    return this.request<ChannelBotFileUrlResponse>(
      'GET',
      this.buildPath(`/user-chats/${chatId}/messages/file`, { key }),
    )
  }

  async listGroups(params?: { since?: string; limit?: number }): Promise<ChannelBotGroup[]> {
    return this.request<ChannelBotGroup[]>('GET', this.buildPath('/groups', params), undefined, 'groups')
  }

  async getGroup(groupId: string): Promise<ChannelBotGroup> {
    return this.request<ChannelBotGroup>('GET', `/groups/${groupId}`, undefined, 'group')
  }

  async getGroupByName(name: string): Promise<ChannelBotGroup> {
    return this.request<ChannelBotGroup>('GET', `/groups/@${encodeURIComponent(name)}`, undefined, 'group')
  }

  async getGroupMessages(
    groupId: string,
    params?: {
      sortOrder?: string
      since?: string
      limit?: number
    },
  ): Promise<ChannelBotMessage[]> {
    return this.request<ChannelBotMessage[]>(
      'GET',
      this.buildPath(`/groups/${groupId}/messages`, params),
      undefined,
      'messages',
    )
  }

  async sendGroupMessage(groupId: string, blocks: MessageBlock[], botName?: string): Promise<ChannelBotMessage> {
    return this.request<ChannelBotMessage>(
      'POST',
      this.buildPath(`/groups/${groupId}/messages`, botName ? { botName } : undefined),
      { blocks },
      'message',
    )
  }

  async getGroupFileUrl(groupId: string, key: string): Promise<ChannelBotFileUrlResponse> {
    return this.request<ChannelBotFileUrlResponse>('GET', this.buildPath(`/groups/${groupId}/messages/file`, { key }))
  }

  async resolveGroup(groupIdOrName: string): Promise<ChannelBotGroup> {
    if (groupIdOrName.startsWith('@')) {
      return this.getGroupByName(groupIdOrName.slice(1))
    }
    return this.getGroup(groupIdOrName)
  }

  async listManagers(params?: { since?: string; limit?: number }): Promise<ChannelBotManager[]> {
    return this.request<ChannelBotManager[]>('GET', this.buildPath('/managers', params), undefined, 'managers')
  }

  async getManager(id: string): Promise<ChannelBotManager> {
    return this.request<ChannelBotManager>('GET', `/managers/${id}`, undefined, 'manager')
  }

  async listBots(params?: { since?: string; limit?: number }): Promise<ChannelBotBot[]> {
    return this.request<ChannelBotBot[]>('GET', this.buildPath('/bots', params), undefined, 'bots')
  }

  async createBot(name: string, options?: { color?: string; avatarUrl?: string }): Promise<ChannelBotBot> {
    return this.request<ChannelBotBot>(
      'POST',
      '/bots',
      {
        name,
        ...options,
      },
      'bot',
    )
  }

  async deleteBot(botId: string): Promise<void> {
    return this.request<void>('DELETE', `/bots/${botId}`)
  }

  async listUsers(params?: { since?: string; limit?: number }): Promise<ChannelBotUser[]> {
    return this.request<ChannelBotUser[]>('GET', this.buildPath('/users', params), undefined, 'users')
  }

  async getUser(id: string): Promise<ChannelBotUser> {
    return this.request<ChannelBotUser>('GET', `/users/${id}`, undefined, 'user')
  }

  private getHeaders(): Record<string, string> {
    return {
      'x-access-key': this.accessKey!,
      'x-access-secret': this.accessSecret!,
      'Content-Type': 'application/json',
    }
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now()
    if (this.rateLimitRemaining === 0 && this.rateLimitResetAt > now) {
      await this.sleep(this.rateLimitResetAt - now)
    }
  }

  private updateRateLimit(response: Response): void {
    const remainingHeader = response.headers.get('x-ratelimit-remaining')
    const resetHeader = response.headers.get('x-ratelimit-reset')

    if (remainingHeader !== null) {
      const remaining = Number.parseInt(remainingHeader, 10)
      if (!Number.isNaN(remaining)) {
        this.rateLimitRemaining = remaining
      }
    }

    if (resetHeader !== null) {
      const reset = Number.parseFloat(resetHeader)
      if (!Number.isNaN(reset)) {
        this.rateLimitResetAt = reset > 1_000_000_000_000 ? reset : reset * 1000
      }
    }
  }

  private async request<T>(method: string, path: string, body?: unknown, unwrapKey?: string): Promise<T> {
    this.ensureAuth()
    const url = `${BASE_URL}${path}`
    let lastError: Error | undefined

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      await this.waitForRateLimit()

      const options: RequestInit = {
        method,
        headers: this.getHeaders(),
      }

      if (body !== undefined) {
        options.body = JSON.stringify(body)
      }

      let response: Response

      try {
        response = await fetch(url, options)
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        if (attempt < MAX_RETRIES && method === 'GET') {
          await this.sleep(BASE_BACKOFF_MS * 2 ** attempt)
          continue
        }
        throw new ChannelBotErrorClass(`Network error: ${lastError.message}`, 'network_error')
      }

      this.updateRateLimit(response)

      if (response.status === 429) {
        if (attempt < MAX_RETRIES) {
          const retryAfter = Number.parseFloat(response.headers.get('Retry-After') || '1')
          const retryAfterMs = (Number.isNaN(retryAfter) ? 1 : retryAfter) * 1000
          await this.sleep(retryAfterMs)
          continue
        }
        throw new ChannelBotErrorClass('Rate limited', 'rate_limited')
      }

      if (response.status >= 500 && response.status <= 599) {
        if (attempt < MAX_RETRIES && method === 'GET') {
          await this.sleep(BASE_BACKOFF_MS * 2 ** attempt)
          continue
        }

        const errorBody = (await response.json().catch(() => ({}))) as {
          message?: string
          code?: string
        }
        throw new ChannelBotErrorClass(
          errorBody.message || `HTTP ${response.status}`,
          errorBody.code || `http_${response.status}`,
        )
      }

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({}))) as {
          message?: string
          code?: string
        }
        throw new ChannelBotErrorClass(
          errorBody.message || `HTTP ${response.status}`,
          errorBody.code || `http_${response.status}`,
        )
      }

      if (response.status === 204) {
        return undefined as T
      }

      const data = await response.json()
      if (unwrapKey && data != null && typeof data === 'object' && unwrapKey in data) {
        return (data as Record<string, unknown>)[unwrapKey] as T
      }
      return data as T
    }

    throw lastError || new ChannelBotErrorClass('Request failed after retries', 'max_retries')
  }

  private buildPath(path: string, params?: Record<string, string | number | undefined>): string {
    if (!params) {
      return path
    }

    const searchParams = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        searchParams.set(key, String(value))
      }
    }

    const query = searchParams.toString()
    if (!query) {
      return path
    }

    return `${path}?${query}`
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
