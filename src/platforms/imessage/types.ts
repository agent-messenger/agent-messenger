export type IMessageProvider = 'bluebubbles'

export interface IMessageAccount {
  account_id: string
  provider: IMessageProvider
  server_url: string
  password: string
  label?: string
  created_at: string
  updated_at: string
}

export interface IMessageConfig {
  current: string | null
  accounts: Record<string, IMessageAccount>
}

export interface IMessageChatSummary {
  id: string
  name: string
  type: 'individual' | 'group'
  last_message?: IMessageMessageSummary
}

export interface IMessageMessageSummary {
  id: string
  chat_id: string
  from: string
  from_name?: string
  timestamp: string
  is_outgoing: boolean
  text?: string
}

export interface IMessageServerInfo {
  backend: IMessageProvider
  version: string | null
  private_api_enabled: boolean
  macos_version?: string | null
}

export type IMessageErrorCode =
  | 'no_credentials'
  | 'not_authenticated'
  | 'unreachable'
  | 'auth_rejected'
  | 'private_api_required'
  | 'invalid_limit'
  | 'send_failed'
  | 'localhost_in_container'
  | 'imessage_error'

export class IMessageError extends Error {
  code: IMessageErrorCode
  suggestion?: string
  doctorCommand?: string

  constructor(
    message: string,
    code: IMessageErrorCode = 'imessage_error',
    extra?: { suggestion?: string; doctorCommand?: string },
  ) {
    super(message)
    this.name = 'IMessageError'
    this.code = code
    this.suggestion = extra?.suggestion
    this.doctorCommand = extra?.doctorCommand
  }

  toJSON(): { error: string; code: IMessageErrorCode; suggestion?: string; doctorCommand?: string } {
    return {
      error: this.message,
      code: this.code,
      ...(this.suggestion ? { suggestion: this.suggestion } : {}),
      ...(this.doctorCommand ? { doctorCommand: this.doctorCommand } : {}),
    }
  }
}

export function createAccountId(input: string): string {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || 'default'
}
