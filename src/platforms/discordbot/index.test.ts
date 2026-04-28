import { expect, it } from 'bun:test'

import {
  DiscordBotClient,
  DiscordBotConfigSchema,
  DiscordBotCredentialManager,
  DiscordBotCredentialsSchema,
  DiscordBotEntrySchema,
  DiscordBotError,
  DiscordBotListener,
  DiscordChannelSchema,
  DiscordFileSchema,
  DiscordGatewayOpcode,
  DiscordGuildSchema,
  DiscordIntent,
  DiscordMessageSchema,
  DiscordReactionSchema,
  DiscordUserSchema,
} from '@/platforms/discordbot/index'

it('DiscordBotClient is exported from barrel', () => {
  expect(typeof DiscordBotClient).toBe('function')
})

it('DiscordBotError is exported from barrel', () => {
  expect(typeof DiscordBotError).toBe('function')
})

it('DiscordBotCredentialManager is exported from barrel', () => {
  expect(typeof DiscordBotCredentialManager).toBe('function')
})

it('DiscordBotListener is exported from barrel', () => {
  expect(typeof DiscordBotListener).toBe('function')
})

it('DiscordGatewayOpcode is exported from barrel', () => {
  expect(DiscordGatewayOpcode.Identify).toBe(2)
  expect(DiscordGatewayOpcode.Hello).toBe(10)
})

it('DiscordIntent is exported from barrel', () => {
  expect(DiscordIntent.Guilds).toBe(1)
  expect(DiscordIntent.GuildMessages).toBe(1 << 9)
  expect(DiscordIntent.MessageContent).toBe(1 << 15)
})

it('DiscordBotEntrySchema is exported from barrel', () => {
  expect(typeof DiscordBotEntrySchema.parse).toBe('function')
})

it('DiscordBotConfigSchema is exported from barrel', () => {
  expect(typeof DiscordBotConfigSchema.parse).toBe('function')
})

it('DiscordBotCredentialsSchema is exported from barrel', () => {
  expect(typeof DiscordBotCredentialsSchema.parse).toBe('function')
})

it('DiscordGuildSchema is exported from barrel', () => {
  expect(typeof DiscordGuildSchema.parse).toBe('function')
})

it('DiscordChannelSchema is exported from barrel', () => {
  expect(typeof DiscordChannelSchema.parse).toBe('function')
})

it('DiscordMessageSchema is exported from barrel', () => {
  expect(typeof DiscordMessageSchema.parse).toBe('function')
})

it('DiscordUserSchema is exported from barrel', () => {
  expect(typeof DiscordUserSchema.parse).toBe('function')
})

it('DiscordReactionSchema is exported from barrel', () => {
  expect(typeof DiscordReactionSchema.parse).toBe('function')
})

it('DiscordFileSchema is exported from barrel', () => {
  expect(typeof DiscordFileSchema.parse).toBe('function')
})
