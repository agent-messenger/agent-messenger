export interface TelegramAccount {
  account_id: string
  api_id: number
  api_hash: string
  phone_number?: string
  tdlib_path?: string
  created_at: string
  updated_at: string
}

export interface TelegramConfig {
  current: string | null
  accounts: Record<string, TelegramAccount>
}

export interface TelegramAccountPaths {
  account_dir: string
  database_dir: string
  files_dir: string
}

export interface TelegramUserSummary {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  phone_number?: string
  type: 'user'
}

export interface TelegramAuthorizationSummary {
  authorization_state: string
  authenticated: boolean
  next_action?: string
  hint?: string
  code_info?: {
    type?: string
    phone_number?: string
    timeout?: number
  }
}

export interface TelegramAuthStatus extends TelegramAuthorizationSummary {
  account_id: string
  phone_number?: string
  tdlib_path?: string
  user?: TelegramUserSummary
}

export interface TelegramSenderSummary {
  type: 'user' | 'chat' | 'unknown'
  id?: number
}

export interface TelegramMessageSummary {
  id: number
  chat_id: number
  date: string
  is_outgoing: boolean
  sender: TelegramSenderSummary
  content_type: string
  text?: string
}

export interface TelegramChatSummary {
  id: number
  title: string
  type: string
  unread_count: number
  last_message?: TelegramMessageSummary
}

export class TelegramError extends Error {
  code: string | number

  constructor(message: string, code: string | number = 'telegram_error') {
    super(message)
    this.name = 'TelegramError'
    this.code = code
  }
}

export function createAccountId(input: string): string {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/^\+/, 'plus-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || 'default'
}

export function parseChatReference(input: string): number | null {
  if (!/^-?\d+$/.test(input.trim())) {
    return null
  }

  const value = Number(input)
  return Number.isSafeInteger(value) ? value : null
}

export function toIsoDate(unixSeconds?: number): string {
  return new Date((unixSeconds ?? 0) * 1000).toISOString()
}

export function simplifyUser(user: any): TelegramUserSummary {
  return {
    id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    username: user.usernames?.editable_username || user.usernames?.active_usernames?.[0],
    phone_number: user.phone_number,
    type: 'user',
  }
}

export function summarizeAuthorizationState(state: any): TelegramAuthorizationSummary {
  const type = state?.['@type'] ?? 'authorizationStateUnknown'

  switch (type) {
    case 'authorizationStateReady':
      return {
        authorization_state: type,
        authenticated: true,
      }
    case 'authorizationStateWaitTdlibParameters':
      return {
        authorization_state: type,
        authenticated: false,
        next_action: 'provide_api_credentials',
        hint: 'Run auth login with --api-id and --api-hash.',
      }
    case 'authorizationStateWaitPhoneNumber':
      return {
        authorization_state: type,
        authenticated: false,
        next_action: 'provide_phone_number',
        hint: 'Run auth login with --phone "+8210...".',
      }
    case 'authorizationStateWaitCode':
      return {
        authorization_state: type,
        authenticated: false,
        next_action: 'provide_code',
        hint: 'Run auth login with --code <code>.',
        code_info: {
          type: state.code_info?.type?.['@type'],
          phone_number: state.code_info?.phone_number,
          timeout: state.code_info?.timeout,
        },
      }
    case 'authorizationStateWaitPassword':
      return {
        authorization_state: type,
        authenticated: false,
        next_action: 'provide_password',
        hint: 'Run auth login with --password <password>.',
      }
    case 'authorizationStateWaitEmailAddress':
      return {
        authorization_state: type,
        authenticated: false,
        next_action: 'provide_email',
        hint: 'Run auth login with --email <address>.',
      }
    case 'authorizationStateWaitEmailCode':
      return {
        authorization_state: type,
        authenticated: false,
        next_action: 'provide_email_code',
        hint: 'Run auth login with --email-code <code>.',
      }
    case 'authorizationStateWaitRegistration':
      return {
        authorization_state: type,
        authenticated: false,
        next_action: 'provide_registration',
        hint: 'Run auth login with --first-name and optionally --last-name.',
      }
    case 'authorizationStateWaitPremiumPurchase':
      return {
        authorization_state: type,
        authenticated: false,
        next_action: 'complete_premium_purchase',
      }
    case 'authorizationStateLoggingOut':
    case 'authorizationStateClosing':
    case 'authorizationStateClosed':
      return {
        authorization_state: type,
        authenticated: false,
      }
    default:
      return {
        authorization_state: type,
        authenticated: false,
      }
  }
}

export function extractMessageText(content: any): string | undefined {
  const type = content?.['@type']

  switch (type) {
    case 'messageText':
      return content.text?.text
    case 'messagePhoto':
    case 'messageVideo':
    case 'messageAnimation':
    case 'messageAudio':
    case 'messageDocument':
    case 'messageVoiceNote':
      return content.caption?.text
    case 'messagePoll':
      return content.poll?.question?.text
    case 'messageSticker':
      return content.sticker?.emoji
    case 'messageContact':
      return [content.contact?.first_name, content.contact?.last_name].filter(Boolean).join(' ')
    default:
      return undefined
  }
}

