import { z } from 'zod'

export interface MessageBlock {
  type: string
  value: string
}

export interface ChannelBotWorkspaceEntry {
  workspace_id: string
  workspace_name: string
  access_key: string
  access_secret: string
  default_bot?: string
}

export interface ChannelBotConfig {
  current: { workspace_id: string } | null
  workspaces: Record<string, ChannelBotWorkspaceEntry>
  default_bot: string | null
}

export interface ChannelBotCredentials {
  workspace_id: string
  workspace_name: string
  access_key: string
  access_secret: string
}

export interface ChannelBotChannel {
  id: string
  name: string
  homepageUrl?: string
  description?: string
}

export interface ChannelBotUserChat {
  id: string
  channelId: string
  name?: string
  state: 'opened' | 'snoozed' | 'closed'
  managerId?: string
  userId?: string
  createdAt?: number
  updatedAt?: number
}

export interface ChannelBotGroup {
  id: string
  channelId: string
  name: string
}

export interface ChannelBotMessage {
  id: string
  chatKey?: string
  chatType?: string
  chatId?: string
  personType?: 'manager' | 'bot' | 'user'
  personId?: string
  createdAt?: number
  blocks?: MessageBlock[]
  plainText?: string
}

export interface ChannelBotManager {
  id: string
  channelId: string
  accountId?: string
  name: string
  description?: string
}

export interface ChannelBotBot {
  id: string
  channelId: string
  name: string
  avatarUrl?: string
  color?: string
}

export interface ChannelBotUser {
  id: string
  channelId: string
  memberId?: string
  name?: string
}

export class ChannelBotError extends Error {
  code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'ChannelBotError'
    this.code = code
  }
}

export const MessageBlockSchema = z.object({
  type: z.string(),
  value: z.string(),
})

export const ChannelBotWorkspaceEntrySchema = z.object({
  workspace_id: z.string(),
  workspace_name: z.string(),
  access_key: z.string(),
  access_secret: z.string(),
  default_bot: z.string().optional(),
})

export const ChannelBotConfigSchema = z.object({
  current: z
    .object({
      workspace_id: z.string(),
    })
    .nullable(),
  workspaces: z.record(z.string(), ChannelBotWorkspaceEntrySchema),
  default_bot: z.string().nullable(),
})

export const ChannelBotCredentialsSchema = z.object({
  workspace_id: z.string(),
  workspace_name: z.string(),
  access_key: z.string(),
  access_secret: z.string(),
})

export const ChannelBotChannelSchema = z.object({
  id: z.string(),
  name: z.string(),
  homepageUrl: z.string().optional(),
  description: z.string().optional(),
})

export const ChannelBotUserChatSchema = z.object({
  id: z.string(),
  channelId: z.string(),
  name: z.string().optional(),
  state: z.enum(['opened', 'snoozed', 'closed']),
  managerId: z.string().optional(),
  userId: z.string().optional(),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
})

export const ChannelBotGroupSchema = z.object({
  id: z.string(),
  channelId: z.string(),
  name: z.string(),
})

export const ChannelBotMessageSchema = z.object({
  id: z.string(),
  chatKey: z.string().optional(),
  chatType: z.string().optional(),
  chatId: z.string().optional(),
  personType: z.enum(['manager', 'bot', 'user']).optional(),
  personId: z.string().optional(),
  createdAt: z.number().optional(),
  blocks: z.array(MessageBlockSchema).optional(),
  plainText: z.string().optional(),
})

export const ChannelBotManagerSchema = z.object({
  id: z.string(),
  channelId: z.string(),
  accountId: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
})

export const ChannelBotBotSchema = z.object({
  id: z.string(),
  channelId: z.string(),
  name: z.string(),
  avatarUrl: z.string().optional(),
  color: z.string().optional(),
})

export const ChannelBotUserSchema = z.object({
  id: z.string(),
  channelId: z.string(),
  memberId: z.string().optional(),
  name: z.string().optional(),
})
