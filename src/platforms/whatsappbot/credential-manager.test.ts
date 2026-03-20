import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { mkdir, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { WhatsAppBotCredentialManager } from './credential-manager'

const WORKSPACE_A = {
  workspace_id: '1234567890',
  workspace_name: 'Support Number',
  phone_number_id: '1234567890',
  access_token: 'token-a',
}

const WORKSPACE_B = {
  workspace_id: '9876543210',
  workspace_name: 'Sales Number',
  phone_number_id: '9876543210',
  access_token: 'token-b',
}

describe('WhatsAppBotCredentialManager', () => {
  let tempDir: string
  let manager: WhatsAppBotCredentialManager

  beforeEach(async () => {
    tempDir = join(tmpdir(), `whatsappbot-cred-test-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })
    manager = new WhatsAppBotCredentialManager(tempDir)
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true })
    }
    delete process.env.E2E_WHATSAPPBOT_PHONE_NUMBER_ID
    delete process.env.E2E_WHATSAPPBOT_ACCESS_TOKEN
    delete process.env.E2E_WHATSAPPBOT_WORKSPACE_NAME
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
        current: { workspace_id: '1234567890' },
        workspaces: {
          '1234567890': WORKSPACE_A,
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

    test('returns current workspace credentials', async () => {
      await manager.setCredentials(WORKSPACE_A)

      const creds = await manager.getCredentials()

      expect(creds).toEqual(WORKSPACE_A)
    })

    test('returns specific workspace by id', async () => {
      await manager.setCredentials(WORKSPACE_A)
      await manager.setCredentials(WORKSPACE_B)

      const creds = await manager.getCredentials('1234567890')

      expect(creds).toEqual(WORKSPACE_A)
    })

    test('returns null for non-existent workspace id', async () => {
      await manager.setCredentials(WORKSPACE_A)

      const creds = await manager.getCredentials('nonexistent')

      expect(creds).toBeNull()
    })

    test('env vars take precedence when no workspaceId specified', async () => {
      await manager.setCredentials(WORKSPACE_A)

      process.env.E2E_WHATSAPPBOT_PHONE_NUMBER_ID = 'env-phone-id'
      process.env.E2E_WHATSAPPBOT_ACCESS_TOKEN = 'env-token'
      process.env.E2E_WHATSAPPBOT_WORKSPACE_NAME = 'Env Workspace'

      const creds = await manager.getCredentials()

      expect(creds?.phone_number_id).toBe('env-phone-id')
      expect(creds?.access_token).toBe('env-token')
      expect(creds?.workspace_id).toBe('env-phone-id')
      expect(creds?.workspace_name).toBe('Env Workspace')
    })

    test('env vars ignored when workspaceId explicitly provided', async () => {
      await manager.setCredentials(WORKSPACE_A)

      process.env.E2E_WHATSAPPBOT_PHONE_NUMBER_ID = 'env-phone-id'
      process.env.E2E_WHATSAPPBOT_ACCESS_TOKEN = 'env-token'

      const creds = await manager.getCredentials('1234567890')

      expect(creds?.phone_number_id).toBe('1234567890')
      expect(creds?.access_token).toBe('token-a')
    })
  })

  describe('setCredentials', () => {
    test('stores workspace and sets as current', async () => {
      await manager.setCredentials(WORKSPACE_A)

      const config = await manager.load()
      expect(config.current).toEqual({ workspace_id: '1234567890' })
      expect(config.workspaces['1234567890']).toEqual(WORKSPACE_A)
    })

    test('stores multiple workspaces', async () => {
      await manager.setCredentials(WORKSPACE_A)
      await manager.setCredentials(WORKSPACE_B)

      const config = await manager.load()
      expect(Object.keys(config.workspaces)).toEqual(['1234567890', '9876543210'])
      expect(config.current).toEqual({ workspace_id: '9876543210' })
    })
  })

  describe('listAll', () => {
    test('returns all workspaces with current flag', async () => {
      await manager.setCredentials(WORKSPACE_A)
      await manager.setCredentials(WORKSPACE_B)

      const all = await manager.listAll()

      expect(all).toHaveLength(2)
      expect(all.find((workspace) => workspace.workspace_id === '1234567890')?.is_current).toBe(false)
      expect(all.find((workspace) => workspace.workspace_id === '9876543210')?.is_current).toBe(true)
    })
  })

  describe('setCurrent', () => {
    test('switches current workspace', async () => {
      await manager.setCredentials(WORKSPACE_A)
      await manager.setCredentials(WORKSPACE_B)

      const switched = await manager.setCurrent('1234567890')

      expect(switched).toBe(true)
      const creds = await manager.getCredentials()
      expect(creds?.workspace_id).toBe('1234567890')
    })

    test('returns false for unknown workspace', async () => {
      expect(await manager.setCurrent('nonexistent')).toBe(false)
    })
  })

  describe('removeWorkspace', () => {
    test('removes a workspace by id', async () => {
      await manager.setCredentials(WORKSPACE_A)
      await manager.setCredentials(WORKSPACE_B)

      const removed = await manager.removeWorkspace('1234567890')

      expect(removed).toBe(true)
      const config = await manager.load()
      expect(Object.keys(config.workspaces)).toEqual(['9876543210'])
    })

    test('clears current when current workspace removed', async () => {
      await manager.setCredentials(WORKSPACE_A)

      await manager.removeWorkspace('1234567890')

      const config = await manager.load()
      expect(config.current).toBeNull()
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
    })
  })

  describe('file permissions', () => {
    test('saves file with secure permissions (600)', async () => {
      await manager.setCredentials(WORKSPACE_A)

      const credPath = join(tempDir, 'whatsappbot-credentials.json')
      const stats = await stat(credPath)

      expect(stats.mode & 0o777).toBe(0o600)
    })
  })
})
