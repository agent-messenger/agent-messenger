import { expect, test } from 'bun:test'

import {
  WeChatBotAccountEntrySchema,
  WeChatBotClient,
  WeChatBotConfigSchema,
  WeChatBotCredentialManager,
  WeChatBotCredentialsSchema,
  WeChatBotError,
  WeChatBotNewsArticleSchema,
  WeChatBotTemplateSchema,
  WeChatBotUserInfoSchema,
} from '@/platforms/wechatbot/index'

test('WeChatBotClient is exported from barrel', () => {
  expect(typeof WeChatBotClient).toBe('function')
})

test('WeChatBotCredentialManager is exported from barrel', () => {
  expect(typeof WeChatBotCredentialManager).toBe('function')
})

test('WeChatBotError is exported from barrel', () => {
  expect(typeof WeChatBotError).toBe('function')
})

test('WeChatBotAccountEntrySchema is exported from barrel', () => {
  expect(typeof WeChatBotAccountEntrySchema.parse).toBe('function')
})

test('WeChatBotConfigSchema is exported from barrel', () => {
  expect(typeof WeChatBotConfigSchema.parse).toBe('function')
})

test('WeChatBotCredentialsSchema is exported from barrel', () => {
  expect(typeof WeChatBotCredentialsSchema.parse).toBe('function')
})

test('WeChatBotNewsArticleSchema is exported from barrel', () => {
  expect(typeof WeChatBotNewsArticleSchema.parse).toBe('function')
})

test('WeChatBotTemplateSchema is exported from barrel', () => {
  expect(typeof WeChatBotTemplateSchema.parse).toBe('function')
})

test('WeChatBotUserInfoSchema is exported from barrel', () => {
  expect(typeof WeChatBotUserInfoSchema.parse).toBe('function')
})
