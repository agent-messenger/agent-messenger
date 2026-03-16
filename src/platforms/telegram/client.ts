import { mkdir } from 'node:fs/promises'
import pkg from '../../../package.json'
import { TdjsonBinding } from './tdlib'
import {
  parseChatReference,
  simplifyChat,
  simplifyMessage,
  simplifyUser,
  summarizeAuthorizationState,
  type TelegramAccount,
  type TelegramAccountPaths,
  type TelegramAuthStatus,
  type TelegramChatSummary,
  TelegramError,
  type TelegramMessageSummary,
} from './types'

interface LoginInput {
  phone_number?: string
  code?: string
  password?: string
  email?: string
  email_code?: string
  first_name?: string
  last_name?: string
  bot_token?: string
}

interface RequestOptions {
  timeoutMs?: number
}

export class TelegramTdlibClient {
  private tdjson: TdjsonBinding
  private clientId: number
  private currentAuthorizationState: any | null = null
  private requestSeq = 0

  constructor(
    private account: TelegramAccount,
    private paths: TelegramAccountPaths,
  ) {
    this.tdjson = new TdjsonBinding(account.tdlib_path)
    this.clientId = this.tdjson.createClientId()
  }

  async connect(): Promise<any> {
    await mkdir(this.paths.database_dir, { recursive: true })
    await mkdir(this.paths.files_dir, { recursive: true })

    let state = await this.getAuthorizationState()

    while (state?.['@type'] === 'authorizationStateWaitTdlibParameters') {
      await this.call({
        '@type': 'setTdlibParameters',
        database_directory: this.paths.database_dir,
        files_directory: this.paths.files_dir,
        database_encryption_key: '',
        use_file_database: true,
        use_chat_info_database: true,
        use_message_database: true,
        use_secret_chats: true,
        api_id: this.account.api_id,
        api_hash: this.account.api_hash,
        system_language_code: process.env.LANG?.split('.')[0] || 'en',
        device_model: 'agent-messenger',
        system_version: `${process.platform}-${process.arch}`,
        application_version: `agent-messenger/${pkg.version}`,
      })

      state = await this.waitForAuthorizationStateChange('authorizationStateWaitTdlibParameters')
    }

    return state
  }

  async getAuthStatus(): Promise<TelegramAuthStatus> {
    const state = await this.connect()
    const summary = summarizeAuthorizationState(state)

    return {
      ...summary,
      account_id: this.account.account_id,
      phone_number: this.account.phone_number,
      tdlib_path: this.tdjson.libraryPath,
      user: summary.authenticated ? simplifyUser(await this.call({ '@type': 'getMe' })) : undefined,
    }
  }

  async login(input: LoginInput): Promise<TelegramAuthStatus> {
    let state = await this.connect()

    for (let step = 0; step < 8; step += 1) {
      const submitted = await this.submitAuthenticationInput(state, input)
      if (!submitted) {
        break
      }

      state = await this.waitForAuthorizationStateChange(state['@type'])
      if (!state) {
        break
      }

      if (state['@type'] === 'authorizationStateReady') {
        break
      }
    }

    return this.getAuthStatus()
  }

  async logOut(): Promise<void> {
    await this.connect()
    await this.call({ '@type': 'logOut' }, { timeoutMs: 30000 })
    await this.waitForAuthorizationState('authorizationStateClosed', 30000)
  }

  async close(): Promise<void> {
    if (this.currentAuthorizationState?.['@type'] === 'authorizationStateClosed') {
      return
    }

    try {
      await this.call({ '@type': 'close' }, { timeoutMs: 30000 })
    } catch {
      return
    }

    await this.waitForAuthorizationState('authorizationStateClosed', 30000).catch(() => undefined)
  }

  async listChats(limit: number = 20): Promise<TelegramChatSummary[]> {
    await this.ensureReady()

    try {
      await this.call({
        '@type': 'loadChats',
        chat_list: {
          '@type': 'chatListMain',
        },
        limit,
      })
    } catch {
      // Best-effort cache warmup only.
    }

    const response = await this.call({
      '@type': 'getChats',
      chat_list: {
        '@type': 'chatListMain',
      },
      limit,
    })

    return this.getChatsByIds(response.chat_ids ?? [])
  }

