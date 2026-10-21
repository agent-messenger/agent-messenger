import { isPreSendHookConfigured, runPreSendHook, type PreSendEvent } from '@/shared/pre-send-hook'
import { resolve } from 'node:path'

import { readFile } from 'node:fs/promises'

import type {
  TelegramBotUser,
  TelegramChat,
  TelegramChatFullInfo,
  TelegramChatMember,
  TelegramMessage,
  TelegramReactionType,
  TelegramUpdate,
} from './types'
import { TelegramBotError } from './types'

const BASE_URL = 'https://api.telegram.org'
const MAX_RETRIES = 3
const BASE_BACKOFF_MS = 100

interface ApiResponse<T> {
  ok: boolean
  result?: T
  description?: string
  error_code?: number
  parameters?: {
    retry_after?: number
    migrate_to_chat_id?: number
  }
}

export interface SendMessageOptions {
  parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2'
  disable_web_page_preview?: boolean
  disable_notification?: boolean
  protect_content?: boolean
  reply_to_message_id?: number
  message_thread_id?: number
}

export interface GetUpdatesOptions {
  offset?: number
  limit?: number
  timeout?: number
  allowed_updates?: string[]
}

export interface EditMessageTextChat {
  chat_id: number | string
  message_id: number
  inline_message_id?: never
}

export interface EditMessageTextInline {
  inline_message_id: string
  chat_id?: never
  message_id?: never
}

export type EditMessageTextTarget = EditMessageTextChat | EditMessageTextInline

export type BotReactionType = { type: 'emoji'; emoji: string }

export type ChatId = number | string

export class TelegramBotClient {
  private token: string | null = null

  async login(credentials?: { token: string }): Promise<this> {
    if (credentials) {
      if (!credentials.token) {
        throw new TelegramBotError('Token is required', 'missing_token')
      }
      this.token = credentials.token
      return this
    }

    const { TelegramBotCredentialManager } = await import('./credential-manager')
    const credManager = new TelegramBotCredentialManager()
    const creds = await credManager.getCredentials()
    if (!creds?.token) {
      throw new TelegramBotError('No Telegram bot credentials found. Run "auth set <token>" first.', 'no_credentials')
    }
    return this.login({ token: creds.token })
  }

  private async authorizeWrite(event: PreSendEvent): Promise<void> {
    if (!(await isPreSendHookConfigured())) return
    const target = event.target.kind !== 'resource' && !/^-?\d+$/.test(event.target.id)
      ? { ...event.target, id: String((await this.getChat(event.target.id)).id) }
      : event.target
    const account = this.token?.match(/^\d+(?=:)/)?.[0]
    await runPreSendHook({ ...event, account, target })
  }

  private ensureAuth(): string {
    if (!this.token) {
      throw new TelegramBotError('Not authenticated. Call .login() first.', 'not_authenticated')
    }
    return this.token
  }

