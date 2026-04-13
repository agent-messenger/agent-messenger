import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { mkdir, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ChannelBotCredentialManager } from './credential-manager'

const WORKSPACE_A = {
  workspace_id: 'ch_abc123',
  workspace_name: 'Company A',
  access_key: 'key-a',
  access_secret: 'secret-a',
}

const WORKSPACE_B = {
  workspace_id: 'ch_def456',
  workspace_name: 'Company B',
  access_key: 'key-b',
  access_secret: 'secret-b',
}

describe('ChannelBotCredentialManager', () => {
  let tempDir: string
  let manager: ChannelBotCredentialManager

  beforeEach(async () => {
    tempDir = join(tmpdir(), `channelbot-cred-test-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })
    manager = new ChannelBotCredentialManager(tempDir)
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true })
    }
    delete process.env.E2E_CHANNELBOT_ACCESS_KEY
    delete process.env.E2E_CHANNELBOT_ACCESS_SECRET
  })

  describe('load', () => {
    test('returns empty config when no file exists', async () => {
      const config = await manager.load()

      expect(config.current).toBeNull()
      expect(config.workspaces).toEqual({})
      expect(config.default_bot).toBeNull()
    })
  })

  describe('save and load', () => {
    test('persists config to file', async () => {
      const config = {
        current: { workspace_id: 'ch_abc123' },
        workspaces: {
          ch_abc123: {
            workspace_id: 'ch_abc123',
            workspace_name: 'Test Workspace',
            access_key: 'test-key',
            access_secret: 'test-secret',
          },
        },
        default_bot: null,
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

    test('returns current workspace credentials', async () => {
      await manager.setCredentials(WORKSPACE_A)

      const creds = await manager.getCredentials()

      expect(creds).toEqual(WORKSPACE_A)
    })

    test('returns specific workspace by id', async () => {
      await manager.setCredentials(WORKSPACE_A)
      await manager.setCredentials(WORKSPACE_B)

      const creds = await manager.getCredentials('ch_abc123')

      expect(creds).toEqual(WORKSPACE_A)
    })

    test('returns null for non-existent workspace id', async () => {
      await manager.setCredentials(WORKSPACE_A)

      const creds = await manager.getCredentials('nonexistent')

      expect(creds).toBeNull()
    })

    test('env vars take precedence when no workspaceId specified', async () => {
      await manager.setCredentials(WORKSPACE_A)

      process.env.E2E_CHANNELBOT_ACCESS_KEY = 'env-key'
      process.env.E2E_CHANNELBOT_ACCESS_SECRET = 'env-secret'

      const creds = await manager.getCredentials()

      expect(creds?.access_key).toBe('env-key')
      expect(creds?.access_secret).toBe('env-secret')
      expect(creds?.workspace_id).toBe('env')
      expect(creds?.workspace_name).toBe('env')
    })

    test('env vars ignored when workspaceId explicitly provided', async () => {
      await manager.setCredentials(WORKSPACE_A)

      process.env.E2E_CHANNELBOT_ACCESS_KEY = 'env-key'
      process.env.E2E_CHANNELBOT_ACCESS_SECRET = 'env-secret'

      const creds = await manager.getCredentials('ch_abc123')

      expect(creds?.access_key).toBe('key-a')
      expect(creds?.access_secret).toBe('secret-a')
      expect(creds?.workspace_id).toBe('ch_abc123')
    })
  })

  describe('setCredentials', () => {
    test('stores workspace and sets as current', async () => {
      await manager.setCredentials(WORKSPACE_A)

      const config = await manager.load()
      expect(config.current).toEqual({ workspace_id: 'ch_abc123' })
      expect(config.workspaces['ch_abc123']).toEqual(WORKSPACE_A)
    })

    test('stores multiple workspaces', async () => {
      await manager.setCredentials(WORKSPACE_A)
      await manager.setCredentials(WORKSPACE_B)

      const config = await manager.load()
      expect(Object.keys(config.workspaces)).toEqual(['ch_abc123', 'ch_def456'])
      expect(config.current).toEqual({ workspace_id: 'ch_def456' })
    })

    test('overwrites existing workspace with same id', async () => {
      await manager.setCredentials(WORKSPACE_A)
      const updated = { ...WORKSPACE_A, workspace_name: 'Updated Company A' }
      await manager.setCredentials(updated)

      const config = await manager.load()
      expect(Object.keys(config.workspaces)).toHaveLength(1)
      expect(config.workspaces['ch_abc123'].workspace_name).toBe('Updated Company A')
    })
  })

  describe('listAll', () => {
    test('returns all workspaces with current flag', async () => {
      await manager.setCredentials(WORKSPACE_A)
      await manager.setCredentials(WORKSPACE_B)

      const all = await manager.listAll()

      expect(all).toHaveLength(2)
      expect(all.find((w) => w.workspace_id === 'ch_abc123')?.is_current).toBe(false)
      expect(all.find((w) => w.workspace_id === 'ch_def456')?.is_current).toBe(true)
    })

    test('returns empty array when no workspaces exist', async () => {
      const all = await manager.listAll()

      expect(all).toEqual([])
    })
  })

  describe('setCurrent', () => {
    test('switches current workspace', async () => {
      await manager.setCredentials(WORKSPACE_A)
      await manager.setCredentials(WORKSPACE_B)

      const switched = await manager.setCurrent('ch_abc123')

      expect(switched).toBe(true)
      const creds = await manager.getCredentials()
      expect(creds?.workspace_id).toBe('ch_abc123')
    })

    test('returns false for unknown workspace', async () => {
      expect(await manager.setCurrent('nonexistent')).toBe(false)
    })
  })

  describe('removeWorkspace', () => {
    test('removes a workspace by id', async () => {
      await manager.setCredentials(WORKSPACE_A)
      await manager.setCredentials(WORKSPACE_B)

      const removed = await manager.removeWorkspace('ch_abc123')

      expect(removed).toBe(true)
      const config = await manager.load()
      expect(Object.keys(config.workspaces)).toEqual(['ch_def456'])
    })

    test('clears current when current workspace removed', async () => {
      await manager.setCredentials(WORKSPACE_A)

      await manager.removeWorkspace('ch_abc123')

      const config = await manager.load()
      expect(config.current).toBeNull()
    })

    test('returns false for unknown workspace', async () => {
      expect(await manager.removeWorkspace('nonexistent')).toBe(false)
    })

    test('does not clear current if removing non-current workspace', async () => {
      await manager.setCredentials(WORKSPACE_A)
      await manager.setCredentials(WORKSPACE_B)

      await manager.removeWorkspace('ch_abc123')

      const config = await manager.load()
      expect(config.current?.workspace_id).toBe('ch_def456')
    })
  })

  describe('clearCredentials', () => {
    test('removes all credentials', async () => {
      await manager.setCredentials(WORKSPACE_A)
      await manager.setCredentials(WORKSPACE_B)

      await manager.clearCredentials()

      const config = await manager.load()
      expect(config.current).toBeNull()
      expect(config.workspaces).toEqual({})
      expect(config.default_bot).toBeNull()
    })
  })

  describe('getDefaultBot', () => {
    test('returns null initially', async () => {
      const bot = await manager.getDefaultBot()

      expect(bot).toBeNull()
    })

    test('returns default bot name', async () => {
      await manager.setDefaultBot('my-bot')

      const bot = await manager.getDefaultBot()

      expect(bot).toBe('my-bot')
    })
  })

  describe('setDefaultBot', () => {
    test('saves and retrieves default bot', async () => {
      await manager.setDefaultBot('my-bot')

      const bot = await manager.getDefaultBot()

      expect(bot).toBe('my-bot')
    })

    test('updates existing default bot', async () => {
      await manager.setDefaultBot('bot-1')
      await manager.setDefaultBot('bot-2')

      const bot = await manager.getDefaultBot()

      expect(bot).toBe('bot-2')
    })

    test('scopes default bot to current workspace', async () => {
      // given
      await manager.setCredentials(WORKSPACE_A)
      await manager.setDefaultBot('bot-a')
      await manager.setCredentials(WORKSPACE_B)
      await manager.setDefaultBot('bot-b')

      // when/then — workspace B is current
      expect(await manager.getDefaultBot()).toBe('bot-b')

      // when — switch to workspace A
      await manager.setCurrent(WORKSPACE_A.workspace_id)

      // then
      expect(await manager.getDefaultBot()).toBe('bot-a')
    })
  })

  describe('file permissions', () => {
    test('saves file with secure permissions (600)', async () => {
      await manager.setCredentials(WORKSPACE_A)

      const credPath = join(tempDir, 'channelbot-credentials.json')
      const stats = await stat(credPath)

      expect(stats.mode & 0o777).toBe(0o600)
    })
  })
})