  async searchChats(query: string, limit: number = 20): Promise<TelegramChatSummary[]> {
    await this.ensureReady()

    const local = await this.call({
      '@type': 'searchChats',
      query,
      limit,
    })

    if ((local.chat_ids ?? []).length > 0) {
      return this.getChatsByIds(local.chat_ids)
    }

    const remote = await this.call({
      '@type': 'searchPublicChats',
      query,
    })

    return this.getChatsByIds(remote.chat_ids ?? [])
  }

  async getChat(reference: string): Promise<TelegramChatSummary> {
    await this.ensureReady()
    const chat = await this.resolveChat(reference)
    return simplifyChat(chat)
  }

  async listMessages(reference: string, limit: number = 20): Promise<TelegramMessageSummary[]> {
    await this.ensureReady()
    const chat = await this.resolveChat(reference)

    const response = await this.call({
      '@type': 'getChatHistory',
      chat_id: chat.id,
      from_message_id: 0,
      offset: 0,
      limit,
      only_local: false,
    })

    return (response.messages ?? []).map((message: any) => simplifyMessage(message, chat.id))
  }

  async sendMessage(reference: string, text: string): Promise<TelegramMessageSummary> {
    await this.ensureReady()
    const chat = await this.resolveChat(reference)

    const message = await this.call({
      '@type': 'sendMessage',
      chat_id: chat.id,
      topic_id: null,
      reply_to: null,
      options: null,
      reply_markup: null,
      input_message_content: {
        '@type': 'inputMessageText',
        text: {
          '@type': 'formattedText',
          text,
          entities: [],
        },
        link_preview_options: null,
        clear_draft: true,
      },
    })

    return simplifyMessage(message, chat.id)
  }

  private async ensureReady(): Promise<void> {
    const state = await this.connect()
    if (state?.['@type'] !== 'authorizationStateReady') {
      const summary = summarizeAuthorizationState(state)
      throw new TelegramError(
        `Telegram account is not authenticated. Current state: ${summary.authorization_state}${
          summary.next_action ? ` (${summary.next_action})` : ''
        }`,
        'not_authenticated',
      )
    }
  }

  private async getAuthorizationState(): Promise<any> {
    const state = await this.call({ '@type': 'getAuthorizationState' })
    this.currentAuthorizationState = state
    return state
  }

  private async submitAuthenticationInput(state: any, input: LoginInput): Promise<boolean> {
    switch (state?.['@type']) {
      case 'authorizationStateWaitPhoneNumber': {
        if (input.bot_token) {
          await this.call({
            '@type': 'checkAuthenticationBotToken',
            token: input.bot_token,
          })
          return true
        }

        const phoneNumber = input.phone_number ?? this.account.phone_number
        if (!phoneNumber) {
          return false
        }

        await this.call({
          '@type': 'setAuthenticationPhoneNumber',
          phone_number: phoneNumber,
          settings: null,
        })
        return true
      }
      case 'authorizationStateWaitCode':
        if (!input.code) {
          return false
        }

        await this.call({
          '@type': 'checkAuthenticationCode',
          code: input.code,
        })
        return true
      case 'authorizationStateWaitPassword':
        if (!input.password) {
          return false
        }

        await this.call({
          '@type': 'checkAuthenticationPassword',
          password: input.password,
        })
        return true
      case 'authorizationStateWaitEmailAddress':
        if (!input.email) {
          return false
        }

        await this.call({
          '@type': 'setAuthenticationEmailAddress',
          email_address: input.email,
        })
        return true
      case 'authorizationStateWaitEmailCode':
        if (!input.email_code) {
          return false
        }

        await this.call({
          '@type': 'checkAuthenticationEmailCode',
          code: {
            '@type': 'emailAddressAuthenticationCode',
            code: input.email_code,
          },
        })
        return true
      case 'authorizationStateWaitRegistration':
        if (!input.first_name) {
          return false
        }

        await this.call({
          '@type': 'registerUser',
          first_name: input.first_name,
          last_name: input.last_name ?? '',
          disable_notification: true,
        })
        return true
      default:
        return false
    }
  }

