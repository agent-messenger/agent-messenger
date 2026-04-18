import { expect, it } from 'bun:test'

import {
  WeChatBotAccountEntrySchema,
  WeChatBotConfigSchema,
  WeChatBotCredentialsSchema,
  WeChatBotError,
  WeChatBotNewsArticleSchema,
  WeChatBotTemplateSchema,
  WeChatBotUserInfoSchema,
} from '@/platforms/wechatbot/types'

it('WeChatBotAccountEntrySchema validates correct data', () => {
  const result = WeChatBotAccountEntrySchema.safeParse({
    app_id: 'wx123',
    app_secret: 'secret123',
    account_name: 'My Account',
  })
  expect(result.success).toBe(true)
})

it('WeChatBotAccountEntrySchema rejects missing app_id', () => {
  const result = WeChatBotAccountEntrySchema.safeParse({
    app_secret: 'secret123',
    account_name: 'My Account',
  })
  expect(result.success).toBe(false)
})

it('WeChatBotAccountEntrySchema rejects missing app_secret', () => {
  const result = WeChatBotAccountEntrySchema.safeParse({
    app_id: 'wx123',
    account_name: 'My Account',
  })
  expect(result.success).toBe(false)
})

it('WeChatBotAccountEntrySchema rejects missing account_name', () => {
  const result = WeChatBotAccountEntrySchema.safeParse({
    app_id: 'wx123',
    app_secret: 'secret123',
  })
  expect(result.success).toBe(false)
})

it('WeChatBotConfigSchema validates with current account', () => {
  const result = WeChatBotConfigSchema.safeParse({
    current: { account_id: 'wx123' },
    accounts: {
      wx123: { app_id: 'wx123', app_secret: 'secret123', account_name: 'My Account' },
    },
  })
  expect(result.success).toBe(true)
})

it('WeChatBotConfigSchema validates with current null and empty accounts', () => {
  const result = WeChatBotConfigSchema.safeParse({
    current: null,
    accounts: {},
  })
  expect(result.success).toBe(true)
})

it('WeChatBotConfigSchema validates with multiple accounts', () => {
  const result = WeChatBotConfigSchema.safeParse({
    current: { account_id: 'wx-a' },
    accounts: {
      'wx-a': { app_id: 'wx-a', app_secret: 'secret-a', account_name: 'Account A' },
      'wx-b': { app_id: 'wx-b', app_secret: 'secret-b', account_name: 'Account B' },
    },
  })
  expect(result.success).toBe(true)
})

it('WeChatBotConfigSchema rejects missing accounts field', () => {
  const result = WeChatBotConfigSchema.safeParse({ current: null })
  expect(result.success).toBe(false)
})

it('WeChatBotConfigSchema rejects missing current field', () => {
  const result = WeChatBotConfigSchema.safeParse({ accounts: {} })
  expect(result.success).toBe(false)
})

it('WeChatBotCredentialsSchema validates correct data', () => {
  const result = WeChatBotCredentialsSchema.safeParse({
    app_id: 'wx123',
    app_secret: 'secret123',
    account_name: 'My Account',
  })
  expect(result.success).toBe(true)
})

it('WeChatBotCredentialsSchema rejects missing app_id', () => {
  const result = WeChatBotCredentialsSchema.safeParse({
    app_secret: 'secret123',
    account_name: 'My Account',
  })
  expect(result.success).toBe(false)
})

it('WeChatBotCredentialsSchema rejects missing app_secret', () => {
  const result = WeChatBotCredentialsSchema.safeParse({
    app_id: 'wx123',
    account_name: 'My Account',
  })
  expect(result.success).toBe(false)
})

it('WeChatBotCredentialsSchema rejects missing account_name', () => {
  const result = WeChatBotCredentialsSchema.safeParse({
    app_id: 'wx123',
    app_secret: 'secret123',
  })
  expect(result.success).toBe(false)
})

it('WeChatBotNewsArticleSchema validates correct data', () => {
  const result = WeChatBotNewsArticleSchema.safeParse({
    title: 'Test Article',
    description: 'Test description',
    url: 'https://example.com',
    picurl: 'https://example.com/pic.jpg',
  })
  expect(result.success).toBe(true)
})

it('WeChatBotNewsArticleSchema rejects missing title', () => {
  const result = WeChatBotNewsArticleSchema.safeParse({
    description: 'Test description',
    url: 'https://example.com',
    picurl: 'https://example.com/pic.jpg',
  })
  expect(result.success).toBe(false)
})

it('WeChatBotTemplateSchema validates correct data', () => {
  const result = WeChatBotTemplateSchema.safeParse({
    template_id: 'tmpl-001',
    title: 'Order Notification',
    primary_industry: 'IT科技',
    deputy_industry: '互联网|电子商务',
    content: 'ORDER_STATUS {{status.DATA}}',
    example: 'Order shipped',
  })
  expect(result.success).toBe(true)
})

it('WeChatBotTemplateSchema rejects missing template_id', () => {
  const result = WeChatBotTemplateSchema.safeParse({
    title: 'Order Notification',
    primary_industry: 'IT科技',
    deputy_industry: '互联网|电子商务',
    content: 'ORDER_STATUS {{status.DATA}}',
    example: 'Order shipped',
  })
  expect(result.success).toBe(false)
})

it('WeChatBotUserInfoSchema validates correct data', () => {
  const result = WeChatBotUserInfoSchema.safeParse({
    subscribe: 1,
    openid: 'openid-123',
    language: 'zh_CN',
    subscribe_time: 1609459200,
    remark: '',
    tagid_list: [1, 2],
    subscribe_scene: 'ADD_SCENE_QR_CODE',
    qr_scene: 0,
    qr_scene_str: '',
  })
  expect(result.success).toBe(true)
})

it('WeChatBotUserInfoSchema validates with optional unionid', () => {
  const result = WeChatBotUserInfoSchema.safeParse({
    subscribe: 1,
    openid: 'openid-123',
    language: 'zh_CN',
    subscribe_time: 1609459200,
    unionid: 'union-id-xyz',
    remark: '',
    tagid_list: [],
    subscribe_scene: 'ADD_SCENE_SEARCH',
    qr_scene: 0,
    qr_scene_str: '',
  })
  expect(result.success).toBe(true)
})

it('WeChatBotUserInfoSchema rejects missing openid', () => {
  const result = WeChatBotUserInfoSchema.safeParse({
    subscribe: 1,
    language: 'zh_CN',
    subscribe_time: 1609459200,
    remark: '',
    tagid_list: [],
    subscribe_scene: 'ADD_SCENE_QR_CODE',
    qr_scene: 0,
    qr_scene_str: '',
  })
  expect(result.success).toBe(false)
})

it('WeChatBotError has correct name', () => {
  const error = new WeChatBotError('Test error', 'TEST_CODE')
  expect(error.name).toBe('WeChatBotError')
})

it('WeChatBotError has correct message', () => {
  const error = new WeChatBotError('Test error', 'TEST_CODE')
  expect(error.message).toBe('Test error')
})

it('WeChatBotError has correct code', () => {
  const error = new WeChatBotError('Test error', 'TEST_CODE')
  expect(error.code).toBe('TEST_CODE')
})

it('WeChatBotError is instance of Error', () => {
  const error = new WeChatBotError('Test error', 'TEST_CODE')
  expect(error instanceof Error).toBe(true)
})
