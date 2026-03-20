import { z } from 'zod'

export interface WhatsAppBotWorkspaceEntry {
  workspace_id: string
  workspace_name: string
  phone_number_id: string
  access_token: string
}

export interface WhatsAppBotConfig {
  current: { workspace_id: string } | null
  workspaces: Record<string, WhatsAppBotWorkspaceEntry>
}

export interface WhatsAppBotCredentials {
  workspace_id: string
  workspace_name: string
  phone_number_id: string
  access_token: string
}

export interface WhatsAppBusinessProfile {
  about?: string
  address?: string
  description?: string
  email?: string
  profile_picture_url?: string
  websites?: string[]
  vertical?: string
}

export interface WhatsAppBusinessProfileResponse {
  data: WhatsAppBusinessProfile[]
}

export interface WhatsAppContact {
  input: string
  wa_id: string
}

export interface WhatsAppMessageStatus {
  id: string
}

export interface WhatsAppSendMessageResponse {
  messaging_product: 'whatsapp'
  contacts?: WhatsAppContact[]
  messages?: WhatsAppMessageStatus[]
}

export interface WhatsAppApiErrorPayload {
  message: string
  type?: string
  code?: number
  error_subcode?: number
  fbtrace_id?: string
}

export class WhatsAppBotError extends Error {
  code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'WhatsAppBotError'
    this.code = code
  }
}

export const WhatsAppBotWorkspaceEntrySchema = z.object({
  workspace_id: z.string(),
  workspace_name: z.string(),
  phone_number_id: z.string(),
  access_token: z.string(),
})

export const WhatsAppBotConfigSchema = z.object({
  current: z
    .object({
      workspace_id: z.string(),
    })
    .nullable(),
  workspaces: z.record(z.string(), WhatsAppBotWorkspaceEntrySchema),
})

export const WhatsAppBotCredentialsSchema = z.object({
  workspace_id: z.string(),
  workspace_name: z.string(),
  phone_number_id: z.string(),
  access_token: z.string(),
})

export const WhatsAppBusinessProfileSchema = z.object({
  about: z.string().optional(),
  address: z.string().optional(),
  description: z.string().optional(),
  email: z.string().optional(),
  profile_picture_url: z.string().optional(),
  websites: z.array(z.string()).optional(),
  vertical: z.string().optional(),
})

export const WhatsAppBusinessProfileResponseSchema = z.object({
  data: z.array(WhatsAppBusinessProfileSchema),
})

export const WhatsAppContactSchema = z.object({
  input: z.string(),
  wa_id: z.string(),
})

export const WhatsAppMessageStatusSchema = z.object({
  id: z.string(),
})

export const WhatsAppSendMessageResponseSchema = z.object({
  messaging_product: z.literal('whatsapp'),
  contacts: z.array(WhatsAppContactSchema).optional(),
  messages: z.array(WhatsAppMessageStatusSchema).optional(),
})

export const WhatsAppApiErrorPayloadSchema = z.object({
  message: z.string(),
  type: z.string().optional(),
  code: z.number().optional(),
  error_subcode: z.number().optional(),
  fbtrace_id: z.string().optional(),
})
