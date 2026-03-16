import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const mockListGuilds = mock(() =>
  Promise.resolve([
    { id: 'guild1', name: 'Test Guild' },
    { id: 'guild2', name: 'Another Guild' },
  ]),
)

const mockGetGuild = mock((guildId: string) =>
  Promise.resolve({
    id: guildId,
    name: guildId === 'guild1' ? 'Test Guild' : 'Another Guild',
    icon: 'icon-hash',
    owner: true,
  }),
)

mock.module('../client', () => ({
  DiscordBotClient: class MockDiscordBotClient {
    constructor(token: string) {
      if (!token) {
        throw new Error('Token is required')
      }
    }
    listGuilds = mockListGuilds
    getGuild = mockGetGuild
  },
}))

import { DiscordBotCredentialManager } from '../credential-manager'
import { currentAction, infoAction, listAction, switchAction } from './server'

describe('server commands', () => {
  let tempDir: string
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(async () => {
    tempDir = join(tmpdir(), `discordbot-server-test-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })
    originalEnv = { ...process.env }
    delete process.env.E2E_DISCORDBOT_TOKEN
    delete process.env.E2E_DISCORDBOT_SERVER_ID
    delete process.env.E2E_DISCORDBOT_SERVER_NAME
    mockListGuilds.mockClear()
    mockGetGuild.mockClear()
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true })
    }
    process.env = originalEnv
  })

  describe('listAction', () => {
    test('lists all servers from client', async () => {
      const manager = new DiscordBotCredentialManager(tempDir)
      await manager.setCredentials({
        token: 'token123',
        bot_id: 'bot1',
        bot_name: 'Bot 1',
      })

      const result = await listAction({ _credManager: manager })

      expect(result.servers).toHaveLength(2)
      expect(result.servers?.[0]).toEqual({
        id: 'guild1',
        name: 'Test Guild',
        current: false,
      })
      expect(result.servers?.[1]).toEqual({
        id: 'guild2',
        name: 'Another Guild',
        current: false,
      })
    })

    test('marks current server in list', async () => {
      const manager = new DiscordBotCredentialManager(tempDir)
      await manager.setCredentials({
        token: 'token123',
        bot_id: 'bot1',
        bot_name: 'Bot 1',
      })
      await manager.setCurrentServer('guild1', 'Test Guild')

      const result = await listAction({ _credManager: manager })

      expect(result.servers?.[0].current).toBe(true)
      expect(result.servers?.[1].current).toBe(false)
    })

    test('handles client errors', async () => {
      mockListGuilds.mockImplementationOnce(() => Promise.reject(new Error('API Error')))

      const manager = new DiscordBotCredentialManager(tempDir)
      await manager.setCredentials({
        token: 'token123',
        bot_id: 'bot1',
        bot_name: 'Bot 1',
      })

      const result = await listAction({ _credManager: manager })

      expect(result.error).toBeDefined()
      expect(result.error).toContain('API Error')
    })
  })

  describe('currentAction', () => {
    test('returns current server info', async () => {
      const manager = new DiscordBotCredentialManager(tempDir)
      await manager.setCredentials({
        token: 'token123',
        bot_id: 'bot1',
        bot_name: 'Bot 1',
      })
      await manager.setCurrentServer('guild1', 'Test Guild')

      const result = await currentAction({ _credManager: manager })

      expect(result.id).toBe('guild1')
      expect(result.name).toBe('Test Guild')
    })

    test('returns error when no server set', async () => {
      const manager = new DiscordBotCredentialManager(tempDir)
      await manager.setCredentials({
        token: 'token123',
        bot_id: 'bot1',
        bot_name: 'Bot 1',
      })

      const result = await currentAction({ _credManager: manager })

      expect(result.error).toBeDefined()
      expect(result.error).toContain('No server set')
    })

    test('handles client errors', async () => {
      mockGetGuild.mockImplementationOnce(() => Promise.reject(new Error('Guild not found')))

      const manager = new DiscordBotCredentialManager(tempDir)
      await manager.setCredentials({
        token: 'token123',
        bot_id: 'bot1',
        bot_name: 'Bot 1',
      })
      await manager.setCurrentServer('guild1', 'Test Guild')

      const result = await currentAction({ _credManager: manager })

      expect(result.error).toBeDefined()
      expect(result.error).toContain('Guild not found')
    })
  })

  describe('switchAction', () => {
    test('switches to a new server', async () => {
      const manager = new DiscordBotCredentialManager(tempDir)
      await manager.setCredentials({
        token: 'token123',
        bot_id: 'bot1',
        bot_name: 'Bot 1',
      })

      const result = await switchAction('guild2', { _credManager: manager })

      expect(result.id).toBe('guild2')
      expect(result.name).toBe('Another Guild')

      const currentServer = await manager.getCurrentServer()
      expect(currentServer).toBe('guild2')
    })

    test('updates server name in credential manager', async () => {
      const manager = new DiscordBotCredentialManager(tempDir)
      await manager.setCredentials({
        token: 'token123',
        bot_id: 'bot1',
        bot_name: 'Bot 1',
      })

      await switchAction('guild1', { _credManager: manager })

      const config = await manager.load()
      expect(config.servers.guild1).toEqual({
        server_id: 'guild1',
        server_name: 'Test Guild',
      })
    })

    test('handles client errors', async () => {
      mockGetGuild.mockImplementationOnce(() => Promise.reject(new Error('Unauthorized')))

      const manager = new DiscordBotCredentialManager(tempDir)
      await manager.setCredentials({
        token: 'token123',
        bot_id: 'bot1',
        bot_name: 'Bot 1',
      })

      const result = await switchAction('guild1', { _credManager: manager })

      expect(result.error).toBeDefined()
      expect(result.error).toContain('Unauthorized')
    })
  })

  describe('infoAction', () => {
    test('returns server info', async () => {
      const manager = new DiscordBotCredentialManager(tempDir)
      await manager.setCredentials({
        token: 'token123',
        bot_id: 'bot1',
        bot_name: 'Bot 1',
      })

      const result = await infoAction('guild1', { _credManager: manager })

      expect(result.id).toBe('guild1')
      expect(result.name).toBe('Test Guild')
      expect(result.icon).toBe('icon-hash')
      expect(result.owner).toBe(true)
    })

    test('handles client errors', async () => {
      mockGetGuild.mockImplementationOnce(() => Promise.reject(new Error('Guild not found')))

      const manager = new DiscordBotCredentialManager(tempDir)
      await manager.setCredentials({
        token: 'token123',
        bot_id: 'bot1',
        bot_name: 'Bot 1',
      })

      const result = await infoAction('nonexistent', { _credManager: manager })

      expect(result.error).toBeDefined()
      expect(result.error).toContain('Guild not found')
    })
  })
})
