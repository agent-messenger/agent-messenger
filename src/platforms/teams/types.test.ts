import { expect, it } from 'bun:test'

import {
  TeamsChannelSchema,
  TeamsConfigSchema,
  TeamsCredentialsSchema,
  TeamsError,
  TeamsFileSchema,
  TeamsMessageSchema,
  TeamsReactionSchema,
  TeamsTeamSchema,
  TeamsUserSchema,
} from './types'

// TeamsTeamSchema tests
it('TeamsTeamSchema validates correct team', () => {
  const result = TeamsTeamSchema.safeParse({
    id: '19:abc123@thread.tacv2',
    name: 'Test Team',
  })
  expect(result.success).toBe(true)
})

it('TeamsTeamSchema validates team with optional description', () => {
  const result = TeamsTeamSchema.safeParse({
    id: '19:abc123@thread.tacv2',
    name: 'Test Team',
    description: 'A test team',
  })
  expect(result.success).toBe(true)
})

it('TeamsTeamSchema rejects missing id', () => {
  const result = TeamsTeamSchema.safeParse({
    name: 'Test Team',
  })
  expect(result.success).toBe(false)
})

it('TeamsTeamSchema rejects missing name', () => {
  const result = TeamsTeamSchema.safeParse({
    id: '19:abc123@thread.tacv2',
  })
  expect(result.success).toBe(false)
})

// TeamsChannelSchema tests
it('TeamsChannelSchema validates correct channel', () => {
  const result = TeamsChannelSchema.safeParse({
    id: '19:channel123@thread.tacv2',
    team_id: '19:abc123@thread.tacv2',
    name: 'General',
    type: 'standard',
  })
  expect(result.success).toBe(true)
})

it('TeamsChannelSchema rejects missing required fields', () => {
  const result = TeamsChannelSchema.safeParse({
    id: '19:channel123@thread.tacv2',
    name: 'General',
  })
  expect(result.success).toBe(false)
})

// TeamsMessageSchema tests
it('TeamsMessageSchema validates correct message', () => {
  const result = TeamsMessageSchema.safeParse({
    id: '1234567890123',
    channel_id: '19:channel123@thread.tacv2',
    author: {
      id: 'user123',
      displayName: 'Test User',
    },
    content: 'Hello world',
    timestamp: '2024-01-01T00:00:00.000Z',
  })
  expect(result.success).toBe(true)
})

it('TeamsMessageSchema rejects missing required fields', () => {
  const result = TeamsMessageSchema.safeParse({
    id: '1234567890123',
    channel_id: '19:channel123@thread.tacv2',
    content: 'Hello world',
  })
  expect(result.success).toBe(false)
})

// TeamsUserSchema tests
it('TeamsUserSchema validates correct user', () => {
  const result = TeamsUserSchema.safeParse({
    id: 'user123',
    displayName: 'Test User',
  })
  expect(result.success).toBe(true)
})

it('TeamsUserSchema validates user with optional fields', () => {
  const result = TeamsUserSchema.safeParse({
    id: 'user123',
    displayName: 'Test User',
    email: 'test@example.com',
    userPrincipalName: 'test@example.onmicrosoft.com',
  })
  expect(result.success).toBe(true)
})

it('TeamsUserSchema rejects missing required fields', () => {
  const result = TeamsUserSchema.safeParse({
    id: 'user123',
  })
  expect(result.success).toBe(false)
})

// TeamsReactionSchema tests
it('TeamsReactionSchema validates correct reaction', () => {
  const result = TeamsReactionSchema.safeParse({
    emoji: 'like',
    count: 5,
  })
  expect(result.success).toBe(true)
})

it('TeamsReactionSchema rejects missing required fields', () => {
  const result = TeamsReactionSchema.safeParse({
    emoji: 'like',
  })
  expect(result.success).toBe(false)
})

// TeamsFileSchema tests
it('TeamsFileSchema validates correct file', () => {
  const result = TeamsFileSchema.safeParse({
    id: 'file123',
    name: 'document.pdf',
    size: 1024,
    url: 'https://teams.microsoft.com/files/...',
  })
  expect(result.success).toBe(true)
})

it('TeamsFileSchema validates file with optional contentType', () => {
  const result = TeamsFileSchema.safeParse({
    id: 'file123',
    name: 'document.pdf',
    size: 1024,
    url: 'https://teams.microsoft.com/files/...',
    contentType: 'application/pdf',
  })
  expect(result.success).toBe(true)
})

it('TeamsFileSchema rejects missing required fields', () => {
  const result = TeamsFileSchema.safeParse({
    id: 'file123',
    name: 'document.pdf',
  })
  expect(result.success).toBe(false)
})

// TeamsCredentialsSchema tests
it('TeamsCredentialsSchema validates correct credentials', () => {
  const result = TeamsCredentialsSchema.safeParse({
    token: 'skypetoken_value',
  })
  expect(result.success).toBe(true)
})

it('TeamsCredentialsSchema validates credentials with cookie', () => {
  const result = TeamsCredentialsSchema.safeParse({
    token: 'skypetoken_value',
    cookie: 'skypetoken_asm_value',
  })
  expect(result.success).toBe(true)
})

it('TeamsCredentialsSchema rejects missing token', () => {
  const result = TeamsCredentialsSchema.safeParse({})
  expect(result.success).toBe(false)
})

// TeamsConfigSchema tests
it('TeamsConfigSchema validates correct config', () => {
  const result = TeamsConfigSchema.safeParse({
    current_account: 'work',
    accounts: {
      work: {
        token: 'token_value',
        account_type: 'work',
        current_team: null,
        teams: {},
      },
    },
  })
  expect(result.success).toBe(true)
})

it('TeamsConfigSchema validates config with multiple accounts', () => {
  const result = TeamsConfigSchema.safeParse({
    current_account: 'work',
    accounts: {
      work: {
        token: 'work_token',
        token_expires_at: '2024-01-01T00:00:00.000Z',
        region: 'emea',
        account_type: 'work',
        user_name: 'Work User',
        current_team: '19:abc123@thread.tacv2',
        teams: {
          '19:abc123@thread.tacv2': {
            team_id: '19:abc123@thread.tacv2',
            team_name: 'Test Team',
          },
        },
      },
      personal: {
        token: 'personal_token',
        account_type: 'personal',
        current_team: null,
        teams: {},
      },
    },
  })
  expect(result.success).toBe(true)
})

it('TeamsConfigSchema rejects invalid region', () => {
  const result = TeamsConfigSchema.safeParse({
    current_account: 'work',
    accounts: {
      work: {
        token: 'token_value',
        region: 'invalid',
        account_type: 'work',
        current_team: null,
        teams: {},
      },
    },
  })
  expect(result.success).toBe(false)
})

it('TeamsConfigSchema rejects missing required fields', () => {
  const result = TeamsConfigSchema.safeParse({
    current_account: null,
  })
  expect(result.success).toBe(false)
})

// TeamsError tests
it('TeamsError has correct name and code', () => {
  const error = new TeamsError('Test error', 'TEST_CODE')
  expect(error.name).toBe('TeamsError')
  expect(error.message).toBe('Test error')
  expect(error.code).toBe('TEST_CODE')
})

it('TeamsError is instance of Error', () => {
  const error = new TeamsError('Test error', 'TEST_CODE')
  expect(error instanceof Error).toBe(true)
})
