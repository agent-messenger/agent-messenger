import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const mockTestAuth = mock(() =>
  Promise.resolve({
    id: 'bot123',
    username: 'testbot',
    bot: true,
  }),
)

const mockListGuilds = mock(() =>
  Promise.resolve([
    { id: 'guild1', name: 'Test Guild' },
    { id: 'guild2', name: 'Another Guild' },
  ]),
)

mock.module('../client', () => ({
  DiscordBotClient: class MockDiscordBotClient {
    constructor(token: string) {
      if (!token) {
        throw new Error('Token is required')
      }
    }
    testAuth = mockTestAuth
    listGuilds = mockListGuilds
  },
}))

import { DiscordBotCredentialManager } from '../credential-manager'
import { clearAction, listAction, removeAction, setAction, statusAction, useAction } from './auth'

describe('auth commands', () => {
  let tempDir: string
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(async () => {
    tempDir = join(tmpdir(), `discordbot-auth-test-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })
    originalEnv = { ...process.env }
    delete process.env.E2E_DISCORDBOT_TOKEN
    delete process.env.E2E_DISCORDBOT_SERVER_ID
    delete process.env.E2E_DISCORDBOT_SERVER_NAME
    mockTestAuth.mockClear()
    mockListGuilds.mockClear()
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true })
    }
    process.env = originalEnv
  })

  describe('setAction', () => {
    test('validates and stores bot token with default bot_id from auth', async () => {
      const manager = new DiscordBotCredentialManager(tempDir)

      const result = await setAction('token123', { _credManager: manager })

      expect(result.success).toBe(true)
      expect(result.bot_id).toBe('bot123')
      expect(result.bot_name).toBe('testbot')
      expect(result.server_id).toBe('guild1')
      expect(result.server_name).toBe('Test Guild')

      const creds = await manager.getCredentials()
      expect(creds?.token).toBe('token123')
      expect(creds?.bot_id).toBe('bot123')
    })

    test('uses --bot flag as bot_id', async () => {
      const manager = new DiscordBotCredentialManager(tempDir)

      const result = await setAction('token123', { bot: 'mybot', _credManager: manager })

      expect(result.bot_id).toBe('mybot')
      const creds = await manager.getCredentials('mybot')
      expect(creds?.token).toBe('token123')
    })

    test('rejects user tokens (bot: false)', async () => {
      mockTestAuth.mockImplementationOnce(() =>
        Promise.resolve({
          id: 'user123',
          username: 'testuser',
          bot: false,
        }),
      )

      const manager = new DiscordBotCredentialManager(tempDir)

      const result = await setAction('token123', { _credManager: manager })

      expect(result.error).toBeDefined()
      expect(result.error).toContain('not a bot token')
    })

    test('rejects user tokens (bot: undefined)', async () => {
      mockTestAuth.mockImplementationOnce(() =>
        Promise.resolve({
          id: 'user123',
          username: 'testuser',
        } as unknown as Awaited<ReturnType<typeof mockTestAuth>>),
      )

      const manager = new DiscordBotCredentialManager(tempDir)

      const result = await setAction('token123', { _credManager: manager })

      expect(result.error).toBeDefined()
      expect(result.error).toContain('not a bot token')
    })

    test('handles client errors', async () => {
      mockTestAuth.mockImplementationOnce(() => Promise.reject(new Error('Invalid token')))

      const manager = new DiscordBotCredentialManager(tempDir)

      const result = await setAction('invalid', { _credManager: manager })

      expect(result.error).toBeDefined()
      expect(result.error).toContain('Invalid token')
    })
  })

  describe('clearAction', () => {
    test('removes all stored credentials', async () => {
      const manager = new DiscordBotCredentialManager(tempDir)
      await manager.setCredentials({
        token: 'token123',
        bot_id: 'mybot',
        bot_name: 'My Bot',
      })

      const result = await clearAction({ _credManager: manager })

      expect(result.success).toBe(true)
      expect(await manager.getCredentials()).toBeNull()
    })
  })

  describe('statusAction', () => {
    test('returns no credentials when none set', async () => {
      const manager = new DiscordBotCredentialManager(tempDir)

      const result = await statusAction({ _credManager: manager })

      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    test('returns valid status for current bot', async () => {
      const manager = new DiscordBotCredentialManager(tempDir)
      await manager.setCredentials({
        token: 'token123',
        bot_id: 'mybot',
        bot_name: 'My Bot',
        server_id: 'guild1',
        server_name: 'Test Guild',
      })

      const result = await statusAction({ _credManager: manager })

      expect(result.valid).toBe(true)
      expect(result.bot_id).toBe('bot123')
      expect(result.bot_name).toBe('testbot')
    })

    test('returns status for specific --bot', async () => {
      const manager = new DiscordBotCredentialManager(tempDir)
      await manager.setCredentials({
        token: 'token1',
        bot_id: 'bot1',
        bot_name: 'Bot 1',
      })
      await manager.setCredentials({
        token: 'token2',
        bot_id: 'bot2',
        bot_name: 'Bot 2',
      })

      const result = await statusAction({ bot: 'bot1', _credManager: manager })

      expect(result.valid).toBe(true)
      expect(result.bot_id).toBe('bot123')
    })

    test('returns invalid when token test fails', async () => {
      mockTestAuth.mockImplementationOnce(() => Promise.reject(new Error('Unauthorized')))

      const manager = new DiscordBotCredentialManager(tempDir)
      await manager.setCredentials({
        token: 'invalid-token',
        bot_id: 'mybot',
        bot_name: 'My Bot',
      })

      const result = await statusAction({ _credManager: manager })

      expect(result.valid).toBe(false)
    })

    test('returns invalid when bot field is false', async () => {
      mockTestAuth.mockImplementationOnce(() =>
        Promise.resolve({
          id: 'user123',
          username: 'testuser',
          bot: false,
        }),
      )

      const manager = new DiscordBotCredentialManager(tempDir)
      await manager.setCredentials({
        token: 'token123',
        bot_id: 'mybot',
        bot_name: 'My Bot',
      })

      const result = await statusAction({ _credManager: manager })

      expect(result.valid).toBe(false)
    })
  })

  describe('listAction', () => {
    test('returns all stored bots', async () => {
      const manager = new DiscordBotCredentialManager(tempDir)
      await manager.setCredentials({
        token: 'token1',
        bot_id: 'bot1',
        bot_name: 'Bot 1',
      })
      await manager.setCredentials({
        token: 'token2',
        bot_id: 'bot2',
        bot_name: 'Bot 2',
      })

      const result = await listAction({ _credManager: manager })

      expect(result.bots).toHaveLength(2)
      expect(result.bots?.find((b) => b.bot_id === 'bot2')?.is_current).toBe(true)
    })

    test('returns empty list when no bots stored', async () => {
      const manager = new DiscordBotCredentialManager(tempDir)

      const result = await listAction({ _credManager: manager })

      expect(result.bots).toHaveLength(0)
    })
  })

  describe('useAction', () => {
    test('switches current bot', async () => {
      const manager = new DiscordBotCredentialManager(tempDir)
      await manager.setCredentials({
        token: 'token1',
        bot_id: 'bot1',
        bot_name: 'Bot 1',
      })
      await manager.setCredentials({
        token: 'token2',
        bot_id: 'bot2',
        bot_name: 'Bot 2',
      })

      const result = await useAction('bot1', { _credManager: manager })

      expect(result.success).toBe(true)
      expect(result.bot_id).toBe('bot1')
    })

    test('returns error for unknown bot', async () => {
      const manager = new DiscordBotCredentialManager(tempDir)

      const result = await useAction('nonexistent', { _credManager: manager })

      expect(result.error).toBeDefined()
    })
  })

  describe('removeAction', () => {
    test('removes a stored bot', async () => {
      const manager = new DiscordBotCredentialManager(tempDir)
      await manager.setCredentials({
        token: 'token1',
        bot_id: 'bot1',
        bot_name: 'Bot 1',
      })

      const result = await removeAction('bot1', { _credManager: manager })

      expect(result.success).toBe(true)
      expect(await manager.getCredentials('bot1')).toBeNull()
    })

    test('returns error for unknown bot', async () => {
      const manager = new DiscordBotCredentialManager(tempDir)

      const result = await removeAction('nonexistent', { _credManager: manager })

      expect(result.error).toBeDefined()
    })
  })
})
