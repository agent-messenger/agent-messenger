import { z } from 'zod'

export interface WeChatBotAccountEntry {
  app_id: string
  app_secret: string
  account_name: string
}

export interface WeChatBotConfig {
  current: { account_id: string } | null
  accounts: Record<string, WeChatBotAccountEntry>
}

export interface WeChatBotCredentials {
  app_id: string
  app_secret: string
  account_name: string
}

export interface WeChatBotNewsArticle {
  title: string
  description: string
  url: string
  picurl: string
}

export interface WeChatBotTemplate {
  template_id: string
  title: string
  primary_industry: string
  deputy_industry: string
  content: string
  example: string
}

export interface WeChatBotUserInfo {
  subscribe: number
  openid: string
  language: string
  subscribe_time: number
  unionid?: string
  remark: string
  tagid_list: number[]
  subscribe_scene: string
  qr_scene: number
  qr_scene_str: string
}

export class WeChatBotError extends Error {
  code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'WeChatBotError'
    this.code = code
  }
}

export const WeChatBotAccountEntrySchema = z.object({
  app_id: z.string(),
  app_secret: z.string(),
  account_name: z.string(),
})

export const WeChatBotConfigSchema = z.object({
  current: z
    .object({
      account_id: z.string(),
    })
    .nullable(),
  accounts: z.record(z.string(), WeChatBotAccountEntrySchema),
})

export const WeChatBotCredentialsSchema = z.object({
  app_id: z.string(),
  app_secret: z.string(),
  account_name: z.string(),
})

export const WeChatBotNewsArticleSchema = z.object({
  title: z.string(),
  description: z.string(),
  url: z.string(),
  picurl: z.string(),
})

export const WeChatBotTemplateSchema = z.object({
  template_id: z.string(),
  title: z.string(),
  primary_industry: z.string(),
  deputy_industry: z.string(),
  content: z.string(),
  example: z.string(),
})

export const WeChatBotUserInfoSchema = z.object({
  subscribe: z.number(),
  openid: z.string(),
  language: z.string(),
  subscribe_time: z.number(),
  unionid: z.string().optional(),
  remark: z.string(),
  tagid_list: z.array(z.number()),
  subscribe_scene: z.string(),
  qr_scene: z.number(),
  qr_scene_str: z.string(),
})
