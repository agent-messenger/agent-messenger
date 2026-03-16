import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { mkdir, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { SlackBotCredentialManager } from './credential-manager'

const CREDS_A = {
  token: 'xoxb-token-a',
  workspace_id: 'T123',
  workspace_name: 'Workspace A',
  bot_id: 'deploy',
  bot_name: 'Deploy Bot',
}

const CREDS_B = {
  token: 'xoxb-token-b',
  workspace_id: 'T123',
  workspace_name: 'Workspace A',
  bot_id: 'alert',
  bot_name: 'Alert Bot',
}

const CREDS_C = {
  token: 'xoxb-token-c',
  workspace_id: 'T999',
  workspace_name: 'Workspace B',
  bot_id: 'deploy',
  bot_name: 'Deploy Bot (B)',
}

describe('SlackBotCredentialManager', () => {
  let tempDir: string
  let manager: SlackBotCredentialManager

  beforeEach(async () => {
    tempDir = join(tmpdir(), `slackbot-cred-test-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })
    manager = new SlackBotCredentialManager(tempDir)
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true })
    }
    delete process.env.E2E_SLACKBOT_TOKEN
    delete process.env.E2E_SLACKBOT_WORKSPACE_ID
    delete process.env.E2E_SLACKBOT_WORKSPACE_NAME
  })

  describe('load', () => {
    test('returns empty config when no file exists', async () => {
      const config = await manager.load()

      expect(config.current).toBeNull()
      expect(config.workspaces).toEqual({})
    })
  })

  describe('save and load', () => {
    test('persists config to file', async () => {
      const config = {
        current: { workspace_id: 'T123', bot_id: 'deploy' },
        workspaces: {
          T123: {
            workspace_id: 'T123',
            workspace_name: 'Test Workspace',
            bots: {
              deploy: { bot_id: 'deploy', bot_name: 'Deploy Bot', token: 'xoxb-test-token' },
            },
          },
        },
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

      const creds = await manager.getCredentials('deploy')

      expect(creds).toEqual(CREDS_A)
    })

    test('returns specific bot by workspace_id/bot_id', async () => {
      await manager.setCredentials(CREDS_A)
      await manager.setCredentials(CREDS_C)

      const creds = await manager.getCredentials('T123/deploy')

      expect(creds).toEqual(CREDS_A)
    })

    test('returns null for ambiguous bot_id across workspaces', async () => {
      await manager.setCredentials(CREDS_A)
      await manager.setCredentials(CREDS_C)

      const creds = await manager.getCredentials('deploy')

      expect(creds).toBeNull()
    })

    test('env vars take precedence over file', async () => {
      await manager.setCredentials(CREDS_A)

      process.env.E2E_SLACKBOT_TOKEN = 'xoxb-env-token'
      process.env.E2E_SLACKBOT_WORKSPACE_ID = 'T789'
      process.env.E2E_SLACKBOT_WORKSPACE_NAME = 'Env Workspace'

      const creds = await manager.getCredentials()

      expect(creds?.token).toBe('xoxb-env-token')
      expect(creds?.workspace_id).toBe('T789')
      expect(creds?.bot_id).toBe('env')
    })
  })

  describe('setCredentials', () => {
    test('stores bot and sets as current', async () => {
      await manager.setCredentials(CREDS_A)

      const config = await manager.load()
      expect(config.current).toEqual({ workspace_id: 'T123', bot_id: 'deploy' })
      expect(config.workspaces.T123.bots.deploy.token).toBe('xoxb-token-a')
    })

    test('stores multiple bots in same workspace', async () => {
      await manager.setCredentials(CREDS_A)
      await manager.setCredentials(CREDS_B)

      const config = await manager.load()
      expect(Object.keys(config.workspaces.T123.bots)).toEqual(['deploy', 'alert'])
      expect(config.current).toEqual({ workspace_id: 'T123', bot_id: 'alert' })
    })

    test('stores bots across workspaces', async () => {
      await manager.setCredentials(CREDS_A)
      await manager.setCredentials(CREDS_C)

      const config = await manager.load()
      expect(Object.keys(config.workspaces)).toEqual(['T123', 'T999'])
    })
  })

  describe('listAll', () => {
    test('returns all bots with current flag', async () => {
      await manager.setCredentials(CREDS_A)
      await manager.setCredentials(CREDS_B)

      const all = await manager.listAll()

      expect(all).toHaveLength(2)
      expect(all.find((b) => b.bot_id === 'deploy')?.is_current).toBe(false)
      expect(all.find((b) => b.bot_id === 'alert')?.is_current).toBe(true)
    })
  })

  describe('setCurrent', () => {
    test('switches current bot', async () => {
      await manager.setCredentials(CREDS_A)
      await manager.setCredentials(CREDS_B)

      const switched = await manager.setCurrent('deploy')

      expect(switched).toBe(true)
      const creds = await manager.getCredentials()
      expect(creds?.bot_id).toBe('deploy')
    })

    test('returns false for unknown bot', async () => {
      expect(await manager.setCurrent('nonexistent')).toBe(false)
    })
  })

  describe('removeBot', () => {
    test('removes a bot by id', async () => {
      await manager.setCredentials(CREDS_A)
      await manager.setCredentials(CREDS_B)

      const removed = await manager.removeBot('deploy')

      expect(removed).toBe(true)
      const config = await manager.load()
      expect(Object.keys(config.workspaces.T123.bots)).toEqual(['alert'])
    })

    test('removes workspace when last bot removed', async () => {
      await manager.setCredentials(CREDS_A)

      await manager.removeBot('deploy')

      const config = await manager.load()
      expect(config.workspaces.T123).toBeUndefined()
    })

    test('clears current when current bot removed', async () => {
      await manager.setCredentials(CREDS_A)

      await manager.removeBot('deploy')

      const config = await manager.load()
      expect(config.current).toBeNull()
    })

    test('returns false for unknown bot', async () => {
      expect(await manager.removeBot('nonexistent')).toBe(false)
    })

    test('returns false for ambiguous bot_id across workspaces', async () => {
      await manager.setCredentials(CREDS_A)
      await manager.setCredentials(CREDS_C)

      const removed = await manager.removeBot('deploy')

      expect(removed).toBe(false)
      const config = await manager.load()
      expect(config.workspaces.T123.bots.deploy).toBeDefined()
      expect(config.workspaces.T999.bots.deploy).toBeDefined()
    })
  })

  describe('clearCredentials', () => {
    test('removes all credentials', async () => {
      await manager.setCredentials(CREDS_A)
      await manager.setCredentials(CREDS_B)

      await manager.clearCredentials()

      const config = await manager.load()
      expect(config.current).toBeNull()
      expect(config.workspaces).toEqual({})
    })
  })

  describe('file permissions', () => {
    test('saves file with secure permissions (600)', async () => {
      await manager.setCredentials(CREDS_A)

      const credPath = join(tempDir, 'slackbot-credentials.json')
      const stats = await stat(credPath)

      expect(stats.mode & 0o777).toBe(0o600)
    })
  })
})
