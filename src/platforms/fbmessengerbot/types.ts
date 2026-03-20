import { z } from 'zod'

export interface FBMessengerBotWorkspaceEntry {
  workspace_id: string
  workspace_name: string
  page_id: string
  access_token: string
}

export interface FBMessengerBotConfig {
  current: { workspace_id: string } | null
  workspaces: Record<string, FBMessengerBotWorkspaceEntry>
}

export interface FBMessengerBotCredentials {
  workspace_id: string
  workspace_name: string
  page_id: string
  access_token: string
}

export interface FBMessengerBotPage {
  id: string
  name: string
}

export interface FBMessengerBotSendMessageResponse {
  recipient_id: string
  message_id: string
}

export class FBMessengerBotError extends Error {
  code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'FBMessengerBotError'
    this.code = code
  }
}

export const FBMessengerBotWorkspaceEntrySchema = z.object({
  workspace_id: z.string(),
  workspace_name: z.string(),
  page_id: z.string(),
  access_token: z.string(),
})

export const FBMessengerBotConfigSchema = z.object({
  current: z
    .object({
      workspace_id: z.string(),
    })
    .nullable(),
  workspaces: z.record(z.string(), FBMessengerBotWorkspaceEntrySchema),
})

export const FBMessengerBotCredentialsSchema = z.object({
  workspace_id: z.string(),
  workspace_name: z.string(),
  page_id: z.string(),
  access_token: z.string(),
})

export const FBMessengerBotPageSchema = z.object({
  id: z.string(),
  name: z.string(),
})

export const FBMessengerBotSendMessageResponseSchema = z.object({
  recipient_id: z.string(),
  message_id: z.string(),
})
