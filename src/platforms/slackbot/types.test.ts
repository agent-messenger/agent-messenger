import { describe, expect, test } from 'bun:test'

import {
  type SlackBotConfig,
  SlackBotConfigSchema,
  type SlackBotCredentials,
  SlackBotCredentialsSchema,
  SlackBotError,
} from './types'

describe('SlackBotError', () => {
  test('creates error with message and code', () => {
    const error = new SlackBotError('Token is invalid', 'invalid_auth')

    expect(error.message).toBe('Token is invalid')
    expect(error.code).toBe('invalid_auth')
    expect(error.name).toBe('SlackBotError')
    expect(error instanceof Error).toBe(true)
  })
})

describe('SlackBotCredentialsSchema', () => {
  test('validates correct bot token credentials', () => {
    const creds: SlackBotCredentials = {
      token: 'xoxb-123456789-abcdef',
      workspace_id: 'T12345678',
      workspace_name: 'test-workspace',
      bot_id: 'deploy',
      bot_name: 'Deploy Bot',
    }

    const result = SlackBotCredentialsSchema.safeParse(creds)
    expect(result.success).toBe(true)
  })

  test('rejects user tokens (xoxp-)', () => {
    const creds = {
      token: 'xoxp-123456789-abcdef',
      workspace_id: 'T12345678',
      workspace_name: 'test-workspace',
      bot_id: 'deploy',
      bot_name: 'Deploy Bot',
    }

    const result = SlackBotCredentialsSchema.safeParse(creds)
    expect(result.success).toBe(false)
  })

  test('rejects missing fields', () => {
    const creds = {
      token: 'xoxb-123456789-abcdef',
    }

    const result = SlackBotCredentialsSchema.safeParse(creds)
    expect(result.success).toBe(false)
  })
})

describe('SlackBotConfigSchema', () => {
  test('validates correct config', () => {
    const config: SlackBotConfig = {
      current: { workspace_id: 'T12345678', bot_id: 'deploy' },
      workspaces: {
        T12345678: {
          workspace_id: 'T12345678',
          workspace_name: 'test-workspace',
          bots: {
            deploy: {
              bot_id: 'deploy',
              bot_name: 'Deploy Bot',
              token: 'xoxb-123456789-abcdef',
            },
          },
        },
      },
    }

    const result = SlackBotConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
  })

  test('validates config with null current', () => {
    const config: SlackBotConfig = {
      current: null,
      workspaces: {},
    }

    const result = SlackBotConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
  })
})
