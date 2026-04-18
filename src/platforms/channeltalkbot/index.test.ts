import { expect, it } from 'bun:test'

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
} from '@/platforms/channeltalkbot/index'

it('ChannelBotClient is exported from barrel', () => {
  expect(typeof ChannelBotClient).toBe('function')
})

it('ChannelBotError is exported from barrel', () => {
  expect(typeof ChannelBotError).toBe('function')
})

it('ChannelBotCredentialManager is exported from barrel', () => {
  expect(typeof ChannelBotCredentialManager).toBe('function')
})

it('ChannelBotBotSchema is exported from barrel', () => {
  expect(typeof ChannelBotBotSchema.parse).toBe('function')
})

it('ChannelBotChannelSchema is exported from barrel', () => {
  expect(typeof ChannelBotChannelSchema.parse).toBe('function')
})

it('ChannelBotConfigSchema is exported from barrel', () => {
  expect(typeof ChannelBotConfigSchema.parse).toBe('function')
})

it('ChannelBotCredentialsSchema is exported from barrel', () => {
  expect(typeof ChannelBotCredentialsSchema.parse).toBe('function')
})

it('ChannelBotGroupSchema is exported from barrel', () => {
  expect(typeof ChannelBotGroupSchema.parse).toBe('function')
})

it('ChannelBotManagerSchema is exported from barrel', () => {
  expect(typeof ChannelBotManagerSchema.parse).toBe('function')
})

it('ChannelBotMessageSchema is exported from barrel', () => {
  expect(typeof ChannelBotMessageSchema.parse).toBe('function')
})

it('ChannelBotUserChatSchema is exported from barrel', () => {
  expect(typeof ChannelBotUserChatSchema.parse).toBe('function')
})

it('ChannelBotUserSchema is exported from barrel', () => {
  expect(typeof ChannelBotUserSchema.parse).toBe('function')
})

it('ChannelBotWorkspaceEntrySchema is exported from barrel', () => {
  expect(typeof ChannelBotWorkspaceEntrySchema.parse).toBe('function')
})

it('MessageBlockSchema is exported from barrel', () => {
  expect(typeof MessageBlockSchema.parse).toBe('function')
})
