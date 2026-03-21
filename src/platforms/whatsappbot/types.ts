import { z } from 'zod'

export interface WhatsAppBotAccountEntry {
  phone_number_id: string
  account_name: string
  access_token: string
}

export interface WhatsAppBotConfig {
  current: { account_id: string } | null
  accounts: Record<string, WhatsAppBotAccountEntry>
}

export interface WhatsAppBotCredentials {
  phone_number_id: string
  account_name: string
  access_token: string
}

export interface WhatsAppBotMessageResponse {
  messaging_product: string
  contacts: Array<{ input: string; wa_id: string }>
  messages: Array<{ id: string }>
}

export interface WhatsAppBotTemplateComponent {
  type: string
  format?: string
  text?: string
  example?: unknown
  buttons?: unknown[]
}

export interface WhatsAppBotTemplate {
  name: string
  status: string
  category: string
  language: string
  components: WhatsAppBotTemplateComponent[]
}

export class WhatsAppBotError extends Error {
  code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'WhatsAppBotError'
    this.code = code
  }
}

export const WhatsAppBotAccountEntrySchema = z.object({
  phone_number_id: z.string(),
  account_name: z.string(),
  access_token: z.string(),
})

export const WhatsAppBotConfigSchema = z.object({
  current: z
    .object({
      account_id: z.string(),
    })
    .nullable(),
  accounts: z.record(z.string(), WhatsAppBotAccountEntrySchema),
})

export const WhatsAppBotCredentialsSchema = z.object({
  phone_number_id: z.string(),
  account_name: z.string(),
  access_token: z.string(),
})
