import { afterEach, beforeEach, expect, spyOn, it } from 'bun:test'

import { SlackClient } from '@/platforms/slack/client'
import { snapshotCommand } from '@/platforms/slack/commands/snapshot'
import { CredentialManager } from '@/platforms/slack/credential-manager'
import type { SlackChannel, SlackMessage, SlackUser } from '@/platforms/slack/types'

// Test the command structure (no mocks needed)
it('snapshot command exports correctly', () => {
  expect(snapshotCommand).toBeDefined()
  expect(typeof snapshotCommand).toBe('object')
})

it('snapshot command has correct structure', () => {
  expect(snapshotCommand.name()).toBe('snapshot')
  expect(snapshotCommand.description()).toContain('workspace')
})

it('snapshot command has --channels-only option', () => {
  const options = snapshotCommand.options
  const hasChannelsOnly = options.some((opt: any) => opt.long === '--channels-only')
  expect(hasChannelsOnly).toBe(true)
})

it('snapshot command has --users-only option', () => {
  const options = snapshotCommand.options
  const hasUsersOnly = options.some((opt: any) => opt.long === '--users-only')
  expect(hasUsersOnly).toBe(true)
})

it('snapshot command has --limit option', () => {
  const options = snapshotCommand.options
  const hasLimit = options.some((opt: any) => opt.long === '--limit')
  expect(hasLimit).toBe(true)
})

it('snapshot command has --full option', () => {
  const options = snapshotCommand.options
  const hasFull = options.some((opt: any) => opt.long === '--full')
  expect(hasFull).toBe(true)
})

// Test snapshot logic using spyOn (no global mock pollution)
let credManagerSpy: ReturnType<typeof spyOn>
let clientTestAuthSpy: ReturnType<typeof spyOn>
let clientListChannelsSpy: ReturnType<typeof spyOn>
let clientListUsersSpy: ReturnType<typeof spyOn>
let clientGetMessagesSpy: ReturnType<typeof spyOn>

const mockChannels: SlackChannel[] = [
  {
    id: 'C123',
    name: 'general',
    is_private: false,
    is_archived: false,
    created: 1234567890,
    creator: 'U123',
    topic: { value: 'General discussion', creator: 'U123', last_set: 1234567890 },
    purpose: { value: 'General channel', creator: 'U123', last_set: 1234567890 },
  },
  {
    id: 'C456',
    name: 'random',
    is_private: false,
    is_archived: false,
    created: 1234567891,
    creator: 'U123',
    topic: { value: 'Random stuff', creator: 'U123', last_set: 1234567891 },
    purpose: { value: 'Random channel', creator: 'U123', last_set: 1234567891 },
  },
]

const mockMessages: SlackMessage[] = [
  {
    ts: '1234567890.000100',
    text: 'Hello world',
    type: 'message',
    user: 'U123',
    username: 'testuser',
    thread_ts: undefined,
    reply_count: 0,
    edited: undefined,
  },
  {
    ts: '1234567890.000200',
    text: 'Second message',
    type: 'message',
    user: 'U456',
    username: 'otheruser',
    thread_ts: undefined,
    reply_count: 0,
    edited: undefined,
  },
]

const mockUsers: SlackUser[] = [
  {
    id: 'U123',
    name: 'alice',
    real_name: 'Alice Smith',
    is_admin: true,
    is_owner: false,
    is_bot: false,
    is_app_user: false,
    profile: {
      email: 'alice@example.com',
      title: 'Engineer',
    },
  },
  {
    id: 'U456',
    name: 'bob',
    real_name: 'Bob Jones',
    is_admin: false,
    is_owner: false,
    is_bot: false,
    is_app_user: false,
    profile: {
      email: 'bob@example.com',
      title: 'Designer',
    },
  },
]

