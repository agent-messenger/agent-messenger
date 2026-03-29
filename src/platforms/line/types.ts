import { z } from 'zod'

export type LineDevice = 'DESKTOPWIN' | 'DESKTOPMAC' | 'ANDROID' | 'IOS' | 'IOSIPAD'

export interface LineAccountCredentials {
  account_id: string
  auth_token: string
  certificate?: string
  device: LineDevice
  display_name?: string
  created_at: string
  updated_at: string
}

export interface LineConfig {
  current_account: string | null
  accounts: Record<string, LineAccountCredentials>
}

export interface LineLoginResult {
  authenticated: boolean
  account_id?: string
  display_name?: string
  device?: LineDevice
  next_action?: 'scan_qr' | 'enter_pin' | 'confirm_on_phone'
  message?: string
  qr_url?: string
  pin_code?: string
  error?: string
}

export interface LineChat {
  chat_id: string
  type: 'user' | 'group' | 'room' | 'square'
  display_name: string
  member_count?: number
  picture_url?: string
}

export interface LineMessage {
  message_id: string
  chat_id: string
  author_id: string
  author_name?: string
  text: string | null
  content_type: string
  sent_at: string
}

export interface LineSendResult {
  success: boolean
  chat_id: string
  message_id: string
  sent_at: string
}

export interface LineProfile {
  mid: string
  display_name: string
  status_message?: string
  picture_url?: string
}

export interface LineFriend {
  mid: string
  display_name: string
  status_message?: string
  picture_url?: string
}

export class LineError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'LineError'
    this.code = code
  }
}

export const LineAccountCredentialsSchema = z.object({
  account_id: z.string(),
  auth_token: z.string(),
  certificate: z.string().optional(),
  device: z.enum(['DESKTOPWIN', 'DESKTOPMAC', 'ANDROID', 'IOS', 'IOSIPAD']),
  display_name: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const LineConfigSchema = z.object({
  current_account: z.string().nullable(),
  accounts: z.record(z.string(), LineAccountCredentialsSchema),
})

export const LineChatSchema = z.object({
  chat_id: z.string(),
  type: z.enum(['user', 'group', 'room', 'square']),
  display_name: z.string(),
  member_count: z.number().optional(),
  picture_url: z.string().optional(),
})

export const LineMessageSchema = z.object({
  message_id: z.string(),
  chat_id: z.string(),
  author_id: z.string(),
  author_name: z.string().optional(),
  text: z.string().nullable(),
  content_type: z.string(),
  sent_at: z.string(),
})

export const LineProfileSchema = z.object({
  mid: z.string(),
  display_name: z.string(),
  status_message: z.string().optional(),
  picture_url: z.string().optional(),
})

export const LineFriendSchema = z.object({
  mid: z.string(),
  display_name: z.string(),
  status_message: z.string().optional(),
  picture_url: z.string().optional(),
})

export const LineSendResultSchema = z.object({
  success: z.boolean(),
  chat_id: z.string(),
  message_id: z.string(),
  sent_at: z.string(),
})

export const LINE_NEXT_ACTIONS: Record<string, { next_action: string; message: string }> = {
  scan_qr: {
    next_action: 'scan_qr',
    message:
      'QR code login required. Run `agent-line auth login` in an interactive terminal so the user can scan the QR code with the LINE mobile app.',
  },
  enter_pin: {
    next_action: 'enter_pin',
    message:
      'PIN entry required. The user must enter the displayed PIN code in the LINE mobile app to complete authentication.',
  },
  provide_email: {
    next_action: 'provide_email',
    message: 'Provide --email and --password flags for email/password login.',
  },
  provide_token: {
    next_action: 'provide_token',
    message: 'Provide --token flag with a valid LINE auth token.',
  },
  run_interactive: {
    next_action: 'run_interactive',
    message:
      'Interactive login required. Ask the user to run `agent-line auth login` in a terminal and scan the QR code with the LINE mobile app.',
  },
}
