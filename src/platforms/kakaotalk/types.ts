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
export type KakaoAuthErrorCode = 'invalid_access_token' | 'login_rejected'

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

export type KakaoOpenChatType = 2 | 13 | 14 | 15 | 16 | 'OM' | 'OD'
export const KNOWN_KAKAO_CHAT_STRING_TYPES = ['DirectChat', 'MultiChat', 'PlusChat', 'MemoChat', 'OM', 'OD'] as const
export type KakaoChatType = number | string

export function isKnownKakaoChatStringType(value: unknown): value is (typeof KNOWN_KAKAO_CHAT_STRING_TYPES)[number] {
  return (
    typeof value === 'string' &&
    KNOWN_KAKAO_CHAT_STRING_TYPES.includes(value as (typeof KNOWN_KAKAO_CHAT_STRING_TYPES)[number])
  )
}

export interface KakaoChat {
  chat_id: string
  type: KakaoChatType
  display_name: string | null
  title: string | null
  active_members: number
  unread_count: number
  last_message: {
    author_id: number
    author_name: string | null
    message: string
    sent_at: number
  } | null
}

export interface KakaoMessage {
  log_id: string
  type: number
  author_id: number
  author_name: string | null
  message: string
  attachment: Record<string, unknown> | null
  sent_at: number
}

export interface KakaoMessagePage {
  messages: KakaoMessage[]
  next_cursor: string | null
  complete: boolean
}

export interface KakaoMember {
  user_id: string
  nickname: string
  profile_image_url: string | null
  full_profile_image_url: string | null
  original_profile_image_url: string | null
  status_message: string | null
  country_iso: string | null
  /** KakaoTalk UserType: 100=FRIEND, 1000=OPEN_PROFILE, etc. `null` when the server omits the field. */
  user_type: number | null
  /** Open-chat-only fields below; `null` for normal chats. */
  open_token: number | null
  open_profile_link_id: string | null
  /** OpenChannelUserPerm bitfield: 1=OWNER, 2=NONE, 4=MANAGER, 8=BOT. Forward-compatible with future values. */
  open_permission: number | null
}

export interface KakaoMemberSnapshot {
  chat_id: string
  active_members: number
  members: KakaoMember[]
  complete: true
  consistency_basis: 'stable_double_read_chatinfo_getmem'
}

export interface KakaoSendResult {
  success: boolean
  status_code: number
  chat_id: string
  log_id: string
  sent_at: number
}

// LOCO message_type values. Source: KakaoTalk APK 26.4.2 + typeclaw inbound parser.
export const KAKAO_MESSAGE_TYPE = {
  TEXT: 1,
  PHOTO: 2,
  VIDEO: 3,
  AUDIO: 5,
  FILE: 18,
  REPLY: 26,
  MULTIPHOTO: 27,
} as const

// PHOTO `extra` keys verified by inbound capture of a real KakaoTalk client
// photo message (2026-05). The bare minimum the receiver needs to render
// the inline preview is k/s/w/h/mt/cs — url and thumbnailUrl are server-issued
// pre-signed URLs that the recipient regenerates locally from k, so we don't
// supply them on outbound.
export interface KakaoPhotoExtra {
  k: string
  s: number
  w: number
  h: number
  mt: string
  cs: string
  url?: string
  thumbnailUrl?: string
  thumbnailWidth?: number
  thumbnailHeight?: number
  expire?: number
}

export interface KakaoFileExtra {
  k: string
  s: number
  name: string
  mt: string
  cs: string
  expire?: number
  url?: string
}

// MULTIPHOTO extra — each per-file field of KakaoPhotoExtra becomes a
// parallel array. Verified by inbound capture of a real multi-photo message
// (2026-05). csl uses lowercase hex (unlike PHOTO's cs which is uppercase).
export interface KakaoMultiPhotoExtra {
  kl: string[]
  wl: number[]
  hl: number[]
  mtl: string[]
  sl: number[]
  csl: string[]
  cmtl?: string[]
  imageUrls?: string[]
  thumbnailUrls?: string[]
  thumbnailWidths?: number[]
  thumbnailHeights?: number[]
  expire?: number
}

// REPLY (type 26) extra. Field names verified against storycraft/node-kakao
// (src/chat/attachment/reply.ts) and jhleekr/kakao.py: `Id` fields are
// camelCase (src_logId, NOT src_log_id), and src_mentions/mentions are
// required even when empty.
export interface KakaoReplyExtra {
  attach_only: boolean
  attach_type: number
  src_logId: string
  src_userId: number
  src_message: string
  src_type: number
  src_mentions: unknown[]
  mentions: unknown[]
  src_linkId?: string
}

export interface KakaoReplyTarget {
  log_id: string
  author_id: number
  message: string
  type: number
}

export interface KakaoMarkReadResult {
  success: boolean
  status_code: number
  chat_id: string
  watermark: string
}

