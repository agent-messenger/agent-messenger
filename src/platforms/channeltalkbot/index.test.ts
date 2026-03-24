import { expect, test } from 'bun:test'

import {
  ChannelBotBotSchema,
  ChannelBotChannelSchema,
  ChannelBotClient,
  ChannelBotConfigSchema,
  ChannelBotCredentialManager,
  ChannelBotCredentialsSchema,
  ChannelBotError,
  ChannelBotGroupSchema,
  ChannelBotManagerSchema,
  ChannelBotMessageSchema,
  ChannelBotUserChatSchema,
  ChannelBotUserSchema,
  ChannelBotWorkspaceEntrySchema,
  MessageBlockSchema,
  createChannelBotClient,
} from '@/platforms/channeltalkbot/index'

test('ChannelBotClient is exported from barrel', () => {
  expect(typeof ChannelBotClient).toBe('function')
})

test('ChannelBotError is exported from barrel', () => {
  expect(typeof ChannelBotError).toBe('function')
})

test('ChannelBotCredentialManager is exported from barrel', () => {
  expect(typeof ChannelBotCredentialManager).toBe('function')
})

test('ChannelBotBotSchema is exported from barrel', () => {
  expect(typeof ChannelBotBotSchema.parse).toBe('function')
})

test('ChannelBotChannelSchema is exported from barrel', () => {
  expect(typeof ChannelBotChannelSchema.parse).toBe('function')
})

test('ChannelBotConfigSchema is exported from barrel', () => {
  expect(typeof ChannelBotConfigSchema.parse).toBe('function')
})

test('ChannelBotCredentialsSchema is exported from barrel', () => {
  expect(typeof ChannelBotCredentialsSchema.parse).toBe('function')
})

test('ChannelBotGroupSchema is exported from barrel', () => {
  expect(typeof ChannelBotGroupSchema.parse).toBe('function')
})

test('ChannelBotManagerSchema is exported from barrel', () => {
  expect(typeof ChannelBotManagerSchema.parse).toBe('function')
})

test('ChannelBotMessageSchema is exported from barrel', () => {
  expect(typeof ChannelBotMessageSchema.parse).toBe('function')
})

test('ChannelBotUserChatSchema is exported from barrel', () => {
  expect(typeof ChannelBotUserChatSchema.parse).toBe('function')
})

test('ChannelBotUserSchema is exported from barrel', () => {
  expect(typeof ChannelBotUserSchema.parse).toBe('function')
})

test('ChannelBotWorkspaceEntrySchema is exported from barrel', () => {
  expect(typeof ChannelBotWorkspaceEntrySchema.parse).toBe('function')
})

test('MessageBlockSchema is exported from barrel', () => {
  expect(typeof MessageBlockSchema.parse).toBe('function')
})

test('createChannelBotClient is exported from barrel', () => {
  expect(typeof createChannelBotClient).toBe('function')
})
