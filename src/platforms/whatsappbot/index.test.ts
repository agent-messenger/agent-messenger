import { expect, test } from 'bun:test'

import {
  WhatsAppBotAccountEntrySchema,
  WhatsAppBotClient,
  WhatsAppBotConfigSchema,
  WhatsAppBotCredentialManager,
  WhatsAppBotCredentialsSchema,
  WhatsAppBotError,
} from '@/platforms/whatsappbot/index'

test('WhatsAppBotClient is exported from barrel', () => {
  expect(typeof WhatsAppBotClient).toBe('function')
})

test('WhatsAppBotCredentialManager is exported from barrel', () => {
  expect(typeof WhatsAppBotCredentialManager).toBe('function')
})

test('WhatsAppBotError is exported from barrel', () => {
  expect(typeof WhatsAppBotError).toBe('function')
})

test('WhatsAppBotAccountEntrySchema is exported from barrel', () => {
  expect(typeof WhatsAppBotAccountEntrySchema.parse).toBe('function')
})

test('WhatsAppBotConfigSchema is exported from barrel', () => {
  expect(typeof WhatsAppBotConfigSchema.parse).toBe('function')
})

test('WhatsAppBotCredentialsSchema is exported from barrel', () => {
  expect(typeof WhatsAppBotCredentialsSchema.parse).toBe('function')
})