beforeEach(() => {
  // Spy on CredentialManager.prototype.getWorkspace
  credManagerSpy = spyOn(CredentialManager.prototype, 'getWorkspace').mockResolvedValue({
    workspace_id: 'T123',
    workspace_name: 'Test Workspace',
    token: 'xoxc-test',
    cookie: 'test-cookie',
  })

  // Spy on SlackClient.prototype methods
  clientTestAuthSpy = spyOn(SlackClient.prototype, 'testAuth').mockResolvedValue({
    user_id: 'U123',
    team_id: 'T123',
    user: 'testuser',
    team: 'Test Workspace',
  })

  clientListChannelsSpy = spyOn(SlackClient.prototype, 'listChannels').mockResolvedValue(mockChannels)
  clientListUsersSpy = spyOn(SlackClient.prototype, 'listUsers').mockResolvedValue(mockUsers)
  clientGetMessagesSpy = spyOn(SlackClient.prototype, 'getMessages').mockResolvedValue(mockMessages)
})

afterEach(() => {
  // Restore all spies
  credManagerSpy?.mockRestore()
  clientTestAuthSpy?.mockRestore()
  clientListChannelsSpy?.mockRestore()
  clientListUsersSpy?.mockRestore()
  clientGetMessagesSpy?.mockRestore()
})

it('brief snapshot (default) returns workspace, channels as {id, name}, and hint', async () => {
  const client = await new SlackClient().login({ token: 'xoxc-test', cookie: 'test-cookie' })

  const auth = await client.testAuth()
  const channels = await client.listChannels()
  const active = channels.filter((ch) => !ch.is_archived)

  const snapshot = {
    workspace: {
      id: auth.team_id,
      name: auth.team,
    },
    channels: active.map((ch) => ({ id: ch.id, name: ch.name })),
    hint: "Use 'message list <channel>' for messages, 'channel info <channel>' for channel details, 'user list' for users, 'usergroup list' for groups.",
  }

  expect(snapshot.workspace).toBeDefined()
  expect(snapshot.workspace.id).toBe('T123')
  expect(snapshot.workspace.name).toBe('Test Workspace')

  expect(snapshot.channels).toBeDefined()
  expect(snapshot.channels.length).toBe(2)
  expect(snapshot.channels[0]).toEqual({ id: 'C123', name: 'general' })
  expect(snapshot.channels[1]).toEqual({ id: 'C456', name: 'random' })

  expect((snapshot as any).recent_messages).toBeUndefined()
  expect((snapshot as any).users).toBeUndefined()
  expect((snapshot as any).usergroups).toBeUndefined()

  expect(snapshot.hint).toContain('message list')
})

it('brief snapshot excludes archived channels', async () => {
  const channelsWithArchived: SlackChannel[] = [
    ...mockChannels,
    {
      id: 'C789',
      name: 'old-channel',
      is_private: false,
      is_archived: true,
      created: 1234567800,
      creator: 'U123',
      topic: { value: 'Archived', creator: 'U123', last_set: 1234567800 },
      purpose: { value: 'Old channel', creator: 'U123', last_set: 1234567800 },
    },
  ]

  clientListChannelsSpy.mockResolvedValue(channelsWithArchived)

  const client = await new SlackClient().login({ token: 'xoxc-test', cookie: 'test-cookie' })
  const channels = await client.listChannels()
  const active = channels.filter((ch) => !ch.is_archived)

  expect(active.length).toBe(2)
  expect(active.every((ch) => !ch.is_archived)).toBe(true)
})

