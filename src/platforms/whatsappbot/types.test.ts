import { expect, it } from 'bun:test'

import {
  WhatsAppBotAccountEntrySchema,
  WhatsAppBotConfigSchema,
  WhatsAppBotCredentialsSchema,
  WhatsAppBotError,
} from '@/platforms/whatsappbot/types'

it('WhatsAppBotAccountEntrySchema validates correct data', () => {
  const result = WhatsAppBotAccountEntrySchema.safeParse({
    phone_number_id: '123456789',
    account_name: 'Test Business',
    access_token: 'EAAtest123',
  })
  expect(result.success).toBe(true)
})

it('WhatsAppBotAccountEntrySchema rejects missing phone_number_id', () => {
  const result = WhatsAppBotAccountEntrySchema.safeParse({
    account_name: 'Test Business',
    access_token: 'EAAtest123',
  })
  expect(result.success).toBe(false)
})

it('WhatsAppBotAccountEntrySchema rejects missing account_name', () => {
  const result = WhatsAppBotAccountEntrySchema.safeParse({
    phone_number_id: '123456789',
    access_token: 'EAAtest123',
  })
  expect(result.success).toBe(false)
})

it('WhatsAppBotAccountEntrySchema rejects missing access_token', () => {
  const result = WhatsAppBotAccountEntrySchema.safeParse({
    phone_number_id: '123456789',
    account_name: 'Test Business',
  })
  expect(result.success).toBe(false)
})

it('WhatsAppBotConfigSchema validates with current account', () => {
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

it('WhatsAppBotConfigSchema validates with current null and empty accounts', () => {
  const result = WhatsAppBotConfigSchema.safeParse({
    current: null,
    accounts: {},
  })
  expect(result.success).toBe(true)
})

it('WhatsAppBotConfigSchema validates with multiple accounts', () => {
  const result = WhatsAppBotConfigSchema.safeParse({
    current: { account_id: 'phone-1' },
    accounts: {
      'phone-1': { phone_number_id: 'phone-1', account_name: 'Account 1', access_token: 'token-1' },
      'phone-2': { phone_number_id: 'phone-2', account_name: 'Account 2', access_token: 'token-2' },
    },
  })
  expect(result.success).toBe(true)
})

it('WhatsAppBotConfigSchema rejects missing accounts field', () => {
  const result = WhatsAppBotConfigSchema.safeParse({
    current: null,
  })
  expect(result.success).toBe(false)
})

it('WhatsAppBotConfigSchema rejects missing current field', () => {
  const result = WhatsAppBotConfigSchema.safeParse({
    accounts: {},
  })
  expect(result.success).toBe(false)
})

it('WhatsAppBotCredentialsSchema validates correct data', () => {
  const result = WhatsAppBotCredentialsSchema.safeParse({
    phone_number_id: '123456789',
    account_name: 'Test Business',
    access_token: 'EAAtest123',
  })
  expect(result.success).toBe(true)
})

it('WhatsAppBotCredentialsSchema rejects missing phone_number_id', () => {
  const result = WhatsAppBotCredentialsSchema.safeParse({
    account_name: 'Test Business',
    access_token: 'EAAtest123',
  })
  expect(result.success).toBe(false)
})

it('WhatsAppBotCredentialsSchema rejects missing account_name', () => {
  const result = WhatsAppBotCredentialsSchema.safeParse({
    phone_number_id: '123456789',
    access_token: 'EAAtest123',
  })
  expect(result.success).toBe(false)
})

it('WhatsAppBotCredentialsSchema rejects missing access_token', () => {
  const result = WhatsAppBotCredentialsSchema.safeParse({
    phone_number_id: '123456789',
    account_name: 'Test Business',
  })
  expect(result.success).toBe(false)
})

it('WhatsAppBotError has correct name', () => {
  const error = new WhatsAppBotError('Test error', 'TEST_CODE')
  expect(error.name).toBe('WhatsAppBotError')
})

it('WhatsAppBotError has correct message', () => {
  const error = new WhatsAppBotError('Test error', 'TEST_CODE')
  expect(error.message).toBe('Test error')
})

it('WhatsAppBotError has correct code', () => {
  const error = new WhatsAppBotError('Test error', 'TEST_CODE')
  expect(error.code).toBe('TEST_CODE')
})

it('WhatsAppBotError is instance of Error', () => {
  const error = new WhatsAppBotError('Test error', 'TEST_CODE')
  expect(error instanceof Error).toBe(true)
})