export interface KakaoLeaveChatResult {
  success: boolean
  status_code: number
  chat_id: string
}

export interface KakaoTypingResult {
  success: boolean
  status_code: number
  chat_id: string
}

export const KakaoChatSchema = z.object({
  chat_id: z.string(),
  type: z.union([z.number(), z.string().min(1)]),
  display_name: z.string().nullable(),
  title: z.string().nullable(),
  active_members: z.number(),
  unread_count: z.number(),
  last_message: z
    .object({
      author_id: z.number(),
      author_name: z.string().nullable(),
      message: z.string(),
      sent_at: z.number(),
    })
    .nullable(),
})

export const KakaoMessageSchema = z.object({
  log_id: z.string(),
  type: z.number(),
  author_id: z.number(),
  author_name: z.string().nullable(),
  message: z.string(),
  attachment: z.record(z.string(), z.unknown()).nullable(),
  sent_at: z.number(),
})

export const KakaoMessagePageSchema = z.object({
  messages: z.array(KakaoMessageSchema),
  next_cursor: z.string().nullable(),
  complete: z.boolean(),
})

export const KakaoMemberSchema = z.object({
  user_id: z.string(),
  nickname: z.string(),
  profile_image_url: z.string().nullable(),
  full_profile_image_url: z.string().nullable(),
  original_profile_image_url: z.string().nullable(),
  status_message: z.string().nullable(),
  country_iso: z.string().nullable(),
  user_type: z.number().nullable(),
  open_token: z.number().nullable(),
  open_profile_link_id: z.string().nullable(),
  open_permission: z.number().nullable(),
})

export const KakaoMemberSnapshotSchema = z.object({
  chat_id: z.string(),
  active_members: z.number().int().nonnegative(),
  members: z.array(KakaoMemberSchema),
  complete: z.literal(true),
  consistency_basis: z.literal('stable_double_read_chatinfo_getmem'),
})

export const KakaoSendResultSchema = z.object({
  success: z.boolean(),
  status_code: z.number(),
  chat_id: z.string(),
  log_id: z.string(),
  sent_at: z.number(),
})

export const KakaoMarkReadResultSchema = z.object({
  success: z.boolean(),
  status_code: z.number(),
  chat_id: z.string(),
  watermark: z.string(),
})

export const KakaoLeaveChatResultSchema = z.object({
  success: z.boolean(),
  status_code: z.number(),
  chat_id: z.string(),
})

export const KakaoTypingResultSchema = z.object({
  success: z.boolean(),
  status_code: z.number(),
  chat_id: z.string(),
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
  author_name: string | null
  message: string
  message_type: number
  attachment: Record<string, unknown> | null
  sent_at: number
}

export type KakaoEmoticonKind = 'sticker' | 'sticker_ani' | 'actioncon' | 'sticker_gif' | 'ditem_emoticon'

export const KAKAO_EMOTICON_KIND_BY_TYPE = {
  6: 'ditem_emoticon',
  12: 'sticker',
  20: 'sticker_ani',
  22: 'actioncon',
  25: 'sticker_gif',
} as const satisfies Record<number, KakaoEmoticonKind>

export type KakaoEmoticonMessageType = keyof typeof KAKAO_EMOTICON_KIND_BY_TYPE

export const KAKAO_EMOTICON_MESSAGE_TYPES = Object.keys(KAKAO_EMOTICON_KIND_BY_TYPE).map(
  Number,
) as KakaoEmoticonMessageType[]

export interface KakaoTalkPushEmoticonEvent {
  type: 'EMOTICON'
  chat_id: string
  log_id: string
  author_id: number
  author_name: string | null
  message_type: KakaoEmoticonMessageType
  emoticon_kind: KakaoEmoticonKind
  pack_id: string | null
  sticker_path: string | null
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
  | KakaoTalkPushEmoticonEvent
  | KakaoTalkPushMemberEvent
  | KakaoTalkPushReadEvent
  | KakaoTalkPushGenericEvent

export interface KakaoTalkListenerEventMap {
  message: [event: KakaoTalkPushMessageEvent]
  emoticon: [event: KakaoTalkPushEmoticonEvent]
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
  author_name: z.string().nullable(),
  message: z.string(),
  message_type: z.number(),
  attachment: z.record(z.string(), z.unknown()).nullable(),
  sent_at: z.number(),
})

export const KakaoTalkPushEmoticonEventSchema = z.object({
  type: z.literal('EMOTICON'),
  chat_id: z.string(),
  log_id: z.string(),
  author_id: z.number(),
  author_name: z.string().nullable(),
  message_type: z.union([z.literal(6), z.literal(12), z.literal(20), z.literal(22), z.literal(25)]),
  emoticon_kind: z.enum(['sticker', 'sticker_ani', 'actioncon', 'sticker_gif', 'ditem_emoticon']),
  pack_id: z.string().nullable(),
  sticker_path: z.string().nullable(),
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
