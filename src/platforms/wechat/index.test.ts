import { expect, test } from 'bun:test'

import {
  createAccountId,
  WeChatAccountSchema,
  WeChatClient,
  WeChatConfigSchema,
  WeChatCredentialManager,
  WeChatError,
} from '@/platforms/wechat/index'

test('WeChatClient is exported from barrel', () => {
  expect(typeof WeChatClient).toBe('function')
})

test('WeChatCredentialManager is exported from barrel', () => {
  expect(typeof WeChatCredentialManager).toBe('function')
})

test('WeChatError is exported from barrel', () => {
  expect(typeof WeChatError).toBe('function')
})

test('WeChatAccountSchema is exported from barrel', () => {
  expect(typeof WeChatAccountSchema.parse).toBe('function')
})

test('WeChatConfigSchema is exported from barrel', () => {
  expect(typeof WeChatConfigSchema.parse).toBe('function')
})

test('createAccountId is exported from barrel', () => {
  expect(typeof createAccountId).toBe('function')
})
