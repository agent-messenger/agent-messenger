import { expect, it } from 'bun:test'

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

it('WeChatBotClient is exported from barrel', () => {
  expect(typeof WeChatBotClient).toBe('function')
})

it('WeChatBotCredentialManager is exported from barrel', () => {
  expect(typeof WeChatBotCredentialManager).toBe('function')
})

it('WeChatBotError is exported from barrel', () => {
  expect(typeof WeChatBotError).toBe('function')
})

it('WeChatBotAccountEntrySchema is exported from barrel', () => {
  expect(typeof WeChatBotAccountEntrySchema.parse).toBe('function')
})

it('WeChatBotConfigSchema is exported from barrel', () => {
  expect(typeof WeChatBotConfigSchema.parse).toBe('function')
})

it('WeChatBotCredentialsSchema is exported from barrel', () => {
  expect(typeof WeChatBotCredentialsSchema.parse).toBe('function')
})

it('WeChatBotNewsArticleSchema is exported from barrel', () => {
  expect(typeof WeChatBotNewsArticleSchema.parse).toBe('function')
})

it('WeChatBotTemplateSchema is exported from barrel', () => {
  expect(typeof WeChatBotTemplateSchema.parse).toBe('function')
})

it('WeChatBotUserInfoSchema is exported from barrel', () => {
  expect(typeof WeChatBotUserInfoSchema.parse).toBe('function')
})