  private buildUrl(method: string): string {
    return `${BASE_URL}/bot${this.ensureAuth()}/${method}`
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private isAbort(signal: AbortSignal | undefined, error: unknown): boolean {
    if (signal?.aborted) return true
    const name = (error as { name?: string } | null)?.name
    return name === 'AbortError'
  }

  private throwApiError(method: string, body: ApiResponse<unknown>): never {
    const code = body.error_code
    const description = body.description ?? `HTTP error from ${method}`
    if (code === 401) {
      throw new TelegramBotError(`Unauthorized: ${description}`, 'unauthorized')
    }
    if (code === 409) {
      throw new TelegramBotError(`Conflict: ${description}`, 'conflict')
    }
    if (code === 403) {
      throw new TelegramBotError(`Forbidden: ${description}`, 'forbidden')
    }
    if (code === 400) {
      throw new TelegramBotError(`Bad Request: ${description}`, 'bad_request')
    }
    if (code === 404) {
      throw new TelegramBotError(`Not Found: ${description}`, 'not_found')
    }
    throw new TelegramBotError(description, code !== undefined ? `http_${code}` : 'http_error')
  }

  private async parseJsonOrRetry<T>(
    response: Response,
    method: string,
    attempt: number,
  ): Promise<{ body: ApiResponse<T> } | { retry: true }> {
    try {
      const body = (await response.json()) as ApiResponse<T>
      return { body }
    } catch {
      // 5xx responses sometimes return HTML/empty bodies; allow retry instead of failing fast.
      if (response.status >= 500 && attempt < MAX_RETRIES) {
        return { retry: true }
      }
      throw new TelegramBotError(`Invalid JSON response from ${method} (HTTP ${response.status})`, 'invalid_response')
    }
  }

  private async call<T>(method: string, params?: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
    return this.requestJson<T>(method, { method: 'POST', body: params }, signal)
  }

  private async requestJson<T>(
    method: string,
    request: { method: 'POST' | 'GET'; body?: Record<string, unknown> },
    signal?: AbortSignal,
  ): Promise<T> {
    const url = this.buildUrl(method)
    let lastError: Error | undefined

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (signal?.aborted) {
        throw Object.assign(new Error('Aborted'), { name: 'AbortError' })
      }

      const init: RequestInit = {
        method: request.method,
        headers: { 'Content-Type': 'application/json' },
        body: request.body ? JSON.stringify(request.body) : undefined,
        signal,
      }

      let response: Response
      try {
        response = await fetch(url, init)
      } catch (error) {
        if (this.isAbort(signal, error)) {
          throw error instanceof Error ? error : Object.assign(new Error('Aborted'), { name: 'AbortError' })
        }
        lastError = error instanceof Error ? error : new Error(String(error))
        if (attempt < MAX_RETRIES) {
          await this.sleep(BASE_BACKOFF_MS * 2 ** attempt)
          continue
        }
        throw new TelegramBotError(`Network error: ${lastError.message}`, 'network_error')
      }

      const parsed = await this.parseJsonOrRetry<T>(response, method, attempt)
      if ('retry' in parsed) {
        await this.sleep(BASE_BACKOFF_MS * 2 ** attempt)
        continue
      }
      const { body } = parsed

      if (response.status === 429 || body.error_code === 429) {
        const retryAfter = body.parameters?.retry_after ?? 1
        if (attempt < MAX_RETRIES) {
          await this.sleep(retryAfter * 1000)
          continue
        }
        throw new TelegramBotError(body.description ?? 'Rate limited', 'rate_limited')
      }

      if (response.status >= 500 && attempt < MAX_RETRIES) {
        await this.sleep(BASE_BACKOFF_MS * 2 ** attempt)
        continue
      }

      if (!body.ok) {
        this.throwApiError(method, body)
      }

      if (body.result === undefined) {
        return undefined as T
      }
      return body.result
    }

    throw lastError ?? new TelegramBotError('Request failed after retries', 'max_retries')
  }

  private async callMultipart<T>(method: string, formData: FormData, signal?: AbortSignal): Promise<T> {
    const url = this.buildUrl(method)
    let lastError: Error | undefined

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (signal?.aborted) {
        throw Object.assign(new Error('Aborted'), { name: 'AbortError' })
      }

      let response: Response
      try {
        response = await fetch(url, { method: 'POST', body: formData, signal })
      } catch (error) {
        if (this.isAbort(signal, error)) {
          throw error instanceof Error ? error : Object.assign(new Error('Aborted'), { name: 'AbortError' })
        }
        lastError = error instanceof Error ? error : new Error(String(error))
        if (attempt < MAX_RETRIES) {
          await this.sleep(BASE_BACKOFF_MS * 2 ** attempt)
          continue
        }
        throw new TelegramBotError(`Network error: ${lastError.message}`, 'network_error')
      }

      const parsed = await this.parseJsonOrRetry<T>(response, method, attempt)
      if ('retry' in parsed) {
        await this.sleep(BASE_BACKOFF_MS * 2 ** attempt)
        continue
      }
      const { body } = parsed

      if (response.status === 429 || body.error_code === 429) {
        const retryAfter = body.parameters?.retry_after ?? 1
        if (attempt < MAX_RETRIES) {
          await this.sleep(retryAfter * 1000)
          continue
        }
        throw new TelegramBotError(body.description ?? 'Rate limited', 'rate_limited')
      }

      if (response.status >= 500 && attempt < MAX_RETRIES) {
        await this.sleep(BASE_BACKOFF_MS * 2 ** attempt)
        continue
      }

      if (!body.ok) {
        this.throwApiError(method, body)
      }

      if (body.result === undefined) {
        return undefined as T
      }
      return body.result
    }

