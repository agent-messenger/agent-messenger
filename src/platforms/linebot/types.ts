import { z } from 'zod'

export interface LineBotWorkspaceEntry {
  channel_id: string
  channel_name: string
  channel_access_token: string
}

export interface LineBotConfig {
  current: { channel_id: string } | null
  workspaces: Record<string, LineBotWorkspaceEntry>
}

export interface LineBotCredentials {
  channel_id: string
  channel_name: string
  channel_access_token: string
}

export interface LineBotTextMessage {
  type: 'text'
  text: string
}

export interface LineBotBotInfo {
  userId: string
  displayName: string
  pictureUrl?: string
  basicId?: string
  premiumId?: string
  chatMode?: string
  markAsReadMode?: string
}

export interface LineBotProfile {
  userId: string
  displayName: string
  pictureUrl?: string
  statusMessage?: string
  language?: string
}

export interface LineBotGroupSummary {
  groupId: string
  groupName: string
  pictureUrl?: string
}

export interface LineBotGroupMembersIds {
  userIds?: string[]
  next?: string
}

export interface LineBotPushResponse {
  sentMessages?: Array<{
    id?: string
    quoteToken?: string
  }>
}

export class LineBotError extends Error {
  code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'LineBotError'
    this.code = code
  }
}

export const LineBotWorkspaceEntrySchema = z.object({
  channel_id: z.string(),
  channel_name: z.string(),
  channel_access_token: z.string(),
})

export const LineBotConfigSchema = z.object({
  current: z
    .object({
      channel_id: z.string(),
    })
    .nullable(),
  workspaces: z.record(z.string(), LineBotWorkspaceEntrySchema),
})

export const LineBotCredentialsSchema = z.object({
  channel_id: z.string(),
  channel_name: z.string(),
  channel_access_token: z.string(),
})

export const LineBotTextMessageSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
})

export const LineBotBotInfoSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  pictureUrl: z.string().optional(),
  basicId: z.string().optional(),
  premiumId: z.string().optional(),
  chatMode: z.string().optional(),
  markAsReadMode: z.string().optional(),
})

export const LineBotProfileSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  pictureUrl: z.string().optional(),
  statusMessage: z.string().optional(),
  language: z.string().optional(),
})

export const LineBotGroupSummarySchema = z.object({
  groupId: z.string(),
  groupName: z.string(),
  pictureUrl: z.string().optional(),
})

export const LineBotGroupMembersIdsSchema = z.object({
  userIds: z.array(z.string()).optional(),
  next: z.string().optional(),
})

export const LineBotPushResponseSchema = z.object({
  sentMessages: z
    .array(
      z.object({
        id: z.string().optional(),
        quoteToken: z.string().optional(),
      }),
    )
    .optional(),
})
