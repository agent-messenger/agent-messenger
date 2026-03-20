import { z } from 'zod'

export interface InstagramBotWorkspaceEntry {
  workspace_id: string
  workspace_name: string
  page_id: string
  access_token: string
  instagram_account_id: string
}

export interface InstagramBotConfig {
  current: { workspace_id: string } | null
  workspaces: Record<string, InstagramBotWorkspaceEntry>
}

export interface InstagramBotCredentials {
  workspace_id: string
  workspace_name: string
  page_id: string
  access_token: string
  instagram_account_id: string
}

export interface InstagramBusinessAccount {
  id: string
}

export interface InstagramBotPageInfo {
  id: string
  name: string
  instagram_business_account?: InstagramBusinessAccount
}

export interface InstagramBotSendMessageResponse {
  recipient_id: string
  message_id: string
}

export interface InstagramGraphErrorData {
  message: string
  type?: string
  code?: number
  fbtrace_id?: string
}

export class InstagramBotError extends Error {
  code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'InstagramBotError'
    this.code = code
  }
}

export const InstagramBotWorkspaceEntrySchema = z.object({
  workspace_id: z.string(),
  workspace_name: z.string(),
  page_id: z.string(),
  access_token: z.string(),
  instagram_account_id: z.string(),
})

export const InstagramBotConfigSchema = z.object({
  current: z
    .object({
      workspace_id: z.string(),
    })
    .nullable(),
  workspaces: z.record(z.string(), InstagramBotWorkspaceEntrySchema),
})

export const InstagramBotCredentialsSchema = z.object({
  workspace_id: z.string(),
  workspace_name: z.string(),
  page_id: z.string(),
  access_token: z.string(),
  instagram_account_id: z.string(),
})

export const InstagramBusinessAccountSchema = z.object({
  id: z.string(),
})

export const InstagramBotPageInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  instagram_business_account: InstagramBusinessAccountSchema.optional(),
})

export const InstagramBotSendMessageResponseSchema = z.object({
  recipient_id: z.string(),
  message_id: z.string(),
})

export const InstagramGraphErrorDataSchema = z.object({
  message: z.string(),
  type: z.string().optional(),
  code: z.number().optional(),
  fbtrace_id: z.string().optional(),
})
