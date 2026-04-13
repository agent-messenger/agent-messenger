import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const mockGetChannel = mock(() =>
  Promise.resolve({ id: 'ch1', name: 'Test Workspace', homepageUrl: 'https://example.com' }),
)
const mockListGroups = mock(() => Promise.resolve([{ id: 'grp1', channelId: 'ch1', name: 'Team Alpha' }]))
const mockGetGroupMessages = mock(() =>
  Promise.resolve([
    { id: 'msg1', chatId: 'grp1', personType: 'manager' as const, plainText: 'Hello', createdAt: 1234567890 },
  ]),
)
const mockListUserChats = mock(() =>
  Promise.resolve([{ id: 'chat1', channelId: 'ch1', state: 'opened' as const, userId: 'user1' }]),
)
const mockGetUserChatMessages = mock(() =>
  Promise.resolve([{ id: 'msg2', chatId: 'chat1', plainText: 'Hi', createdAt: 1234567890 }]),
)
const mockListManagers = mock(() =>
  Promise.resolve([{ id: 'mgr1', channelId: 'ch1', name: 'Alice', description: 'Lead' }]),
)
const mockListBots = mock(() => Promise.resolve([{ id: 'bot1', channelId: 'ch1', name: 'Support Bot' }]))

mock.module('../client', () => ({
  ChannelBotClient: class MockChannelBotClient {
    getChannel = mockGetChannel
    listGroups = mockListGroups
    getGroupMessages = mockGetGroupMessages
    listUserChats = mockListUserChats
    getUserChatMessages = mockGetUserChatMessages
    listManagers = mockListManagers
    listBots = mockListBots
  },
}))

mock.module('./shared', () => ({
  getClient: async () => new (await import('../client')).ChannelBotClient('key', 'secret'),
  getDefaultBotName: async (opts: { bot?: string }) => opts.bot || undefined,
  getCurrentWorkspace: async () => 'ws1',
}))

import { ChannelBotCredentialManager } from '../credential-manager'
import { snapshotAction } from './snapshot'

describe('snapshot command', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = join(tmpdir(), `channelbot-snapshot-test-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })
    mockGetChannel.mockClear()
    mockListGroups.mockClear()
    mockGetGroupMessages.mockClear()
    mockListUserChats.mockClear()
    mockGetUserChatMessages.mockClear()
    mockListManagers.mockClear()
    mockListBots.mockClear()
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true })
    }
  })

  describe('snapshotAction', () => {
    test('returns workspace, groups, user_chats, managers, bots', async () => {
      const manager = new ChannelBotCredentialManager(tempDir)
      const result = await snapshotAction({ _credManager: manager })

      expect(result.error).toBeUndefined()
      expect(result.workspace).toBeDefined()
      expect(result.workspace?.id).toBe('ch1')
      expect(result.workspace?.name).toBe('Test Workspace')
      expect(result.groups).toBeDefined()
      expect(result.user_chats).toBeDefined()
      expect(result.managers).toBeDefined()
      expect(result.bots).toBeDefined()
    })

    test('groups-only flag skips user_chats, managers, bots', async () => {
      const manager = new ChannelBotCredentialManager(tempDir)
      const result = await snapshotAction({ groupsOnly: true, _credManager: manager })

      expect(result.error).toBeUndefined()
      expect(result.workspace).toBeDefined()
      expect(result.groups).toBeDefined()
      expect(result.user_chats).toBeUndefined()
      expect(result.managers).toBeUndefined()
      expect(result.bots).toBeUndefined()
    })

    test('chats-only flag skips groups, managers, bots', async () => {
      const manager = new ChannelBotCredentialManager(tempDir)
      const result = await snapshotAction({ chatsOnly: true, _credManager: manager })

      expect(result.error).toBeUndefined()
      expect(result.workspace).toBeDefined()
      expect(result.groups).toBeUndefined()
      expect(result.user_chats).toBeDefined()
      expect(result.managers).toBeUndefined()
      expect(result.bots).toBeUndefined()
    })

    test('groups include recent messages', async () => {
      const manager = new ChannelBotCredentialManager(tempDir)
      const result = await snapshotAction({ groupsOnly: true, limit: 3, _credManager: manager })

      expect(result.groups?.[0].messages).toBeDefined()
      expect(result.groups?.[0].messages?.[0].id).toBe('msg1')
    })

    test('user_chats includes counts and recent opened', async () => {
      const manager = new ChannelBotCredentialManager(tempDir)
      const result = await snapshotAction({ chatsOnly: true, _credManager: manager })

      expect(result.user_chats?.opened_count).toBe(1)
      expect(result.user_chats?.recent_opened).toHaveLength(1)
      expect(result.user_chats?.recent_opened[0].id).toBe('chat1')
    })
  })
})
