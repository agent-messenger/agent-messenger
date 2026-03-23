import { expect, test } from 'bun:test'

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
  createDiscordClient,
} from '@/platforms/discord/index'

test('DiscordClient is exported from barrel', () => {
  expect(typeof DiscordClient).toBe('function')
})

test('DiscordError is exported from barrel', () => {
  expect(typeof DiscordError).toBe('function')
})

test('DiscordCredentialManager is exported from barrel', () => {
  expect(typeof DiscordCredentialManager).toBe('function')
})

test('createDiscordClient is exported from barrel', () => {
  expect(typeof createDiscordClient).toBe('function')
})

test('DiscordGuildSchema is exported from barrel', () => {
  expect(typeof DiscordGuildSchema.parse).toBe('function')
})

test('DiscordChannelSchema is exported from barrel', () => {
  expect(typeof DiscordChannelSchema.parse).toBe('function')
})

test('DiscordMessageSchema is exported from barrel', () => {
  expect(typeof DiscordMessageSchema.parse).toBe('function')
})

test('DiscordUserSchema is exported from barrel', () => {
  expect(typeof DiscordUserSchema.parse).toBe('function')
})

test('DiscordDMChannelSchema is exported from barrel', () => {
  expect(typeof DiscordDMChannelSchema.parse).toBe('function')
})

test('DiscordReactionSchema is exported from barrel', () => {
  expect(typeof DiscordReactionSchema.parse).toBe('function')
})

test('DiscordFileSchema is exported from barrel', () => {
  expect(typeof DiscordFileSchema.parse).toBe('function')
})

test('DiscordMentionSchema is exported from barrel', () => {
  expect(typeof DiscordMentionSchema.parse).toBe('function')
})

test('DiscordRelationshipSchema is exported from barrel', () => {
  expect(typeof DiscordRelationshipSchema.parse).toBe('function')
})

test('DiscordSearchResultSchema is exported from barrel', () => {
  expect(typeof DiscordSearchResultSchema.parse).toBe('function')
})

test('DiscordSearchResponseSchema is exported from barrel', () => {
  expect(typeof DiscordSearchResponseSchema.parse).toBe('function')
})

test('DiscordCredentialsSchema is exported from barrel', () => {
  expect(typeof DiscordCredentialsSchema.parse).toBe('function')
})

test('DiscordConfigSchema is exported from barrel', () => {
  expect(typeof DiscordConfigSchema.parse).toBe('function')
})
