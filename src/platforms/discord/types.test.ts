import { expect, it } from 'bun:test'

import {
  DiscordChannelSchema,
  DiscordConfigSchema,
  DiscordCredentialsSchema,
  DiscordError,
  DiscordFileSchema,
  DiscordGuildSchema,
  DiscordMessageSchema,
  DiscordReactionSchema,
  DiscordUserSchema,
} from './types'

it('DiscordGuildSchema validates correct guild', () => {
  const result = DiscordGuildSchema.safeParse({
    id: '123456789012345678',
    name: 'Test Guild',
  })
  expect(result.success).toBe(true)
})

it('DiscordGuildSchema rejects missing id', () => {
  const result = DiscordGuildSchema.safeParse({
    name: 'Test Guild',
  })
  expect(result.success).toBe(false)
})

it('DiscordGuildSchema rejects missing name', () => {
  const result = DiscordGuildSchema.safeParse({
    id: '123456789012345678',
  })
  expect(result.success).toBe(false)
})

it('DiscordChannelSchema validates correct channel', () => {
  const result = DiscordChannelSchema.safeParse({
    id: '987654321098765432',
    guild_id: '123456789012345678',
    name: 'general',
    type: 0,
  })
  expect(result.success).toBe(true)
})

it('DiscordChannelSchema validates channel with optional fields', () => {
  const result = DiscordChannelSchema.safeParse({
    id: '987654321098765432',
    guild_id: '123456789012345678',
    name: 'general',
    type: 0,
    topic: 'Channel topic',
    position: 0,
  })
  expect(result.success).toBe(true)
})

it('DiscordChannelSchema rejects missing required fields', () => {
  const result = DiscordChannelSchema.safeParse({
    id: '987654321098765432',
    name: 'general',
  })
  expect(result.success).toBe(false)
})

it('DiscordMessageSchema validates correct message', () => {
  const result = DiscordMessageSchema.safeParse({
    id: '111222333444555666',
    channel_id: '987654321098765432',
    author: {
      id: '222333444555666777',
      username: 'testuser',
    },
    content: 'Hello world',
    timestamp: '2024-01-01T00:00:00.000Z',
  })
  expect(result.success).toBe(true)
})

it('DiscordMessageSchema validates message with optional fields', () => {
  const result = DiscordMessageSchema.safeParse({
    id: '111222333444555666',
    channel_id: '987654321098765432',
    author: {
      id: '222333444555666777',
      username: 'testuser',
    },
    content: 'Hello world',
    timestamp: '2024-01-01T00:00:00.000Z',
    edited_timestamp: '2024-01-01T00:01:00.000Z',
    thread_id: '333444555666777888',
  })
  expect(result.success).toBe(true)
})

it('DiscordMessageSchema rejects missing required fields', () => {
  const result = DiscordMessageSchema.safeParse({
    id: '111222333444555666',
    channel_id: '987654321098765432',
    content: 'Hello world',
  })
  expect(result.success).toBe(false)
})

it('DiscordUserSchema validates correct user', () => {
  const result = DiscordUserSchema.safeParse({
    id: '222333444555666777',
    username: 'testuser',
  })
  expect(result.success).toBe(true)
})

it('DiscordUserSchema validates user with optional fields', () => {
  const result = DiscordUserSchema.safeParse({
    id: '222333444555666777',
    username: 'testuser',
    global_name: 'Test User',
    avatar: 'avatar_hash',
    bot: false,
  })
  expect(result.success).toBe(true)
})

it('DiscordUserSchema rejects missing required fields', () => {
  const result = DiscordUserSchema.safeParse({
    id: '222333444555666777',
  })
  expect(result.success).toBe(false)
})

it('DiscordReactionSchema validates correct reaction', () => {
  const result = DiscordReactionSchema.safeParse({
    emoji: {
      name: 'thumbsup',
    },
    count: 5,
  })
  expect(result.success).toBe(true)
})

it('DiscordReactionSchema validates reaction with custom emoji', () => {
  const result = DiscordReactionSchema.safeParse({
    emoji: {
      id: '123456789012345678',
      name: 'custom_emoji',
    },
    count: 3,
  })
  expect(result.success).toBe(true)
})

it('DiscordReactionSchema rejects missing required fields', () => {
  const result = DiscordReactionSchema.safeParse({
    emoji: {
      name: 'thumbsup',
    },
  })
  expect(result.success).toBe(false)
})

it('DiscordFileSchema validates correct file', () => {
  const result = DiscordFileSchema.safeParse({
    id: '444555666777888999',
    filename: 'document.pdf',
    size: 1024,
    url: 'https://cdn.discordapp.com/attachments/...',
  })
  expect(result.success).toBe(true)
})

it('DiscordFileSchema validates file with optional fields', () => {
  const result = DiscordFileSchema.safeParse({
    id: '444555666777888999',
    filename: 'document.pdf',
    size: 1024,
    url: 'https://cdn.discordapp.com/attachments/...',
    content_type: 'application/pdf',
    height: 100,
    width: 100,
  })
  expect(result.success).toBe(true)
})

it('DiscordFileSchema rejects missing required fields', () => {
  const result = DiscordFileSchema.safeParse({
    id: '444555666777888999',
    filename: 'document.pdf',
  })
  expect(result.success).toBe(false)
})

it('DiscordCredentialsSchema validates correct credentials', () => {
  const result = DiscordCredentialsSchema.safeParse({
    token: 'token_value',
  })
  expect(result.success).toBe(true)
})

it('DiscordCredentialsSchema rejects missing token', () => {
  const result = DiscordCredentialsSchema.safeParse({})
  expect(result.success).toBe(false)
})

it('DiscordConfigSchema validates correct config', () => {
  const result = DiscordConfigSchema.safeParse({
    current_server: null,
    token: 'token_value',
    servers: {},
  })
  expect(result.success).toBe(true)
})

it('DiscordConfigSchema validates config with servers', () => {
  const result = DiscordConfigSchema.safeParse({
    current_server: '123456789012345678',
    token: 'token_value',
    servers: {
      '123456789012345678': {
        server_id: '123456789012345678',
        server_name: 'Test Server',
      },
    },
  })
  expect(result.success).toBe(true)
})

it('DiscordConfigSchema rejects missing required fields', () => {
  const result = DiscordConfigSchema.safeParse({
    current_server: null,
    token: 'token_value',
  })
  expect(result.success).toBe(false)
})

it('DiscordError has correct name and code', () => {
  const error = new DiscordError('Test error', 'TEST_CODE')
  expect(error.name).toBe('DiscordError')
  expect(error.message).toBe('Test error')
  expect(error.code).toBe('TEST_CODE')
})

it('DiscordError is instance of Error', () => {
  const error = new DiscordError('Test error', 'TEST_CODE')
  expect(error instanceof Error).toBe(true)
})
