import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { mkdir, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { DiscordBotCredentialManager } from './credential-manager'

const CREDS_A = {
  token: 'bot-token-a',
  bot_id: 'bot-123',
  bot_name: 'Bot A',
}

const CREDS_B = {
  token: 'bot-token-b',
  bot_id: 'bot-456',
  bot_name: 'Bot B',
}

describe('DiscordBotCredentialManager', () => {
  let tempDir: string
  let manager: DiscordBotCredentialManager

  beforeEach(async () => {
    tempDir = join(tmpdir(), `discordbot-cred-test-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })
    manager = new DiscordBotCredentialManager(tempDir)
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true })
    }
    delete process.env.E2E_DISCORDBOT_TOKEN
    delete process.env.E2E_DISCORDBOT_SERVER_ID
    delete process.env.E2E_DISCORDBOT_SERVER_NAME
  })

  describe('load', () => {
    test('returns empty config when no file exists', async () => {
      const config = await manager.load()

      expect(config.current).toBeNull()
      expect(config.bots).toEqual({})
      expect(config.current_server).toBeNull()
      expect(config.servers).toEqual({})
    })
  })

  describe('save and load', () => {
    test('persists config to file', async () => {
      const config = {
        current: { bot_id: 'bot-123' },
        bots: {
          'bot-123': { bot_id: 'bot-123', bot_name: 'Test Bot', token: 'test-token' },
        },
        current_server: null,
        servers: {},
      }

      await manager.save(config)
      const loaded = await manager.load()

      expect(loaded).toEqual(config)
    })
  })

  describe('getCredentials', () => {
    test('returns null when no credentials exist', async () => {
      expect(await manager.getCredentials()).toBeNull()
    })

    test('returns current bot credentials', async () => {
      await manager.setCredentials(CREDS_A)

      const creds = await manager.getCredentials()

      expect(creds).toEqual(CREDS_A)
    })

    test('returns specific bot by id', async () => {
      await manager.setCredentials(CREDS_A)
      await manager.setCredentials(CREDS_B)

      const creds = await manager.getCredentials('bot-123')

      expect(creds).toEqual(CREDS_A)
    })

    test('returns null for non-existent bot id', async () => {
      await manager.setCredentials(CREDS_A)

      const creds = await manager.getCredentials('nonexistent')

      expect(creds).toBeNull()
    })

    test('env vars take precedence when no botId specified', async () => {
      await manager.setCredentials(CREDS_A)

      process.env.E2E_DISCORDBOT_TOKEN = 'env-token'
      process.env.E2E_DISCORDBOT_SERVER_ID = 'server-789'
      process.env.E2E_DISCORDBOT_SERVER_NAME = 'Env Server'

      const creds = await manager.getCredentials()

      expect(creds?.token).toBe('env-token')
      expect(creds?.bot_id).toBe('env')
      expect(creds?.bot_name).toBe('env')
      expect(creds?.server_id).toBe('server-789')
      expect(creds?.server_name).toBe('Env Server')
    })

    test('env vars ignored when botId explicitly provided', async () => {
      await manager.setCredentials(CREDS_A)

      process.env.E2E_DISCORDBOT_TOKEN = 'env-token'
      process.env.E2E_DISCORDBOT_SERVER_ID = 'server-789'

      const creds = await manager.getCredentials('bot-123')

      expect(creds?.token).toBe('bot-token-a')
      expect(creds?.bot_id).toBe('bot-123')
    })

    test('env vars use default server name when not provided', async () => {
      process.env.E2E_DISCORDBOT_TOKEN = 'env-token'
      process.env.E2E_DISCORDBOT_SERVER_ID = 'server-789'
      delete process.env.E2E_DISCORDBOT_SERVER_NAME

      const creds = await manager.getCredentials()

      expect(creds?.server_name).toBe('E2E Server')
    })
  })

  describe('setCredentials', () => {
    test('stores bot and sets as current', async () => {
      await manager.setCredentials(CREDS_A)

      const config = await manager.load()
      expect(config.current).toEqual({ bot_id: 'bot-123' })
      expect(config.bots['bot-123'].token).toBe('bot-token-a')
    })

    test('stores multiple bots', async () => {
      await manager.setCredentials(CREDS_A)
      await manager.setCredentials(CREDS_B)

      const config = await manager.load()
      expect(Object.keys(config.bots)).toEqual(['bot-123', 'bot-456'])
      expect(config.current).toEqual({ bot_id: 'bot-456' })
    })

    test('overwrites existing bot with same id', async () => {
      await manager.setCredentials(CREDS_A)
      const updated = { ...CREDS_A, bot_name: 'Updated Bot A' }
      await manager.setCredentials(updated)

      const config = await manager.load()
      expect(Object.keys(config.bots)).toHaveLength(1)
      expect(config.bots['bot-123'].bot_name).toBe('Updated Bot A')
    })
  })

  describe('listAll', () => {
    test('returns all bots with current flag', async () => {
      await manager.setCredentials(CREDS_A)
      await manager.setCredentials(CREDS_B)

      const all = await manager.listAll()

      expect(all).toHaveLength(2)
      expect(all.find((b) => b.bot_id === 'bot-123')?.is_current).toBe(false)
      expect(all.find((b) => b.bot_id === 'bot-456')?.is_current).toBe(true)
    })

    test('returns empty array when no bots exist', async () => {
      const all = await manager.listAll()

      expect(all).toEqual([])
    })
  })

  describe('setCurrent', () => {
    test('switches current bot', async () => {
      await manager.setCredentials(CREDS_A)
      await manager.setCredentials(CREDS_B)

      const switched = await manager.setCurrent('bot-123')

      expect(switched).toBe(true)
      const creds = await manager.getCredentials()
      expect(creds?.bot_id).toBe('bot-123')
    })

    test('returns false for unknown bot', async () => {
      expect(await manager.setCurrent('nonexistent')).toBe(false)
    })
  })

  describe('removeBot', () => {
    test('removes a bot by id', async () => {
      await manager.setCredentials(CREDS_A)
      await manager.setCredentials(CREDS_B)

      const removed = await manager.removeBot('bot-123')

      expect(removed).toBe(true)
      const config = await manager.load()
      expect(Object.keys(config.bots)).toEqual(['bot-456'])
    })

    test('clears current when current bot removed', async () => {
      await manager.setCredentials(CREDS_A)

      await manager.removeBot('bot-123')

      const config = await manager.load()
      expect(config.current).toBeNull()
    })

    test('returns false for unknown bot', async () => {
      expect(await manager.removeBot('nonexistent')).toBe(false)
    })

    test('does not clear current if removing non-current bot', async () => {
      await manager.setCredentials(CREDS_A)
      await manager.setCredentials(CREDS_B)

      await manager.removeBot('bot-123')

      const config = await manager.load()
      expect(config.current?.bot_id).toBe('bot-456')
    })
  })

  describe('clearCredentials', () => {
    test('removes all credentials', async () => {
      await manager.setCredentials(CREDS_A)
      await manager.setCredentials(CREDS_B)

      await manager.clearCredentials()

      const config = await manager.load()
      expect(config.current).toBeNull()
      expect(config.bots).toEqual({})
      expect(config.current_server).toBeNull()
      expect(config.servers).toEqual({})
    })
  })

  describe('getCurrentServer', () => {
    test('returns null when no server set', async () => {
      const serverId = await manager.getCurrentServer()

      expect(serverId).toBeNull()
    })

    test('returns current server id', async () => {
      await manager.setCurrentServer('guild-123', 'My Server')

      const serverId = await manager.getCurrentServer()

      expect(serverId).toBe('guild-123')
    })
  })

  describe('setCurrentServer', () => {
    test('sets current server and adds to servers map', async () => {
      await manager.setCurrentServer('guild-123', 'My Server')

      const config = await manager.load()
      expect(config.current_server).toBe('guild-123')
      expect(config.servers['guild-123']).toEqual({
        server_id: 'guild-123',
        server_name: 'My Server',
      })
    })

    test('updates existing server entry', async () => {
      await manager.setCurrentServer('guild-123', 'My Server')
      await manager.setCurrentServer('guild-123', 'Updated Server')

      const config = await manager.load()
      expect(config.servers['guild-123'].server_name).toBe('Updated Server')
    })

    test('switches current server', async () => {
      await manager.setCurrentServer('guild-123', 'Server A')
      await manager.setCurrentServer('guild-456', 'Server B')

      const config = await manager.load()
      expect(config.current_server).toBe('guild-456')
      expect(Object.keys(config.servers)).toEqual(['guild-123', 'guild-456'])
    })
  })

  describe('file permissions', () => {
    test('saves file with secure permissions (600)', async () => {
      await manager.setCredentials(CREDS_A)

      const credPath = join(tempDir, 'discordbot-credentials.json')
      const stats = await stat(credPath)

      expect(stats.mode & 0o777).toBe(0o600)
    })
  })
})
