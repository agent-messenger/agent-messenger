import { describe, expect, it } from 'bun:test'

import {
  DiscordBotConfigSchema,
  DiscordBotCredentialsSchema,
  DiscordBotEntrySchema,
  DiscordBotError,
  DiscordChannelSchema,
  DiscordFileSchema,
  DiscordGuildSchema,
  DiscordMessageSchema,
  DiscordReactionSchema,
  DiscordUserSchema,
} from './types'

describe('DiscordBotError', () => {
  it('creates error with message and code', () => {
    const error = new DiscordBotError('Test error', 'TEST_CODE')
    expect(error.message).toBe('Test error')
    expect(error.code).toBe('TEST_CODE')
    expect(error.name).toBe('DiscordBotError')
  })
})

describe('DiscordBotEntrySchema', () => {
  it('validates correct bot entry', () => {
    const data = {
      bot_id: 'bot123',
      bot_name: 'My Bot',
      token: 'MTk4NjIyNDgzNzU5OTI1MjQ4.Clwa7A.l7rH9tWtkp1G7jlW',
    }
    const result = DiscordBotEntrySchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('rejects missing bot_id', () => {
    const data = {
      bot_name: 'My Bot',
      token: 'token123',
    }
    const result = DiscordBotEntrySchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('rejects missing token', () => {
    const data = {
      bot_id: 'bot123',
      bot_name: 'My Bot',
    }
    const result = DiscordBotEntrySchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})

describe('DiscordBotConfigSchema', () => {
  it('validates correct config with bots', () => {
    const data = {
      current: { bot_id: 'bot123' },
      bots: {
        bot123: {
          bot_id: 'bot123',
          bot_name: 'My Bot',
          token: 'token123',
        },
      },
      current_server: 'server456',
      servers: {
        server456: {
          server_id: 'server456',
          server_name: 'My Server',
        },
      },
    }
    const result = DiscordBotConfigSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('validates config with null current', () => {
    const data = {
      current: null,
      bots: {},
      current_server: null,
      servers: {},
    }
    const result = DiscordBotConfigSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('rejects invalid bot entry in bots record', () => {
    const data = {
      current: null,
      bots: {
        bot123: {
          bot_id: 'bot123',
          // missing bot_name and token
        },
      },
      current_server: null,
      servers: {},
    }
    const result = DiscordBotConfigSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})

describe('DiscordBotCredentialsSchema', () => {
  it('validates credentials with required fields', () => {
    const data = {
      token: 'token123',
      bot_id: 'bot123',
      bot_name: 'My Bot',
    }
    const result = DiscordBotCredentialsSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('validates credentials with optional server fields', () => {
    const data = {
      token: 'token123',
      bot_id: 'bot123',
      bot_name: 'My Bot',
      server_id: 'server456',
      server_name: 'My Server',
    }
    const result = DiscordBotCredentialsSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('rejects missing bot_id', () => {
    const data = {
      token: 'token123',
      bot_name: 'My Bot',
    }
    const result = DiscordBotCredentialsSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})

describe('DiscordGuildSchema', () => {
  it('validates guild with required fields', () => {
    const data = {
      id: 'guild123',
      name: 'My Guild',
    }
    const result = DiscordGuildSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('validates guild with optional fields', () => {
    const data = {
      id: 'guild123',
      name: 'My Guild',
      icon: 'icon_hash',
      owner: true,
    }
    const result = DiscordGuildSchema.safeParse(data)
    expect(result.success).toBe(true)
  })
})

describe('DiscordChannelSchema', () => {
  it('validates channel with required fields', () => {
    const data = {
      id: 'channel123',
      guild_id: 'guild123',
      name: 'general',
      type: 0,
    }
    const result = DiscordChannelSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('validates channel with optional fields', () => {
    const data = {
      id: 'channel123',
      guild_id: 'guild123',
      name: 'general',
      type: 0,
      topic: 'Channel topic',
      position: 1,
      parent_id: 'category123',
    }
    const result = DiscordChannelSchema.safeParse(data)
    expect(result.success).toBe(true)
  })
})

describe('DiscordMessageSchema', () => {
  it('validates message with required fields', () => {
    const data = {
      id: 'msg123',
      channel_id: 'channel123',
      author: {
        id: 'user123',
        username: 'testuser',
      },
      content: 'Hello world',
      timestamp: '2024-01-01T00:00:00Z',
    }
    const result = DiscordMessageSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('validates message with optional fields', () => {
    const data = {
      id: 'msg123',
      channel_id: 'channel123',
      author: {
        id: 'user123',
        username: 'testuser',
      },
      content: 'Hello world',
      timestamp: '2024-01-01T00:00:00Z',
      edited_timestamp: '2024-01-01T01:00:00Z',
      thread_id: 'thread123',
    }
    const result = DiscordMessageSchema.safeParse(data)
    expect(result.success).toBe(true)
  })
})

describe('DiscordUserSchema', () => {
  it('validates user with required fields', () => {
    const data = {
      id: 'user123',
      username: 'testuser',
    }
    const result = DiscordUserSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('validates user with optional fields', () => {
    const data = {
      id: 'user123',
      username: 'testuser',
      global_name: 'Test User',
      avatar: 'avatar_hash',
      bot: false,
    }
    const result = DiscordUserSchema.safeParse(data)
    expect(result.success).toBe(true)
  })
})

describe('DiscordReactionSchema', () => {
  it('validates reaction with required fields', () => {
    const data = {
      emoji: {
        name: '👍',
      },
      count: 5,
    }
    const result = DiscordReactionSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('validates reaction with emoji id', () => {
    const data = {
      emoji: {
        id: 'emoji123',
        name: 'custom_emoji',
      },
      count: 3,
    }
    const result = DiscordReactionSchema.safeParse(data)
    expect(result.success).toBe(true)
  })
})

describe('DiscordFileSchema', () => {
  it('validates file with required fields', () => {
    const data = {
      id: 'file123',
      filename: 'document.pdf',
      size: 1024,
      url: 'https://example.com/file.pdf',
    }
    const result = DiscordFileSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('validates file with optional fields', () => {
    const data = {
      id: 'file123',
      filename: 'image.png',
      size: 2048,
      url: 'https://example.com/image.png',
      content_type: 'image/png',
      height: 800,
      width: 600,
    }
    const result = DiscordFileSchema.safeParse(data)
    expect(result.success).toBe(true)
  })
})
