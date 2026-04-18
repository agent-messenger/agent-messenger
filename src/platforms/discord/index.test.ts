import { expect, it } from 'bun:test'

import {
  DiscordChannelSchema,
  DiscordClient,
  DiscordConfigSchema,
  DiscordCredentialManager,
  DiscordCredentialsSchema,
  DiscordDMChannelSchema,
  DiscordError,
  DiscordFileSchema,
  DiscordGuildSchema,
  DiscordMentionSchema,
  DiscordMessageSchema,
  DiscordReactionSchema,
  DiscordRelationshipSchema,
  DiscordSearchResponseSchema,
  DiscordSearchResultSchema,
  DiscordUserSchema,
} from '@/platforms/discord/index'

it('DiscordClient is exported from barrel', () => {
  expect(typeof DiscordClient).toBe('function')
})

it('DiscordError is exported from barrel', () => {
  expect(typeof DiscordError).toBe('function')
})

it('DiscordCredentialManager is exported from barrel', () => {
  expect(typeof DiscordCredentialManager).toBe('function')
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

it('DiscordDMChannelSchema is exported from barrel', () => {
  expect(typeof DiscordDMChannelSchema.parse).toBe('function')
})

it('DiscordReactionSchema is exported from barrel', () => {
  expect(typeof DiscordReactionSchema.parse).toBe('function')
})

it('DiscordFileSchema is exported from barrel', () => {
  expect(typeof DiscordFileSchema.parse).toBe('function')
})

it('DiscordMentionSchema is exported from barrel', () => {
  expect(typeof DiscordMentionSchema.parse).toBe('function')
})

it('DiscordRelationshipSchema is exported from barrel', () => {
  expect(typeof DiscordRelationshipSchema.parse).toBe('function')
})

it('DiscordSearchResultSchema is exported from barrel', () => {
  expect(typeof DiscordSearchResultSchema.parse).toBe('function')
})

it('DiscordSearchResponseSchema is exported from barrel', () => {
  expect(typeof DiscordSearchResponseSchema.parse).toBe('function')
})

it('DiscordCredentialsSchema is exported from barrel', () => {
  expect(typeof DiscordCredentialsSchema.parse).toBe('function')
})

it('DiscordConfigSchema is exported from barrel', () => {
  expect(typeof DiscordConfigSchema.parse).toBe('function')
})
