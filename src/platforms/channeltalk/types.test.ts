import { describe, expect, test } from 'bun:test'

import {
  ChannelAccountSchema,
  ChannelConfigSchema,
  ChannelError,
  ChannelGroupSchema,
  ChannelMessageSchema,
  ChannelWorkspaceEntrySchema,
} from './types'

describe('channel types', () => {
  test('accepts a valid workspace entry', () => {
    const result = ChannelWorkspaceEntrySchema.safeParse({
      workspace_id: '232986',
      workspace_name: 'Support',
      account_id: '493041',
      account_name: 'Devxoul',
      account_cookie: 'account-jwt',
      session_cookie: 'session-jwt',
    })

    expect(result.success).toBe(true)
  })

  test('accepts a workspace entry without session_cookie', () => {
    const result = ChannelWorkspaceEntrySchema.safeParse({
      workspace_id: '232986',
      workspace_name: 'Support',
      account_cookie: 'account-jwt',
    })

    expect(result.success).toBe(true)
  })

  test('rejects a workspace entry missing account_cookie', () => {
    const result = ChannelWorkspaceEntrySchema.safeParse({
      workspace_id: '232986',
      workspace_name: 'Support',
    })

    expect(result.success).toBe(false)
  })

  test('accepts a valid config', () => {
    const result = ChannelConfigSchema.safeParse({
      current: { workspace_id: '232986' },
      workspaces: {
        '232986': {
          workspace_id: '232986',
          workspace_name: 'Support',
          account_cookie: 'account-jwt',
          session_cookie: 'session-jwt',
        },
      },
    })

    expect(result.success).toBe(true)
  })

  test('accepts a valid account', () => {
    const result = ChannelAccountSchema.safeParse({
      id: '493041',
      name: 'Devxoul',
      email: 'devxoul@example.com',
      emailVerified: true,
      language: 'en',
      country: 'KR',
      createdAt: 1710000000000,
    })

    expect(result.success).toBe(true)
  })

  test('rejects an invalid account', () => {
    const result = ChannelAccountSchema.safeParse({
      id: '493041',
      name: 'Devxoul',
      email: 'devxoul@example.com',
      emailVerified: 'true',
      language: 'en',
      country: 'KR',
      createdAt: 1710000000000,
    })

    expect(result.success).toBe(false)
  })

  test('accepts a valid message with blocks', () => {
    const result = ChannelMessageSchema.safeParse({
      id: 'msg_1',
      channelId: '232986',
      chatType: 'userChat',
      blocks: [{ type: 'text', value: 'hello' }],
      plainText: 'hello',
      version: 1,
    })

    expect(result.success).toBe(true)
  })

  test('rejects an invalid message block payload', () => {
    const result = ChannelMessageSchema.safeParse({
      id: 'msg_1',
      blocks: [{ type: 'text', value: 123 }],
    })

    expect(result.success).toBe(false)
  })

  test('accepts a valid group', () => {
    const result = ChannelGroupSchema.safeParse({
      id: 'group_1',
      channelId: '232986',
      name: 'Support team',
      managerIds: ['1', '2'],
      active: true,
    })

    expect(result.success).toBe(true)
  })

  test('rejects an invalid group', () => {
    const result = ChannelGroupSchema.safeParse({
      id: 'group_1',
      channelId: '232986',
      name: 'Support team',
      managerIds: [1, 2],
    })

    expect(result.success).toBe(false)
  })

  test('stores the code on ChannelError', () => {
    const error = new ChannelError('boom', 'CHANNEL_FAILED')

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('ChannelError')
    expect(error.code).toBe('CHANNEL_FAILED')
    expect(error.message).toBe('boom')
  })
})
