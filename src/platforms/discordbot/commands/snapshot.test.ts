import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const mockListChannels = mock((guildId: string) =>
  Promise.resolve([
    { id: 'ch1', guild_id: guildId, name: 'general', type: 0 },
    { id: 'ch2', guild_id: guildId, name: 'random', type: 0 },
    { id: 'ch3', guild_id: guildId, name: 'voice', type: 2 },
  ]),
)

const mockGetMessages = mock((channelId: string, _limit: number) =>
  Promise.resolve([
    {
      id: `msg1-${channelId}`,
      channel_id: channelId,
      author: { id: 'u1', username: 'alice' },
      content: `Hello from ${channelId}`,
      timestamp: '2025-01-01T00:00:00Z',
    },
    {
      id: `msg2-${channelId}`,
      channel_id: channelId,
      author: { id: 'u2', username: 'bob' },
      content: `Hi from ${channelId}`,
      timestamp: '2025-01-01T00:01:00Z',
    },
  ]),
)

const mockListUsers = mock((_guildId: string) =>
  Promise.resolve([
    { id: 'u1', username: 'alice', global_name: 'Alice' },
    { id: 'u2', username: 'bob', global_name: null },
    { id: 'u3', username: 'charlie' },
  ]),
)

mock.module('../client', () => ({
  DiscordBotClient: class MockDiscordBotClient {
    constructor(token: string) {
      if (!token) throw new Error('Token is required')
    }
    listChannels = mockListChannels
    getMessages = mockGetMessages
    listUsers = mockListUsers
  },
}))

import { DiscordBotCredentialManager } from '../credential-manager'
import { snapshotAction } from './snapshot'

async function setupManager(tempDir: string) {
  const manager = new DiscordBotCredentialManager(tempDir)
  await manager.setCredentials({
    token: 'token123',
    bot_id: 'bot1',
    bot_name: 'Bot 1',
  })
  await manager.setCurrentServer('guild1', 'Test Guild')
  return manager
}

describe('snapshot command', () => {
  let tempDir: string
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(async () => {
    tempDir = join(tmpdir(), `discordbot-snapshot-test-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })
    originalEnv = { ...process.env }
    delete process.env.E2E_DISCORDBOT_TOKEN
    delete process.env.E2E_DISCORDBOT_SERVER_ID
    mockListChannels.mockClear()
    mockGetMessages.mockClear()
    mockListUsers.mockClear()
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true })
    }
    process.env = originalEnv
  })

  describe('default (channels + messages)', () => {
    test('returns channels with recent messages', async () => {
      const manager = await setupManager(tempDir)

      const result = await snapshotAction({ _credManager: manager })

      expect(result.server_id).toBe('guild1')
      expect(result.channels).toHaveLength(2)
      expect(result.channels?.[0].id).toBe('ch1')
      expect(result.channels?.[0].name).toBe('general')
      expect(result.channels?.[0].messages).toHaveLength(2)
      expect(result.channels?.[0].messages?.[0]).toEqual({
        id: 'msg1-ch1',
        author: 'alice',
        content: 'Hello from ch1',
        timestamp: '2025-01-01T00:00:00Z',
      })
    })

    test('filters out non-text channels', async () => {
      const manager = await setupManager(tempDir)

      const result = await snapshotAction({ _credManager: manager })

      const channelNames = result.channels?.map((ch) => ch.name)
      expect(channelNames).not.toContain('voice')
    })

    test('fetches messages in parallel for all text channels', async () => {
      const manager = await setupManager(tempDir)

      await snapshotAction({ _credManager: manager })

      expect(mockGetMessages).toHaveBeenCalledTimes(2)
      expect(mockGetMessages).toHaveBeenCalledWith('ch1', 5)
      expect(mockGetMessages).toHaveBeenCalledWith('ch2', 5)
    })

    test('respects --limit option', async () => {
      const manager = await setupManager(tempDir)

      await snapshotAction({ _credManager: manager, limit: 10 })

      expect(mockGetMessages).toHaveBeenCalledWith('ch1', 10)
      expect(mockGetMessages).toHaveBeenCalledWith('ch2', 10)
    })

    test('defaults limit to 5', async () => {
      const manager = await setupManager(tempDir)

      await snapshotAction({ _credManager: manager })

      expect(mockGetMessages).toHaveBeenCalledWith('ch1', 5)
    })
  })

  describe('--channels-only', () => {
    test('returns only channel list without messages', async () => {
      const manager = await setupManager(tempDir)

      const result = await snapshotAction({ _credManager: manager, channelsOnly: true })

      expect(result.server_id).toBe('guild1')
      expect(result.channels).toHaveLength(2)
      expect(result.channels?.[0]).toEqual({ id: 'ch1', name: 'general', type: 0 })
      expect(result.channels?.[1]).toEqual({ id: 'ch2', name: 'random', type: 0 })
      expect(mockGetMessages).not.toHaveBeenCalled()
    })
  })

  describe('--users-only', () => {
    test('returns only user list', async () => {
      const manager = await setupManager(tempDir)

      const result = await snapshotAction({ _credManager: manager, usersOnly: true })

      expect(result.server_id).toBe('guild1')
      expect(result.users).toHaveLength(3)
      expect(result.users?.[0]).toEqual({ id: 'u1', username: 'alice', global_name: 'Alice' })
      expect(result.users?.[1]).toEqual({ id: 'u2', username: 'bob', global_name: null })
      expect(result.users?.[2]).toEqual({ id: 'u3', username: 'charlie', global_name: null })
      expect(mockListChannels).not.toHaveBeenCalled()
      expect(mockGetMessages).not.toHaveBeenCalled()
    })
  })

  describe('--server option', () => {
    test('uses explicit server ID', async () => {
      const manager = await setupManager(tempDir)

      const result = await snapshotAction({ _credManager: manager, server: 'other-guild' })

      expect(result.server_id).toBe('other-guild')
      expect(mockListChannels).toHaveBeenCalledWith('other-guild')
    })
  })

  describe('error handling', () => {
    test('returns error when no server set', async () => {
      const manager = new DiscordBotCredentialManager(tempDir)
      await manager.setCredentials({
        token: 'token123',
        bot_id: 'bot1',
        bot_name: 'Bot 1',
      })

      const result = await snapshotAction({ _credManager: manager })

      expect(result.error).toBeDefined()
    })

    test('returns error on API failure', async () => {
      mockListChannels.mockImplementationOnce(() => Promise.reject(new Error('API Error')))
      const manager = await setupManager(tempDir)

      const result = await snapshotAction({ _credManager: manager })

      expect(result.error).toBe('API Error')
    })
  })
})
