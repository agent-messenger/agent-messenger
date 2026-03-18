import type {
  Channel,
  ChannelAccount,
  ChannelBot,
  ChannelDirectChat,
  ChannelGroup,
  ChannelManager,
  ChannelMessage,
  ChannelUserChat,
  MessageBlock,
} from './types'
import { ChannelError } from './types'

const BASE_URL = 'https://desk-api.channel.io'
const MAX_RETRIES = 3
const BASE_BACKOFF_MS = 100

interface ChannelApiErrorResponse {
  type?: string
  status?: number
  errors?: Array<{ message?: string }>
}

export class ChannelClient {
  private accountCookie: string
  private sessionCookie: string | undefined
  private rateLimitRemaining: number | null = null
  private rateLimitResetAt = 0

  constructor(accountCookie: string, sessionCookie?: string) {
    if (!accountCookie) {
      throw new ChannelError('Account cookie is required', 'missing_account_cookie')
    }

    this.accountCookie = accountCookie
    this.sessionCookie = sessionCookie
  }

  static wrapTextInBlocks(text: string): MessageBlock[] {
    return [{ type: 'text', value: text }]
  }

  static extractText(message: ChannelMessage): string {
    const parts: string[] = []

    for (const block of message.blocks ?? []) {
      if (block.value) {
        parts.push(block.value)
      }
    }

    if (message.plainText) {
      parts.push(message.plainText)
    }

    return parts.join('\n')
  }

  async getAccount(): Promise<ChannelAccount> {
    return this.request<ChannelAccount>('GET', '/desk/account', undefined, 'account')
  }

  async listChannels(params?: { limit?: number }): Promise<Channel[]> {
    return this.request<Channel[]>('GET', this.buildPath('/desk/channels', params), undefined, 'channels')
  }

  async getChannel(channelId: string): Promise<Channel> {
    return this.request<Channel>('GET', `/desk/channels/${channelId}`, undefined, 'channel')
  }

  async listManagers(channelId: string, params?: { limit?: number }): Promise<ChannelManager[]> {
    return this.request<ChannelManager[]>(
      'GET',
      this.buildPath(`/desk/channels/${channelId}/managers`, params),
      undefined,
      'managers',
    )
  }

  async getManagerRole(channelId: string): Promise<{ permissions: unknown[] }> {
    return this.request<{ permissions: unknown[] }>('GET', `/desk/channels/${channelId}/managers/me/role`, undefined, 'role')
  }

  async listGroups(channelId: string, params?: { limit?: number }): Promise<ChannelGroup[]> {
    return this.request<ChannelGroup[]>('GET', this.buildPath(`/desk/channels/${channelId}/groups`, params), undefined, 'groups')
  }

  async getGroup(channelId: string, groupId: string): Promise<ChannelGroup> {
    return this.request<ChannelGroup>('GET', `/desk/channels/${channelId}/groups/${groupId}`, undefined, 'group')
  }

  async getGroupMessages(
    channelId: string,
    groupId: string,
    params?: { sortOrder?: string; limit?: number; since?: string },
  ): Promise<ChannelMessage[]> {
    return this.request<ChannelMessage[]>(
      'GET',
      this.buildPath(`/desk/channels/${channelId}/groups/${groupId}/messages`, params),
      undefined,
      'messages',
    )
  }

  async sendGroupMessage(
    channelId: string,
    groupId: string,
    blocks: MessageBlock[],
    requestId?: string,
  ): Promise<ChannelMessage> {
    return this.request<ChannelMessage>(
      'POST',
      `/desk/channels/${channelId}/groups/${groupId}/messages`,
      { blocks, requestId: requestId ?? crypto.randomUUID() },
      'message',
    )
  }

  async listDirectChats(channelId: string, params?: { limit?: number }): Promise<ChannelDirectChat[]> {
    return this.request<ChannelDirectChat[]>(
      'GET',
      this.buildPath(`/desk/channels/${channelId}/direct-chats`, params),
      undefined,
      'directChats',
    )
  }