  private async resolveChat(reference: string): Promise<any> {
    const numericId = parseChatReference(reference)

    if (numericId !== null) {
      return this.call({
        '@type': 'getChat',
        chat_id: numericId,
      })
    }

    const username = reference.replace(/^@/, '')
    try {
      return await this.call({
        '@type': 'searchPublicChat',
        username,
      })
    } catch {
      const chats = await this.searchChats(reference, 20)
      const exactMatch = chats.find((chat) => chat.title.toLowerCase() === reference.toLowerCase())

      if (exactMatch) {
        return this.call({
          '@type': 'getChat',
          chat_id: exactMatch.id,
        })
      }

      if (chats.length === 1) {
        return this.call({
          '@type': 'getChat',
          chat_id: chats[0].id,
        })
      }

      throw new TelegramError(
        `Chat "${reference}" not found. Use "agent-telegram chat list" or "agent-telegram chat search" first.`,
        'chat_not_found',
      )
    }
  }

  private async getChatsByIds(chatIds: number[]): Promise<TelegramChatSummary[]> {
    const chats = await Promise.all(
      chatIds.map((chatId) =>
        this.call({
          '@type': 'getChat',
          chat_id: chatId,
        }),
      ),
    )

    return chats.map((chat) => simplifyChat(chat))
  }

  private handleEvent(event: any): any {
    if (event?.['@type'] === 'updateAuthorizationState') {
      this.currentAuthorizationState = event.authorization_state
      return event.authorization_state
    }

    if (event?.['@type'] === 'error') {
      throw new TelegramError(event.message ?? 'TDLib error', event.code ?? 'tdlib_error')
    }

    return event
  }

  private async waitForAuthorizationStateChange(previousType?: string, timeoutMs: number = 15000): Promise<any> {
    if (
      previousType !== undefined &&
      this.currentAuthorizationState &&
      this.currentAuthorizationState['@type'] !== previousType
    ) {
      return this.currentAuthorizationState
    }

    const deadline = Date.now() + timeoutMs

    while (Date.now() < deadline) {
      const event = this.tdjson.receive(Math.min(0.5, Math.max((deadline - Date.now()) / 1000, 0.05)))
      if (!event) {
        continue
      }

      if (event['@type'] === 'updateAuthorizationState') {
        this.currentAuthorizationState = event.authorization_state
        if (previousType === undefined || event.authorization_state['@type'] !== previousType) {
          return event.authorization_state
        }
        continue
      }

      this.handleEvent(event)
    }

    return this.currentAuthorizationState
  }

  private async waitForAuthorizationState(targetType: string, timeoutMs: number = 15000): Promise<any> {
    if (this.currentAuthorizationState?.['@type'] === targetType) {
      return this.currentAuthorizationState
    }

    const deadline = Date.now() + timeoutMs

    while (Date.now() < deadline) {
      const event = this.tdjson.receive(Math.min(0.5, Math.max((deadline - Date.now()) / 1000, 0.05)))
      if (!event) {
        continue
      }

      if (event['@type'] === 'updateAuthorizationState') {
        this.currentAuthorizationState = event.authorization_state
        if (event.authorization_state['@type'] === targetType) {
          return event.authorization_state
        }
        continue
      }

      this.handleEvent(event)
    }

    return this.currentAuthorizationState
  }

  private async call(query: Record<string, unknown>, options: RequestOptions = {}): Promise<any> {
    const timeoutMs = options.timeoutMs ?? 15000
    this.requestSeq += 1
    const extra = `req-${Date.now()}-${this.requestSeq}`

    this.tdjson.send(this.clientId, {
      ...query,
      '@extra': extra,
    })

    const deadline = Date.now() + timeoutMs

    while (Date.now() < deadline) {
      const event = this.tdjson.receive(Math.min(0.5, Math.max((deadline - Date.now()) / 1000, 0.05)))
      if (!event) {
        continue
      }

      if (event['@extra'] === extra) {
        if (event['@type'] === 'error') {
          throw new TelegramError(event.message ?? 'TDLib error', event.code ?? 'tdlib_error')
        }

        return this.handleEvent(event)
      }

      this.handleEvent(event)
    }

    throw new TelegramError(`Timed out waiting for TDLib response to ${query['@type']}`, 'timeout')
  }
}
