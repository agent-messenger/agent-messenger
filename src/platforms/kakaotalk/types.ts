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

export type KakaoAuthMethod = 'login' | 'extract'

export interface KakaoAccountCredentials {
  account_id: string
  oauth_token: string
  user_id: string
  refresh_token?: string
  device_uuid: string
  device_type: KakaoDeviceType
  auth_method?: KakaoAuthMethod
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
  passwordFile?: string
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
    message: 'Tablet slot occupied. Provide --device-type pc or --device-type tablet with --force to replace.',
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
  last_message: z
    .object({
      author_id: z.number(),
      message: z.string(),
      sent_at: z.number(),
    })
    .nullable(),
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

export interface KakaoProfile {
  user_id: string
  nickname: string
  profile_image_url: string | null
  original_profile_image_url: string | null
  background_image_url?: string | null
  original_background_image_url?: string | null
  fullname?: string | null
  status_message: string | null
  account_display_id: string | null
  account_email?: string | null
  pstn_number?: string | null
  email_verified?: boolean | null
}

export const KakaoProfileSchema = z.object({
  user_id: z.string(),
  nickname: z.string(),
  profile_image_url: z.string().nullable(),
  original_profile_image_url: z.string().nullable(),
  background_image_url: z.string().nullable().optional(),
  original_background_image_url: z.string().nullable().optional(),
  fullname: z.string().nullable().optional(),
  status_message: z.string().nullable(),
  account_display_id: z.string().nullable(),
  account_email: z.string().nullable().optional(),
  pstn_number: z.string().nullable().optional(),
  email_verified: z.boolean().nullable().optional(),
})

export const KakaoAccountCredentialsSchema = z.object({
  account_id: z.string(),
  oauth_token: z.string(),
  user_id: z.string(),
  refresh_token: z.string().optional(),
  device_uuid: z.string(),
  device_type: z.enum(['pc', 'tablet']),
  auth_method: z.enum(['login', 'extract']).optional(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const KakaoConfigSchema = z.object({
  current_account: z.string().nullable(),
  accounts: z.record(z.string(), KakaoAccountCredentialsSchema),
})

// Real-time push event types

export interface KakaoTalkPushMessageEvent {
  type: 'MSG'
  chat_id: string
  log_id: string
  author_id: number
  message: string
  message_type: number
  sent_at: number
}

export interface KakaoTalkPushMemberEvent {
  type: 'NEWMEM' | 'DELMEM'
  chat_id: string
  member: { user_id: number }
}

export interface KakaoTalkPushReadEvent {
  type: 'DECUNREAD'
  chat_id: string
  user_id: number
  watermark: string
}

export interface KakaoTalkPushGenericEvent {
  type: string
  [key: string]: unknown
}

export type KakaoTalkPushEvent =
  | KakaoTalkPushMessageEvent
  | KakaoTalkPushMemberEvent
  | KakaoTalkPushReadEvent
  | KakaoTalkPushGenericEvent

export interface KakaoTalkListenerEventMap {
  message: [event: KakaoTalkPushMessageEvent]
  member_joined: [event: KakaoTalkPushMemberEvent]
  member_left: [event: KakaoTalkPushMemberEvent]
  read: [event: KakaoTalkPushReadEvent]
  kakaotalk_event: [event: KakaoTalkPushGenericEvent]
  connected: [info: { userId: string }]
  disconnected: []
  error: [error: Error]
}

export const KakaoTalkPushMessageEventSchema = z.object({
  type: z.literal('MSG'),
  chat_id: z.string(),
  log_id: z.string(),
  author_id: z.number(),
  message: z.string(),
  message_type: z.number(),
  sent_at: z.number(),
})

export const KakaoTalkPushMemberEventSchema = z.object({
  type: z.enum(['NEWMEM', 'DELMEM']),
  chat_id: z.string(),
  member: z.object({ user_id: z.number() }),
})

export const KakaoTalkPushReadEventSchema = z.object({
  type: z.literal('DECUNREAD'),
  chat_id: z.string(),
  user_id: z.number(),
  watermark: z.string(),
})