  async getDirectChatMessages(
    channelId: string,
    chatId: string,
    params?: { sortOrder?: string; limit?: number },
  ): Promise<ChannelMessage[]> {
    return this.request<ChannelMessage[]>(
      'GET',
      this.buildPath(`/desk/channels/${channelId}/direct-chats/${chatId}/messages`, params),
      undefined,
      'messages',
    )
  }

  async sendDirectChatMessage(
    channelId: string,
    chatId: string,
    blocks: MessageBlock[],
    requestId?: string,
  ): Promise<ChannelMessage> {
    return this.request<ChannelMessage>(
      'POST',
      `/desk/channels/${channelId}/direct-chats/${chatId}/messages`,
      { blocks, requestId: requestId ?? crypto.randomUUID() },
      'message',
    )
  }

  async listUserChats(channelId: string, params?: { state?: string; limit?: number }): Promise<ChannelUserChat[]> {
    return this.request<ChannelUserChat[]>(
      'GET',
      this.buildPath(`/desk/channels/${channelId}/user-chats/assigned/me`, params),
      undefined,
      'userChats',
    )
  }

  async getUserChat(channelId: string, chatId: string): Promise<ChannelUserChat> {
    return this.request<ChannelUserChat>('GET', `/desk/channels/${channelId}/user-chats/${chatId}`, undefined, 'userChat')
  }

  async getUserChatMessages(
    channelId: string,
    chatId: string,
    params?: { sortOrder?: string; limit?: number },
  ): Promise<ChannelMessage[]> {
    return this.request<ChannelMessage[]>(
      'GET',
      this.buildPath(`/desk/channels/${channelId}/user-chats/${chatId}/messages`, params),
      undefined,
      'messages',
    )
  }

  async sendUserChatMessage(
    channelId: string,
    chatId: string,
    blocks: MessageBlock[],
    requestId?: string,
  ): Promise<ChannelMessage> {
    return this.request<ChannelMessage>(
      'POST',
      `/desk/channels/${channelId}/user-chats/${chatId}/messages`,
      { blocks, requestId: requestId ?? crypto.randomUUID() },
      'message',
    )
  }

  async listBots(channelId: string, params?: { limit?: number }): Promise<ChannelBot[]> {
    return this.request<ChannelBot[]>('GET', this.buildPath(`/desk/channels/${channelId}/bots`, params), undefined, 'bots')
  }

  private getHeaders(): Record<string, string> {
    return {
      Cookie: this.sessionCookie
        ? `x-account=${this.accountCookie}; ch-session-1=${this.sessionCookie}`
        : `x-account=${this.accountCookie}`,
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
        throw new ChannelError(`Network error: ${lastError.message}`, 'network_error')
      }

      this.updateRateLimit(response)

      if (response.status === 429) {
        if (attempt < MAX_RETRIES) {
          const retryAfter = Number.parseFloat(response.headers.get('Retry-After') || '1')
          const retryAfterMs = (Number.isNaN(retryAfter) ? 1 : retryAfter) * 1000
          await this.sleep(retryAfterMs)
          continue
        }
        throw new ChannelError('Rate limited', 'rate_limited')
      }

      if (response.status >= 500 && response.status <= 599) {
        if (attempt < MAX_RETRIES && method === 'GET') {
          await this.sleep(BASE_BACKOFF_MS * 2 ** attempt)
          continue
        }

        throw await this.createHttpError(response)
      }

      if (!response.ok) {
        throw await this.createHttpError(response)
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

    throw lastError || new ChannelError('Request failed after retries', 'max_retries')
  }

  private async createHttpError(response: Response): Promise<ChannelError> {
    const errorBody = await response.json().catch(() => ({})) as ChannelApiErrorResponse
    const message = errorBody.errors?.[0]?.message || `HTTP ${response.status}`
    const code = errorBody.type || `http_${response.status}`
    return new ChannelError(message, code)
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
