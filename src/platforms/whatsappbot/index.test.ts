import { expect, it } from 'bun:test'

import {
  WhatsAppBotAccountEntrySchema,
  WhatsAppBotClient,
  WhatsAppBotConfigSchema,
  WhatsAppBotCredentialManager,
  WhatsAppBotCredentialsSchema,
  WhatsAppBotError,
} from '@/platforms/whatsappbot/index'

it('WhatsAppBotClient is exported from barrel', () => {
  expect(typeof WhatsAppBotClient).toBe('function')
})

it('WhatsAppBotCredentialManager is exported from barrel', () => {
  expect(typeof WhatsAppBotCredentialManager).toBe('function')
})

it('WhatsAppBotError is exported from barrel', () => {
  expect(typeof WhatsAppBotError).toBe('function')
})

it('WhatsAppBotAccountEntrySchema is exported from barrel', () => {
  expect(typeof WhatsAppBotAccountEntrySchema.parse).toBe('function')
})

it('WhatsAppBotConfigSchema is exported from barrel', () => {
  expect(typeof WhatsAppBotConfigSchema.parse).toBe('function')
})

it('WhatsAppBotCredentialsSchema is exported from barrel', () => {
  expect(typeof WhatsAppBotCredentialsSchema.parse).toBe('function')
})
