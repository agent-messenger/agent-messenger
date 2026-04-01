import { expect, test } from 'bun:test'

import {
  createAccountId,
  WeChatAccountSchema,
  WeChatConfigSchema,
  WeChatError,
} from '@/platforms/wechat/types'

test('WeChatAccountSchema validates correct data', () => {
  const result = WeChatAccountSchema.safeParse({
    account_id: 'wxid-123',
    name: 'Test User',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  })
  expect(result.success).toBe(true)
})

test('WeChatAccountSchema validates without optional name', () => {
  const result = WeChatAccountSchema.safeParse({
    account_id: 'wxid-123',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  })
  expect(result.success).toBe(true)
})

test('WeChatAccountSchema rejects missing account_id', () => {
  const result = WeChatAccountSchema.safeParse({
    name: 'Test User',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  })
  expect(result.success).toBe(false)
})

test('WeChatConfigSchema validates with null current and empty accounts', () => {
  const result = WeChatConfigSchema.safeParse({
    current: null,
    accounts: {},
  })
  expect(result.success).toBe(true)
})

test('WeChatConfigSchema validates with current account', () => {
  const result = WeChatConfigSchema.safeParse({
    current: 'wxid-123',
    accounts: {
      'wxid-123': {
        account_id: 'wxid-123',
        name: 'Test User',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      },
    },
  })
  expect(result.success).toBe(true)
})

test('WeChatConfigSchema rejects missing current field', () => {
  const result = WeChatConfigSchema.safeParse({ accounts: {} })
  expect(result.success).toBe(false)
})

test('WeChatConfigSchema rejects missing accounts field', () => {
  const result = WeChatConfigSchema.safeParse({ current: null })
  expect(result.success).toBe(false)
})

test('WeChatError has correct name', () => {
  const error = new WeChatError('Test error', 'TEST_CODE')
  expect(error.name).toBe('WeChatError')
})

test('WeChatError has correct message', () => {
  const error = new WeChatError('Test error', 'TEST_CODE')
  expect(error.message).toBe('Test error')
})

test('WeChatError has correct code', () => {
  const error = new WeChatError('Test error', 'TEST_CODE')
  expect(error.code).toBe('TEST_CODE')
})

test('WeChatError uses default code when not provided', () => {
  const error = new WeChatError('Test error')
  expect(error.code).toBe('wechat_error')
})

test('WeChatError is instance of Error', () => {
  const error = new WeChatError('Test error', 'TEST_CODE')
  expect(error instanceof Error).toBe(true)
})

test('createAccountId normalizes wxid', () => {
  expect(createAccountId('wxid_abc123')).toBe('wxid_abc123')
})

test('createAccountId lowercases and replaces special chars', () => {
  expect(createAccountId('WX-ABC@123')).toBe('wx-abc-123')
})

test('createAccountId trims surrounding dashes', () => {
  expect(createAccountId('  wxid  ')).toBe('wxid')
})

test('createAccountId returns default for empty string', () => {
  expect(createAccountId('')).toBe('default')
})