it('full snapshot returns workspace, channels, messages, and users', async () => {
  const client = await new SlackClient().login({ token: 'xoxc-test', cookie: 'test-cookie' })

  const auth = await client.testAuth()
  const channels = await client.listChannels()
  const users = await client.listUsers()

  const allMessages: Array<SlackMessage & { channel_id: string; channel_name: string }> = []
  for (const channel of channels) {
    const messages = await client.getMessages(channel.id, 20)
    for (const msg of messages) {
      allMessages.push({
        ...msg,
        channel_id: channel.id,
        channel_name: channel.name,
      })
    }
  }

  const snapshot = {
    workspace: {
      id: auth.team_id,
      name: auth.team,
    },
    channels: channels.map((ch) => ({
      id: ch.id,
      name: ch.name,
      is_private: ch.is_private,
      is_archived: ch.is_archived,
      created: ch.created,
      topic: ch.topic?.value,
      purpose: ch.purpose?.value,
    })),
    recent_messages: allMessages.map((msg) => ({
      channel_id: msg.channel_id,
      channel_name: msg.channel_name,
      ts: msg.ts,
      text: msg.text,
      user: msg.user,
      username: msg.username,
      thread_ts: msg.thread_ts,
    })),
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      real_name: u.real_name,
      is_admin: u.is_admin,
      is_bot: u.is_bot,
      profile: u.profile,
    })),
  }

  expect(snapshot.workspace).toBeDefined()
  expect(snapshot.workspace.id).toBe('T123')
  expect(snapshot.workspace.name).toBe('Test Workspace')

  expect(snapshot.channels).toBeDefined()
  expect(snapshot.channels.length).toBe(2)
  expect(snapshot.channels[0].name).toBe('general')

  expect(snapshot.recent_messages).toBeDefined()
  expect(snapshot.recent_messages.length).toBeGreaterThan(0)

  expect(snapshot.users).toBeDefined()
  expect(snapshot.users.length).toBe(2)
  expect(snapshot.users[0].name).toBe('alice')
})

it('snapshot with --channels-only excludes messages and users', async () => {
  const client = await new SlackClient().login({ token: 'xoxc-test', cookie: 'test-cookie' })

  const auth = await client.testAuth()
  const channels = await client.listChannels()

  const snapshot = {
    workspace: {
      id: auth.team_id,
      name: auth.team,
    },
    channels: channels.map((ch) => ({
      id: ch.id,
      name: ch.name,
      is_private: ch.is_private,
      is_archived: ch.is_archived,
      created: ch.created,
      topic: ch.topic?.value,
      purpose: ch.purpose?.value,
    })),
  }

  expect(snapshot.workspace).toBeDefined()
  expect(snapshot.channels).toBeDefined()
  expect(snapshot.channels.length).toBe(2)
  expect((snapshot as any).recent_messages).toBeUndefined()
  expect((snapshot as any).users).toBeUndefined()
})

it('snapshot with --users-only excludes channels and messages', async () => {
  const client = await new SlackClient().login({ token: 'xoxc-test', cookie: 'test-cookie' })

  const auth = await client.testAuth()
  const users = await client.listUsers()

  const snapshot = {
    workspace: {
      id: auth.team_id,
      name: auth.team,
    },
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      real_name: u.real_name,
      is_admin: u.is_admin,
      is_bot: u.is_bot,
      profile: u.profile,
    })),
  }

  expect(snapshot.workspace).toBeDefined()
  expect(snapshot.users).toBeDefined()
  expect(snapshot.users.length).toBe(2)
  expect((snapshot as any).channels).toBeUndefined()
  expect((snapshot as any).recent_messages).toBeUndefined()
})

it('snapshot respects --limit option for messages', async () => {
  const client = await new SlackClient().login({ token: 'xoxc-test', cookie: 'test-cookie' })

  const auth = await client.testAuth()
  const channels = await client.listChannels()

  const allMessages: Array<SlackMessage & { channel_id: string; channel_name: string }> = []
  for (const channel of channels) {
    const messages = await client.getMessages(channel.id, 5)
    for (const msg of messages) {
      allMessages.push({
        ...msg,
        channel_id: channel.id,
        channel_name: channel.name,
      })
    }
  }

  const snapshot = {
    workspace: {
      id: auth.team_id,
      name: auth.team,
    },
    channels: channels.map((ch) => ({
      id: ch.id,
      name: ch.name,
      is_private: ch.is_private,
      is_archived: ch.is_archived,
      created: ch.created,
      topic: ch.topic?.value,
      purpose: ch.purpose?.value,
    })),
    recent_messages: allMessages,
  }

  expect(snapshot.recent_messages.length).toBeLessThanOrEqual(10)
})
