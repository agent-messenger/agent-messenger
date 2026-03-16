import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const mockListUsers = mock((_guildId: string) =>
  Promise.resolve([
    { id: 'user1', username: 'alice', global_name: 'Alice', avatar: 'avatar1.png', bot: false },
    { id: 'user2', username: 'bob', global_name: 'Bob', avatar: 'avatar2.png', bot: false },
    { id: 'bot1', username: 'mybot', global_name: 'My Bot', avatar: 'botavatar.png', bot: true },
  ]),
)

const mockGetUser = mock((userId: string) => {
  const users: Record<string, { id: string; username: string; global_name?: string; avatar?: string; bot?: boolean }> =
    {
      user1: { id: 'user1', username: 'alice', global_name: 'Alice', avatar: 'avatar1.png', bot: false },
      user2: { id: 'user2', username: 'bob', global_name: 'Bob', avatar: 'avatar2.png', bot: false },
      bot1: { id: 'bot1', username: 'mybot', global_name: 'My Bot', avatar: 'botavatar.png', bot: true },
    }
  const user = users[userId]
  if (!user) {
    return Promise.reject(new Error(`User not found: "${userId}"`))
  }
  return Promise.resolve(user)
})

mock.module('../client', () => ({
  DiscordBotClient: class MockDiscordBotClient {
    constructor(token: string) {
      if (!token) {
        throw new Error('Token is required')
      }
    }
    listUsers = mockListUsers
    getUser = mockGetUser
  },
}))

import { DiscordBotCredentialManager } from '../credential-manager'
import { infoAction, listAction } from './user'

describe('user commands', () => {
  let tempDir: string
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(async () => {
    tempDir = join(tmpdir(), `discordbot-user-test-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })
    originalEnv = { ...process.env }
    delete process.env.E2E_DISCORDBOT_TOKEN
    delete process.env.E2E_DISCORDBOT_SERVER_ID
    mockListUsers.mockClear()
    mockGetUser.mockClear()
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true })
    }
    process.env = originalEnv
  })

  describe('listAction', () => {
    test('lists users from current server', async () => {
      const manager = new DiscordBotCredentialManager(tempDir)
      await manager.setCredentials({
        token: 'token123',
        bot_id: 'bot1',
        bot_name: 'Bot 1',
      })
      await manager.setCurrentServer('guild1', 'Test Guild')

      const result = await listAction({ _credManager: manager })

      expect(result.users).toHaveLength(3)
      expect(result.users?.[0]).toEqual({
        id: 'user1',
        username: 'alice',
        global_name: 'Alice',
        avatar: 'avatar1.png',
        bot: false,
      })
      expect(result.users?.[1]).toEqual({
        id: 'user2',
        username: 'bob',
        global_name: 'Bob',
        avatar: 'avatar2.png',
        bot: false,
      })
    })

    test('includes bot users in list', async () => {
      const manager = new DiscordBotCredentialManager(tempDir)
      await manager.setCredentials({
        token: 'token123',
        bot_id: 'bot1',
        bot_name: 'Bot 1',
      })
      await manager.setCurrentServer('guild1', 'Test Guild')

      const result = await listAction({ _credManager: manager })

      const botUser = result.users?.find((u) => u.bot === true)
      expect(botUser).toBeDefined()
      expect(botUser?.username).toBe('mybot')
    })

    test('returns error when no server set', async () => {
      const manager = new DiscordBotCredentialManager(tempDir)
      await manager.setCredentials({
        token: 'token123',
        bot_id: 'bot1',
        bot_name: 'Bot 1',
      })

      const result = await listAction({ _credManager: manager })

      expect(result.error).toBeDefined()
      expect(result.error).toContain('No server set')
    })

    test('handles client errors', async () => {
      mockListUsers.mockImplementationOnce(() => Promise.reject(new Error('API Error')))

      const manager = new DiscordBotCredentialManager(tempDir)
      await manager.setCredentials({
        token: 'token123',
        bot_id: 'bot1',
        bot_name: 'Bot 1',
      })
      await manager.setCurrentServer('guild1', 'Test Guild')

      const result = await listAction({ _credManager: manager })

      expect(result.error).toBeDefined()
      expect(result.error).toContain('API Error')
    })
  })

  describe('infoAction', () => {
    test('returns user info by ID', async () => {
      const manager = new DiscordBotCredentialManager(tempDir)
      await manager.setCredentials({
        token: 'token123',
        bot_id: 'bot1',
        bot_name: 'Bot 1',
      })

      const result = await infoAction('user1', { _credManager: manager })

      expect(result.id).toBe('user1')
      expect(result.username).toBe('alice')
      expect(result.global_name).toBe('Alice')
      expect(result.avatar).toBe('avatar1.png')
      expect(result.bot).toBe(false)
    })

    test('returns bot user info', async () => {
      const manager = new DiscordBotCredentialManager(tempDir)
      await manager.setCredentials({
        token: 'token123',
        bot_id: 'bot1',
        bot_name: 'Bot 1',
      })

      const result = await infoAction('bot1', { _credManager: manager })

      expect(result.id).toBe('bot1')
      expect(result.username).toBe('mybot')
      expect(result.bot).toBe(true)
    })

    test('returns error for nonexistent user', async () => {
      const manager = new DiscordBotCredentialManager(tempDir)
      await manager.setCredentials({
        token: 'token123',
        bot_id: 'bot1',
        bot_name: 'Bot 1',
      })

      const result = await infoAction('nonexistent', { _credManager: manager })

      expect(result.error).toBeDefined()
      expect(result.error).toContain('User not found')
    })

    test('handles client errors', async () => {
      mockGetUser.mockImplementationOnce(() => Promise.reject(new Error('API Error')))

      const manager = new DiscordBotCredentialManager(tempDir)
      await manager.setCredentials({
        token: 'token123',
        bot_id: 'bot1',
        bot_name: 'Bot 1',
      })

      const result = await infoAction('user1', { _credManager: manager })

      expect(result.error).toBeDefined()
      expect(result.error).toContain('API Error')
    })
  })
})