    throw lastError ?? new TelegramBotError('Request failed after retries', 'max_retries')
  }

  async getMe(): Promise<TelegramBotUser> {
    return this.call<TelegramBotUser>('getMe')
  }

  async getChat(chatId: ChatId): Promise<TelegramChatFullInfo> {
    return this.call<TelegramChatFullInfo>('getChat', { chat_id: chatId })
  }

  async getChatMember(chatId: ChatId, userId: number): Promise<TelegramChatMember> {
    return this.call<TelegramChatMember>('getChatMember', { chat_id: chatId, user_id: userId })
  }

  async getChatMemberCount(chatId: ChatId): Promise<number> {
    return this.call<number>('getChatMemberCount', { chat_id: chatId })
  }

  async sendMessage(chatId: ChatId, text: string, options?: SendMessageOptions): Promise<TelegramMessage> {
    await this.authorizeWrite({ version: 1, platform: 'telegrambot', action: (options?.reply_to_message_id ? 'reply' : 'send'), target: { id: String(chatId), threadId: options?.message_thread_id === undefined ? undefined : String(options.message_thread_id) }, text, })
    return this.call<TelegramMessage>('sendMessage', { chat_id: chatId, text, ...options })
  }

  async sendPhoto(
    chatId: ChatId,
    photo: string,
    options?: { caption?: string; parse_mode?: SendMessageOptions['parse_mode'] },
  ): Promise<TelegramMessage> {
    await this.authorizeWrite({ version: 1, platform: 'telegrambot', action: 'send', target: { id: String(chatId) }, text: options?.caption, })
    return this.call<TelegramMessage>('sendPhoto', { chat_id: chatId, photo, ...options })
  }

  async sendDocument(
    chatId: ChatId,
    filePath: string,
    options?: { caption?: string; parse_mode?: SendMessageOptions['parse_mode']; signal?: AbortSignal },
  ): Promise<TelegramMessage> {
    await this.authorizeWrite({ version: 1, platform: 'telegrambot', action: 'upload', target: { id: String(chatId) }, text: options?.caption, files: [resolve(filePath)], })
    const fileBuffer = await readFile(filePath)
    const filename = filePath.split('/').pop() || 'file'

    const formData = new FormData()
    formData.append('chat_id', String(chatId))
    formData.append('document', new Blob([new Uint8Array(fileBuffer)]), filename)
    if (options?.caption !== undefined) formData.append('caption', options.caption)
    if (options?.parse_mode !== undefined) formData.append('parse_mode', options.parse_mode)

    return this.callMultipart<TelegramMessage>('sendDocument', formData, options?.signal)
  }

  async forwardMessage(
    chatId: ChatId,
    fromChatId: ChatId,
    messageId: number,
    options?: { disable_notification?: boolean; protect_content?: boolean; message_thread_id?: number },
  ): Promise<TelegramMessage> {
    await this.authorizeWrite({ version: 1, platform: 'telegrambot', action: 'forward', target: { id: String(chatId), threadId: options?.message_thread_id === undefined ? undefined : String(options.message_thread_id) },  })
    return this.call<TelegramMessage>('forwardMessage', {
      chat_id: chatId,
      from_chat_id: fromChatId,
      message_id: messageId,
      ...options,
    })
  }

  async editMessageText(
    target: EditMessageTextTarget,
    text: string,
    options?: SendMessageOptions,
  ): Promise<TelegramMessage | true> {
    await this.authorizeWrite({ version: 1, platform: 'telegrambot', action: 'edit', target: { id: String(target.chat_id ?? target.inline_message_id ?? ''), kind: target.inline_message_id ? 'resource' : 'chat' }, text, })
    return this.call<TelegramMessage | true>('editMessageText', { ...target, text, ...options })
  }

  async deleteMessage(chatId: ChatId, messageId: number): Promise<boolean> {
    await this.authorizeWrite({ version: 1, platform: 'telegrambot', action: 'delete', target: { id: String(chatId) },  })
    return this.call<boolean>('deleteMessage', { chat_id: chatId, message_id: messageId })
  }

  async setMessageReaction(
    chatId: ChatId,
    messageId: number,
    reaction: BotReactionType[],
    options?: { is_big?: boolean },
  ): Promise<boolean> {
    await this.authorizeWrite({ version: 1, platform: 'telegrambot', action: 'react', target: { id: String(chatId) },  })
    return this.call<boolean>('setMessageReaction', {
      chat_id: chatId,
      message_id: messageId,
      reaction,
      ...options,
    })
  }

  async setMessageReactionRaw(
    chatId: ChatId,
    messageId: number,
    reaction: TelegramReactionType[],
    options?: { is_big?: boolean },
  ): Promise<boolean> {
    await this.authorizeWrite({ version: 1, platform: 'telegrambot', action: 'react', target: { id: String(chatId) },  })
    return this.call<boolean>('setMessageReaction', {
      chat_id: chatId,
      message_id: messageId,
      reaction,
      ...options,
    })
  }

  async getUpdates(options?: GetUpdatesOptions, signal?: AbortSignal): Promise<TelegramUpdate[]> {
    const params: Record<string, unknown> = {}
    if (options?.offset !== undefined) params.offset = options.offset
    if (options?.limit !== undefined) params.limit = options.limit
    if (options?.timeout !== undefined) params.timeout = options.timeout
    if (options?.allowed_updates !== undefined) params.allowed_updates = options.allowed_updates
    return this.call<TelegramUpdate[]>('getUpdates', params, signal)
  }

  async deleteWebhook(options?: { drop_pending_updates?: boolean }): Promise<boolean> {
    await this.authorizeWrite({ version: 1, platform: 'telegrambot', action: 'delete', target: { id: 'webhook', kind: 'resource' },  })
    return this.call<boolean>('deleteWebhook', options)
  }

  async setWebhook(url: string, options?: Record<string, unknown>): Promise<boolean> {
    const body = { url, ...options }
    await this.authorizeWrite({ version: 1, platform: 'telegrambot', action: 'edit', target: { id: 'webhook', kind: 'resource' }, text: body.url })
    return this.call<boolean>('setWebhook', body)
  }

  async resolveChatId(chat: ChatId): Promise<ChatId> {
    if (typeof chat === 'number') return chat
    if (/^-?\d+$/.test(chat)) return Number(chat)
    if (chat.startsWith('@')) return chat
    return `@${chat}`
  }

  formatChat(chat: TelegramChat): { id: number; type: string; name: string } {
    if (chat.title) return { id: chat.id, type: chat.type, name: chat.title }
    const fullName = [chat.first_name, chat.last_name].filter(Boolean).join(' ')
    if (fullName) return { id: chat.id, type: chat.type, name: fullName }
    if (chat.username) return { id: chat.id, type: chat.type, name: chat.username }
    return { id: chat.id, type: chat.type, name: String(chat.id) }
  }
}
