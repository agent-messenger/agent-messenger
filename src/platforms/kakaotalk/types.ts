import { z } from 'zod'

export interface ExtractedKakaoToken {
  oauth_token: string
  user_id: string
  refresh_token?: string
  device_uuid?: string
  agent_header?: string
  user_agent?: string
  xvc_header?: string
  login_form_body?: string
}

export interface KakaoAccountCredentials {
  account_id: string
  oauth_token: string
  user_id: string
  refresh_token?: string
  device_uuid: string
  device_type: KakaoDeviceType
  created_at: string
  updated_at: string
}

export interface KakaoConfig {
  current_account: string | null
  accounts: Record<string, KakaoAccountCredentials>
}

export type KakaoDeviceType = 'pc' | 'tablet'

export interface KakaoAuthOptions {
  email?: string
  password?: string
  passcode?: string
  deviceType?: KakaoDeviceType
  force?: boolean
  pretty?: boolean
  debug?: boolean
}

export interface KakaoLoginResult {
  authenticated: boolean
  next_action?: string
  message?: string
  warning?: string
  account_id?: string
  device_type?: KakaoDeviceType
  user_id?: string
  error?: string
  passcode?: string
  remaining_seconds?: number
}

export const KAKAO_NEXT_ACTIONS: Record<string, { next_action: string; message: string }> = {
  provide_email: { next_action: 'provide_email', message: 'Provide --email flag.' },
  provide_password: { next_action: 'provide_password', message: 'Provide --password flag.' },
  provide_passcode: {
    next_action: 'provide_passcode',
    message: 'SMS passcode sent to your phone. Provide --passcode flag.',
  },
  choose_device: {
    next_action: 'choose_device',
    message:
      'Tablet slot occupied. Provide --device-type pc or --device-type tablet with --force to replace.',
  },
}

export interface KakaoChat {
  chat_id: string
  type: number
  display_name: string | null
  active_members: number
  unread_count: number
  last_message: {
    author_id: number
    message: string
    sent_at: number
  } | null
}

export interface KakaoMessage {
  log_id: string
  type: number
  author_id: number
  message: string
  sent_at: number
}

export interface KakaoSendResult {
  success: boolean
  status_code: number
  chat_id: string
  log_id: string
  sent_at: number
}

export const KakaoChatSchema = z.object({
  chat_id: z.string(),
  type: z.number(),
  display_name: z.string().nullable(),
  active_members: z.number(),
  unread_count: z.number(),
  last_message: z.object({
    author_id: z.number(),
    message: z.string(),
    sent_at: z.number(),
  }).nullable(),
})

export const KakaoMessageSchema = z.object({
  log_id: z.string(),
  type: z.number(),
  author_id: z.number(),
  message: z.string(),
  sent_at: z.number(),
})

export const KakaoSendResultSchema = z.object({
  success: z.boolean(),
  status_code: z.number(),
  chat_id: z.string(),
  log_id: z.string(),
  sent_at: z.number(),
})

export const KakaoAccountCredentialsSchema = z.object({
  account_id: z.string(),
  oauth_token: z.string(),
  user_id: z.string(),
  refresh_token: z.string().optional(),
  device_uuid: z.string(),
  device_type: z.enum(['pc', 'tablet']),
  created_at: z.string(),
  updated_at: z.string(),
})

export const KakaoConfigSchema = z.object({
  current_account: z.string().nullable(),
  accounts: z.record(z.string(), KakaoAccountCredentialsSchema),
})
