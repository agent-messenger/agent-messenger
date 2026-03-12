import { describe, expect, it } from 'bun:test'

import {
  ChannelBotBotSchema,
  ChannelBotChannelSchema,
  ChannelBotConfigSchema,
  ChannelBotCredentialsSchema,
  ChannelBotError,
  ChannelBotGroupSchema,
  ChannelBotManagerSchema,
  ChannelBotMessageSchema,
  ChannelBotUserChatSchema,
  ChannelBotUserSchema,
  ChannelBotWorkspaceEntrySchema,
  MessageBlockSchema,
} from './types'

describe('ChannelBotError', () => {
  it('creates error with message and code', () => {
    const error = new ChannelBotError('Test error', 'TEST_CODE')
    expect(error.message).toBe('Test error')
    expect(error.code).toBe('TEST_CODE')
    expect(error.name).toBe('ChannelBotError')
    expect(error instanceof Error).toBe(true)
  })
})

describe('MessageBlockSchema', () => {
  it('validates message block with type and value', () => {
    const data = {
      type: 'text',
      value: 'Hello world',
    }
    const result = MessageBlockSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('rejects missing type', () => {
    const data = {
      value: 'Hello world',
    }
    const result = MessageBlockSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('rejects missing value', () => {
    const data = {
      type: 'text',
    }
    const result = MessageBlockSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})

describe('ChannelBotWorkspaceEntrySchema', () => {
  it('validates correct workspace entry', () => {
    const data = {
      workspace_id: 'ws123',
      workspace_name: 'My Workspace',
      access_key: 'key123',
      access_secret: 'secret123',
    }
    const result = ChannelBotWorkspaceEntrySchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('rejects missing access_key', () => {
    const data = {
      workspace_id: 'ws123',
      workspace_name: 'My Workspace',
      access_secret: 'secret123',
    }
    const result = ChannelBotWorkspaceEntrySchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('rejects missing access_secret', () => {
    const data = {
      workspace_id: 'ws123',
      workspace_name: 'My Workspace',
      access_key: 'key123',
    }
    const result = ChannelBotWorkspaceEntrySchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})

describe('ChannelBotConfigSchema', () => {
  it('validates correct config with workspaces', () => {
    const data = {
      current: { workspace_id: 'ws123' },
      workspaces: {
        ws123: {
          workspace_id: 'ws123',
          workspace_name: 'My Workspace',
          access_key: 'key123',
          access_secret: 'secret123',
        },
      },
      default_bot: 'bot123',
    }
    const result = ChannelBotConfigSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('validates config with null current', () => {
    const data = {
      current: null,
      workspaces: {},
      default_bot: null,
    }
    const result = ChannelBotConfigSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('rejects invalid workspace entry in workspaces record', () => {
    const data = {
      current: null,
      workspaces: {
        ws123: {
          workspace_id: 'ws123',
          // missing workspace_name, access_key, access_secret
        },
      },
      default_bot: null,
    }
    const result = ChannelBotConfigSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})

describe('ChannelBotCredentialsSchema', () => {
  it('validates credentials with all required fields', () => {
    const data = {
      workspace_id: 'ws123',
      workspace_name: 'My Workspace',
      access_key: 'key123',
      access_secret: 'secret123',
    }
    const result = ChannelBotCredentialsSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('rejects missing workspace_id', () => {
    const data = {
      workspace_name: 'My Workspace',
      access_key: 'key123',
      access_secret: 'secret123',
    }
    const result = ChannelBotCredentialsSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})

describe('ChannelBotChannelSchema', () => {
  it('validates channel with required fields', () => {
    const data = {
      id: 'ch123',
      name: 'My Channel',
    }
    const result = ChannelBotChannelSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('validates channel with optional fields', () => {
    const data = {
      id: 'ch123',
      name: 'My Channel',
      homepageUrl: 'https://example.com',
      description: 'Channel description',
    }
    const result = ChannelBotChannelSchema.safeParse(data)
    expect(result.success).toBe(true)
  })
})

describe('ChannelBotUserChatSchema', () => {
  it('validates user chat with opened state', () => {
    const data = {
      id: 'chat123',
      channelId: 'ch123',
      state: 'opened',
    }
    const result = ChannelBotUserChatSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('validates user chat with snoozed state', () => {
    const data = {
      id: 'chat123',
      channelId: 'ch123',
      state: 'snoozed',
    }
    const result = ChannelBotUserChatSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('validates user chat with closed state', () => {
    const data = {
      id: 'chat123',
      channelId: 'ch123',
      state: 'closed',
    }
    const result = ChannelBotUserChatSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('validates user chat with optional fields', () => {
    const data = {
      id: 'chat123',
      channelId: 'ch123',
      name: 'Customer Chat',
      state: 'opened',
      managerId: 'mgr123',
      userId: 'user123',
      createdAt: 1234567890,
      updatedAt: 1234567900,
    }
    const result = ChannelBotUserChatSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('rejects invalid state', () => {
    const data = {
      id: 'chat123',
      channelId: 'ch123',
      state: 'invalid_state',
    }
    const result = ChannelBotUserChatSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})

describe('ChannelBotGroupSchema', () => {
  it('validates group with required fields', () => {
    const data = {
      id: 'grp123',
      channelId: 'ch123',
      name: 'Team Group',
    }
    const result = ChannelBotGroupSchema.safeParse(data)
    expect(result.success).toBe(true)
  })
})

describe('ChannelBotMessageSchema', () => {
  it('validates message with minimal fields', () => {
    const data = {
      id: 'msg123',
    }
    const result = ChannelBotMessageSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('validates message with blocks', () => {
    const data = {
      id: 'msg123',
      chatId: 'chat123',
      personType: 'manager',
      personId: 'mgr123',
      createdAt: 1234567890,
      blocks: [
        {
          type: 'text',
          value: 'Hello world',
        },
      ],
    }
    const result = ChannelBotMessageSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('validates message with plainText', () => {
    const data = {
      id: 'msg123',
      plainText: 'Hello world',
    }
    const result = ChannelBotMessageSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('validates message with all optional personType values', () => {
    const types = ['manager', 'bot', 'user']
    for (const personType of types) {
      const data = {
        id: 'msg123',
        personType,
      }
      const result = ChannelBotMessageSchema.safeParse(data)
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid personType', () => {
    const data = {
      id: 'msg123',
      personType: 'invalid_type',
    }
    const result = ChannelBotMessageSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})

describe('ChannelBotManagerSchema', () => {
  it('validates manager with required fields', () => {
    const data = {
      id: 'mgr123',
      channelId: 'ch123',
      name: 'John Doe',
    }
    const result = ChannelBotManagerSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('validates manager with optional fields', () => {
    const data = {
      id: 'mgr123',
      channelId: 'ch123',
      accountId: 'acc123',
      name: 'John Doe',
      description: 'Support Manager',
    }
    const result = ChannelBotManagerSchema.safeParse(data)
    expect(result.success).toBe(true)
  })
})

describe('ChannelBotBotSchema', () => {
  it('validates bot with required fields', () => {
    const data = {
      id: 'bot123',
      channelId: 'ch123',
      name: 'Support Bot',
    }
    const result = ChannelBotBotSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('validates bot with optional fields', () => {
    const data = {
      id: 'bot123',
      channelId: 'ch123',
      name: 'Support Bot',
      avatarUrl: 'https://example.com/avatar.png',
      color: '#FF0000',
    }
    const result = ChannelBotBotSchema.safeParse(data)
    expect(result.success).toBe(true)
  })
})

describe('ChannelBotUserSchema', () => {
  it('validates user with required fields', () => {
    const data = {
      id: 'user123',
      channelId: 'ch123',
    }
    const result = ChannelBotUserSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('validates user with optional fields', () => {
    const data = {
      id: 'user123',
      channelId: 'ch123',
      memberId: 'mem123',
      name: 'Jane Doe',
    }
    const result = ChannelBotUserSchema.safeParse(data)
    expect(result.success).toBe(true)
  })
})
