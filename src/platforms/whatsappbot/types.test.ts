import { expect, test } from 'bun:test'

import {
  WhatsAppBotAccountEntrySchema,
  WhatsAppBotConfigSchema,
  WhatsAppBotCredentialsSchema,
  WhatsAppBotError,
} from '@/platforms/whatsappbot/types'

test('WhatsAppBotAccountEntrySchema validates correct data', () => {
  const result = WhatsAppBotAccountEntrySchema.safeParse({
    phone_number_id: '123456789',
    account_name: 'Test Business',
    access_token: 'EAAtest123',
  })
  expect(result.success).toBe(true)
})

test('WhatsAppBotAccountEntrySchema rejects missing phone_number_id', () => {
  const result = WhatsAppBotAccountEntrySchema.safeParse({
    account_name: 'Test Business',
    access_token: 'EAAtest123',
  })
  expect(result.success).toBe(false)
})

test('WhatsAppBotAccountEntrySchema rejects missing account_name', () => {
  const result = WhatsAppBotAccountEntrySchema.safeParse({
    phone_number_id: '123456789',
    access_token: 'EAAtest123',
  })
  expect(result.success).toBe(false)
})

test('WhatsAppBotAccountEntrySchema rejects missing access_token', () => {
  const result = WhatsAppBotAccountEntrySchema.safeParse({
    phone_number_id: '123456789',
    account_name: 'Test Business',
  })
  expect(result.success).toBe(false)
})

test('WhatsAppBotConfigSchema validates with current account', () => {
  const result = WhatsAppBotConfigSchema.safeParse({
    current: { account_id: '123456789' },
    accounts: {
      '123456789': {
        phone_number_id: '123456789',
        account_name: 'Test Business',
        access_token: 'EAAtest123',
      },
    },
  })
  expect(result.success).toBe(true)
})

test('WhatsAppBotConfigSchema validates with current null and empty accounts', () => {
  const result = WhatsAppBotConfigSchema.safeParse({
    current: null,
    accounts: {},
  })
  expect(result.success).toBe(true)
})

test('WhatsAppBotConfigSchema validates with multiple accounts', () => {
  const result = WhatsAppBotConfigSchema.safeParse({
    current: { account_id: 'phone-1' },
    accounts: {
      'phone-1': { phone_number_id: 'phone-1', account_name: 'Account 1', access_token: 'token-1' },
      'phone-2': { phone_number_id: 'phone-2', account_name: 'Account 2', access_token: 'token-2' },
    },
  })
  expect(result.success).toBe(true)
})

test('WhatsAppBotConfigSchema rejects missing accounts field', () => {
  const result = WhatsAppBotConfigSchema.safeParse({
    current: null,
  })
  expect(result.success).toBe(false)
})

test('WhatsAppBotConfigSchema rejects missing current field', () => {
  const result = WhatsAppBotConfigSchema.safeParse({
    accounts: {},
  })
  expect(result.success).toBe(false)
})

test('WhatsAppBotCredentialsSchema validates correct data', () => {
  const result = WhatsAppBotCredentialsSchema.safeParse({
    phone_number_id: '123456789',
    account_name: 'Test Business',
    access_token: 'EAAtest123',
  })
  expect(result.success).toBe(true)
})

test('WhatsAppBotCredentialsSchema rejects missing phone_number_id', () => {
  const result = WhatsAppBotCredentialsSchema.safeParse({
    account_name: 'Test Business',
    access_token: 'EAAtest123',
  })
  expect(result.success).toBe(false)
})

test('WhatsAppBotCredentialsSchema rejects missing account_name', () => {
  const result = WhatsAppBotCredentialsSchema.safeParse({
    phone_number_id: '123456789',
    access_token: 'EAAtest123',
  })
  expect(result.success).toBe(false)
})

test('WhatsAppBotCredentialsSchema rejects missing access_token', () => {
  const result = WhatsAppBotCredentialsSchema.safeParse({
    phone_number_id: '123456789',
    account_name: 'Test Business',
  })
  expect(result.success).toBe(false)
})

test('WhatsAppBotError has correct name', () => {
  const error = new WhatsAppBotError('Test error', 'TEST_CODE')
  expect(error.name).toBe('WhatsAppBotError')
})

test('WhatsAppBotError has correct message', () => {
  const error = new WhatsAppBotError('Test error', 'TEST_CODE')
  expect(error.message).toBe('Test error')
})

test('WhatsAppBotError has correct code', () => {
  const error = new WhatsAppBotError('Test error', 'TEST_CODE')
  expect(error.code).toBe('TEST_CODE')
})

test('WhatsAppBotError is instance of Error', () => {
  const error = new WhatsAppBotError('Test error', 'TEST_CODE')
  expect(error instanceof Error).toBe(true)
})
