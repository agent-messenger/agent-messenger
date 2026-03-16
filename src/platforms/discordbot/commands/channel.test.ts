import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const mockListChannels = mock((guildId: string) =>
  Promise.resolve([
    { id: 'ch1', guild_id: guildId, name: 'general', type: 0 },
    { id: 'ch2', guild_id: guildId, name: 'announcements', type: 0 },
    { id: 'ch3', guild_id: guildId, name: 'voice-channel', type: 2 },
  ]),
)

const mockGetChannel = mock((channelId: string) =>
  Promise.resolve({
    id: channelId,
    guild_id: 'guild1',
    name: channelId === 'ch1' ? 'general' : 'announcements',
    type: 0,
    topic: 'General discussion',
  }),
)

const mockResolveChannel = mock((_guildId: string, channel: string) => {
  if (channel === 'ch1' || channel === 'general' || channel === '#general') return Promise.resolve('ch1')
  if (channel === 'ch2' || channel === 'announcements' || channel === '#announcements') return Promise.resolve('ch2')
  if (/^\d+$/.test(channel)) return Promise.resolve(channel)
  return Promise.reject(new Error(`Channel not found: "${channel}"`))
})

mock.module('../client', () => ({
  DiscordBotClient: class MockDiscordBotClient {
    constructor(token: string) {
      if (!token) {
        throw new Error('Token is required')
      }
    }
    listChannels = mockListChannels
    getChannel = mockGetChannel
    resolveChannel = mockResolveChannel
  },
}))

import { DiscordBotCredentialManager } from '../credential-manager'
import { infoAction, listAction } from './channel'

describe('channel commands', () => {
  let tempDir: string
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(async () => {
    tempDir = join(tmpdir(), `discordbot-channel-test-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })
    originalEnv = { ...process.env }
    delete process.env.E2E_DISCORDBOT_TOKEN
    delete process.env.E2E_DISCORDBOT_SERVER_ID
    mockListChannels.mockClear()
    mockGetChannel.mockClear()
    mockResolveChannel.mockClear()
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true })
    }
    process.env = originalEnv
  })

  describe('listAction', () => {
    test('lists text channels from current server', async () => {
      const manager = new DiscordBotCredentialManager(tempDir)
      await manager.setCredentials({
        token: 'token123',
        bot_id: 'bot1',
        bot_name: 'Bot 1',
      })
      await manager.setCurrentServer('guild1', 'Test Guild')

      const result = await listAction({ _credManager: manager })

      expect(result.channels).toHaveLength(2)
      expect(result.channels?.[0]).toEqual({
        id: 'ch1',
        name: 'general',
        type: 0,
      })
      expect(result.channels?.[1]).toEqual({
        id: 'ch2',
        name: 'announcements',
        type: 0,
      })
    })

    test('filters out non-text channels', async () => {
      const manager = new DiscordBotCredentialManager(tempDir)
      await manager.setCredentials({
        token: 'token123',
        bot_id: 'bot1',
        bot_name: 'Bot 1',
      })
      await manager.setCurrentServer('guild1', 'Test Guild')

      const result = await listAction({ _credManager: manager })

      const hasVoiceChannel = result.channels?.some((c) => c.type === 2)
      expect(hasVoiceChannel).toBe(false)
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
      mockListChannels.mockImplementationOnce(() => Promise.reject(new Error('API Error')))

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
    test('returns channel info by ID', async () => {
      const manager = new DiscordBotCredentialManager(tempDir)
      await manager.setCredentials({
        token: 'token123',
        bot_id: 'bot1',
        bot_name: 'Bot 1',
      })
      await manager.setCurrentServer('guild1', 'Test Guild')

      const result = await infoAction('ch1', { _credManager: manager })

      expect(result.id).toBe('ch1')
      expect(result.name).toBe('general')
      expect(result.type).toBe(0)
      expect(result.topic).toBe('General discussion')
      expect(result.guild_id).toBe('guild1')
    })

    test('resolves channel by name', async () => {
      const manager = new DiscordBotCredentialManager(tempDir)
      await manager.setCredentials({
        token: 'token123',
        bot_id: 'bot1',
        bot_name: 'Bot 1',
      })
      await manager.setCurrentServer('guild1', 'Test Guild')

      const result = await infoAction('general', { _credManager: manager })

      expect(result.id).toBe('ch1')
      expect(result.name).toBe('general')
    })

    test('resolves channel by name with hash prefix', async () => {
      const manager = new DiscordBotCredentialManager(tempDir)
      await manager.setCredentials({
        token: 'token123',
        bot_id: 'bot1',
        bot_name: 'Bot 1',
      })
      await manager.setCurrentServer('guild1', 'Test Guild')

      const result = await infoAction('#announcements', { _credManager: manager })

      expect(result.id).toBe('ch2')
      expect(result.name).toBe('announcements')
    })

    test('returns error for nonexistent channel', async () => {
      const manager = new DiscordBotCredentialManager(tempDir)
      await manager.setCredentials({
        token: 'token123',
        bot_id: 'bot1',
        bot_name: 'Bot 1',
      })
      await manager.setCurrentServer('guild1', 'Test Guild')

      const result = await infoAction('nonexistent', { _credManager: manager })

      expect(result.error).toBeDefined()
      expect(result.error).toContain('Channel not found')
    })

    test('returns error when no server set', async () => {
      const manager = new DiscordBotCredentialManager(tempDir)
      await manager.setCredentials({
        token: 'token123',
        bot_id: 'bot1',
        bot_name: 'Bot 1',
      })

      const result = await infoAction('general', { _credManager: manager })

      expect(result.error).toBeDefined()
      expect(result.error).toContain('No server set')
    })

    test('handles client errors', async () => {
      mockGetChannel.mockImplementationOnce(() => Promise.reject(new Error('Channel not found')))

      const manager = new DiscordBotCredentialManager(tempDir)
      await manager.setCredentials({
        token: 'token123',
        bot_id: 'bot1',
        bot_name: 'Bot 1',
      })
      await manager.setCurrentServer('guild1', 'Test Guild')

      const result = await infoAction('ch1', { _credManager: manager })

      expect(result.error).toBeDefined()
      expect(result.error).toContain('Channel not found')
    })
  })
})
