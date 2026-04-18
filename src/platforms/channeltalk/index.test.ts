import { expect, it } from 'bun:test'

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

it('ChannelClient is exported from barrel', () => {
  expect(typeof ChannelClient).toBe('function')
})

it('ChannelError is exported from barrel', () => {
  expect(typeof ChannelError).toBe('function')
})

it('ChannelCredentialManager is exported from barrel', () => {
  expect(typeof ChannelCredentialManager).toBe('function')
})

it('ChannelSchema is exported from barrel', () => {
  expect(typeof ChannelSchema.parse).toBe('function')
})

it('ChannelAccountSchema is exported from barrel', () => {
  expect(typeof ChannelAccountSchema.parse).toBe('function')
})

it('ChannelBotSchema is exported from barrel', () => {
  expect(typeof ChannelBotSchema.parse).toBe('function')
})

it('ChannelConfigSchema is exported from barrel', () => {
  expect(typeof ChannelConfigSchema.parse).toBe('function')
})

it('ChannelCredentialsSchema is exported from barrel', () => {
  expect(typeof ChannelCredentialsSchema.parse).toBe('function')
})

it('ChannelDirectChatSchema is exported from barrel', () => {
  expect(typeof ChannelDirectChatSchema.parse).toBe('function')
})

it('ChannelGroupSchema is exported from barrel', () => {
  expect(typeof ChannelGroupSchema.parse).toBe('function')
})

it('ChannelManagerSchema is exported from barrel', () => {
  expect(typeof ChannelManagerSchema.parse).toBe('function')
})

it('ChannelMessageSchema is exported from barrel', () => {
  expect(typeof ChannelMessageSchema.parse).toBe('function')
})

it('ChannelSessionSchema is exported from barrel', () => {
  expect(typeof ChannelSessionSchema.parse).toBe('function')
})

it('ChannelUserChatSchema is exported from barrel', () => {
  expect(typeof ChannelUserChatSchema.parse).toBe('function')
})

it('ChannelWorkspaceEntrySchema is exported from barrel', () => {
  expect(typeof ChannelWorkspaceEntrySchema.parse).toBe('function')
})

it('ChannelSearchHighlightSchema is exported from barrel', () => {
  expect(typeof ChannelSearchHighlightSchema.parse).toBe('function')
})

it('ChannelSearchHitSchema is exported from barrel', () => {
  expect(typeof ChannelSearchHitSchema.parse).toBe('function')
})

it('ChannelSearchResponseSchema is exported from barrel', () => {
  expect(typeof ChannelSearchResponseSchema.parse).toBe('function')
})

it('ExtractedChannelTokenSchema is exported from barrel', () => {
  expect(typeof ExtractedChannelTokenSchema.parse).toBe('function')
})

it('MessageBlockSchema is exported from barrel', () => {
  expect(typeof MessageBlockSchema.parse).toBe('function')
})

it('BlockInlineSchema is exported from barrel', () => {
  expect(typeof BlockInlineSchema.parse).toBe('function')
})

it('BlockInlineAttrsSchema is exported from barrel', () => {
  expect(typeof BlockInlineAttrsSchema.parse).toBe('function')
})
