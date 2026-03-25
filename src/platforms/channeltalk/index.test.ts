import { expect, test } from 'bun:test'

import {
  BlockInlineAttrsSchema,
  BlockInlineSchema,
  ChannelAccountSchema,
  ChannelBotSchema,
  ChannelClient,
  ChannelConfigSchema,
  ChannelCredentialManager,
  ChannelCredentialsSchema,
  ChannelDirectChatSchema,
  ChannelError,
  ChannelGroupSchema,
  ChannelManagerSchema,
  ChannelMessageSchema,
  ChannelSchema,
  ChannelSearchHighlightSchema,
  ChannelSearchHitSchema,
  ChannelSearchResponseSchema,
  ChannelSessionSchema,
  ChannelUserChatSchema,
  ChannelWorkspaceEntrySchema,
  ExtractedChannelTokenSchema,
  MessageBlockSchema,
} from '@/platforms/channeltalk/index'

test('ChannelClient is exported from barrel', () => {
  expect(typeof ChannelClient).toBe('function')
})

test('ChannelError is exported from barrel', () => {
  expect(typeof ChannelError).toBe('function')
})

test('ChannelCredentialManager is exported from barrel', () => {
  expect(typeof ChannelCredentialManager).toBe('function')
})

test('ChannelSchema is exported from barrel', () => {
  expect(typeof ChannelSchema.parse).toBe('function')
})

test('ChannelAccountSchema is exported from barrel', () => {
  expect(typeof ChannelAccountSchema.parse).toBe('function')
})

test('ChannelBotSchema is exported from barrel', () => {
  expect(typeof ChannelBotSchema.parse).toBe('function')
})

test('ChannelConfigSchema is exported from barrel', () => {
  expect(typeof ChannelConfigSchema.parse).toBe('function')
})

test('ChannelCredentialsSchema is exported from barrel', () => {
  expect(typeof ChannelCredentialsSchema.parse).toBe('function')
})

test('ChannelDirectChatSchema is exported from barrel', () => {
  expect(typeof ChannelDirectChatSchema.parse).toBe('function')
})

test('ChannelGroupSchema is exported from barrel', () => {
  expect(typeof ChannelGroupSchema.parse).toBe('function')
})

test('ChannelManagerSchema is exported from barrel', () => {
  expect(typeof ChannelManagerSchema.parse).toBe('function')
})

test('ChannelMessageSchema is exported from barrel', () => {
  expect(typeof ChannelMessageSchema.parse).toBe('function')
})

test('ChannelSessionSchema is exported from barrel', () => {
  expect(typeof ChannelSessionSchema.parse).toBe('function')
})

test('ChannelUserChatSchema is exported from barrel', () => {
  expect(typeof ChannelUserChatSchema.parse).toBe('function')
})

test('ChannelWorkspaceEntrySchema is exported from barrel', () => {
  expect(typeof ChannelWorkspaceEntrySchema.parse).toBe('function')
})

test('ChannelSearchHighlightSchema is exported from barrel', () => {
  expect(typeof ChannelSearchHighlightSchema.parse).toBe('function')
})

test('ChannelSearchHitSchema is exported from barrel', () => {
  expect(typeof ChannelSearchHitSchema.parse).toBe('function')
})

test('ChannelSearchResponseSchema is exported from barrel', () => {
  expect(typeof ChannelSearchResponseSchema.parse).toBe('function')
})

test('ExtractedChannelTokenSchema is exported from barrel', () => {
  expect(typeof ExtractedChannelTokenSchema.parse).toBe('function')
})

test('MessageBlockSchema is exported from barrel', () => {
  expect(typeof MessageBlockSchema.parse).toBe('function')
})

test('BlockInlineSchema is exported from barrel', () => {
  expect(typeof BlockInlineSchema.parse).toBe('function')
})

test('BlockInlineAttrsSchema is exported from barrel', () => {
  expect(typeof BlockInlineAttrsSchema.parse).toBe('function')
})