export function simplifySender(sender: any): TelegramSenderSummary {
  switch (sender?.['@type']) {
    case 'messageSenderUser':
      return {
        type: 'user',
        id: sender.user_id,
      }
    case 'messageSenderChat':
      return {
        type: 'chat',
        id: sender.chat_id,
      }
    default:
      return {
        type: 'unknown',
      }
  }
}

export function simplifyMessage(message: any, fallbackChatId?: number): TelegramMessageSummary {
  const contentType = message.content?.['@type'] ?? 'unknown'

  return {
    id: message.id,
    chat_id: message.chat_id ?? fallbackChatId ?? 0,
    date: toIsoDate(message.date),
    is_outgoing: Boolean(message.is_outgoing),
    sender: simplifySender(message.sender_id),
    content_type: contentType,
    text: extractMessageText(message.content),
  }
}

export function simplifyChat(chat: any): TelegramChatSummary {
  const rawType = chat.type?.['@type'] ?? 'chatTypeUnknown'
  const type = rawType.replace(/^chatType/, '').toLowerCase()

  return {
    id: chat.id,
    title: chat.title,
    type,
    unread_count: chat.unread_count ?? 0,
    last_message: chat.last_message ? simplifyMessage(chat.last_message, chat.id) : undefined,
  }
}

// ─── TDLib JSON API Types ──────────────────────────────────────────────────

export interface TdError {
  '@type': 'error'
  code: number
  message: string
}

export interface TdOk {
  '@type': 'ok'
}

export interface TdAuthorizationStateWaitTdlibParameters {
  '@type': 'authorizationStateWaitTdlibParameters'
}

export interface TdAuthorizationStateWaitPhoneNumber {
  '@type': 'authorizationStateWaitPhoneNumber'
}

export interface TdAuthorizationStateWaitCode {
  '@type': 'authorizationStateWaitCode'
}

export interface TdAuthorizationStateWaitPassword {
  '@type': 'authorizationStateWaitPassword'
  password_hint: string
  has_recovery_email_address: boolean
  has_passport_data: boolean
}

export interface TdAuthorizationStateWaitEmailAddress {
  '@type': 'authorizationStateWaitEmailAddress'
}

export interface TdAuthorizationStateWaitEmailCode {
  '@type': 'authorizationStateWaitEmailCode'
}

export interface TdAuthorizationStateWaitRegistration {
  '@type': 'authorizationStateWaitRegistration'
}

export interface TdAuthorizationStateReady {
  '@type': 'authorizationStateReady'
}

export interface TdAuthorizationStateClosed {
  '@type': 'authorizationStateClosed'
}

export interface TdAuthorizationStateLoggingOut {
  '@type': 'authorizationStateLoggingOut'
}

export type TdAuthorizationState =
  | TdAuthorizationStateWaitTdlibParameters
  | TdAuthorizationStateWaitPhoneNumber
  | TdAuthorizationStateWaitCode
  | TdAuthorizationStateWaitPassword
  | TdAuthorizationStateWaitEmailAddress
  | TdAuthorizationStateWaitEmailCode
  | TdAuthorizationStateWaitRegistration
  | TdAuthorizationStateReady
  | TdAuthorizationStateClosed
  | TdAuthorizationStateLoggingOut

export interface TdUpdateAuthorizationState {
  '@type': 'updateAuthorizationState'
  authorization_state: TdAuthorizationState
}

export interface TdUpdateMessageSendSucceeded {
  '@type': 'updateMessageSendSucceeded'
  message: TdMessage
  old_message_id: number
}

export interface TdUpdateMessageSendFailed {
  '@type': 'updateMessageSendFailed'
  message: TdMessage
  old_message_id: number
  error_code: number
  error_message: string
}

export interface TdFormattedText {
  '@type': 'formattedText'
  text: string
  entities: unknown[]
}

export interface TdMessageText {
  '@type': 'messageText'
  text: TdFormattedText
}

export type TdMessageContent = TdMessageText | { '@type': string; [key: string]: unknown }

export interface TdMessage {
  '@type': 'message'
  id: number
  chat_id: number
  sender_id?: unknown
  is_outgoing: boolean
  date: number
  content?: TdMessageContent
  sending_state?: { '@type': string }
  [key: string]: unknown
}

export interface TdMessages {
  '@type': 'messages'
  total_count: number
  messages: TdMessage[]
}

export interface TdUser {
  '@type': 'user'
  id: number
  first_name: string
  last_name: string
  username?: string
  phone_number: string
  [key: string]: unknown
}

export interface TdChat {
  '@type': 'chat'
  id: number
  title: string
  type?: unknown
  [key: string]: unknown
}

export interface TdChats {
  '@type': 'chats'
  total_count: number
  chat_ids: number[]
}
