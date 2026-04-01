import { z } from 'zod'

export interface WeChatAccount {
  account_id: string
  name?: string
  created_at: string
  updated_at: string
}

export interface WeChatConfig {
  current: string | null
  accounts: Record<string, WeChatAccount>
}

export interface WeChatAccountPaths {
  account_dir: string
}

export interface OneBotMessageSegment {
  type: 'text' | 'at' | 'image' | 'video' | 'record' | 'file' | 'share' | 'face' | 'sys'
  data: {
    text?: string
    qq?: string
    file?: string
    url?: string
  }
}

export interface OneBotSendRequest {
  message: OneBotMessageSegment[]
  user_id?: string
  group_id?: string
}

export interface OneBotWSAction {
  action: string
  echo?: string
  params?: Record<string, unknown>
}

export interface OneBotMessageEvent {
  time: number
  post_type: 'message'
  message_type: 'private' | 'group'
  user_id: string
  self_id: string
  group_id: string
  message_id: string
  message: OneBotMessageSegment[]
  sender: { user_id: string; nickname: string }
  raw_message: string
  show_content: string
}

export interface WeChatMessageSummary {
  id: string
  chat_id: string
  from: string
  from_name?: string
  timestamp: string
  is_outgoing: boolean
  type: string
  text?: string
}

export class WeChatError extends Error {
  code: string

  constructor(message: string, code: string = 'wechat_error') {
    super(message)
    this.name = 'WeChatError'
    this.code = code
  }
}

export function createAccountId(wxid: string): string {
  return wxid.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '-').replace(/^-+|-+$/g, '') || 'default'
}

export const WeChatAccountSchema = z.object({
  account_id: z.string(),
  name: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const WeChatConfigSchema = z.object({
  current: z.string().nullable(),
  accounts: z.record(z.string(), WeChatAccountSchema),
})
