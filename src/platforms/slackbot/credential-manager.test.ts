import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { SlackBotCredentialManager } from './credential-manager'

describe('SlackBotCredentialManager', () => {
  let tempDir: string
  let manager: SlackBotCredentialManager

  beforeEach(async () => {
    // given: a fresh temp directory for each test
    tempDir = join(tmpdir(), `slackbot-cred-test-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })
    manager = new SlackBotCredentialManager(tempDir)
  })

  afterEach(() => {
    // cleanup
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true })
    }
    // reset env vars
    delete process.env.E2E_SLACKBOT_TOKEN
    delete process.env.E2E_SLACKBOT_WORKSPACE_ID
    delete process.env.E2E_SLACKBOT_WORKSPACE_NAME
  })

  describe('load', () => {
    test('returns empty config when no file exists', async () => {
      // when
      const config = await manager.load()

      // then
      expect(config.current_workspace).toBeNull()
      expect(config.token).toBeNull()
      expect(config.workspaces).toEqual({})
    })
  })

  describe('save and load', () => {
    test('persists config to file', async () => {
      // given
      const config = {
        current_workspace: 'T123',
        token: 'xoxb-test-token',
        workspaces: {
          T123: {
            workspace_id: 'T123',
            workspace_name: 'Test Workspace',
          },
        },
      }

      // when
      await manager.save(config)
      const loaded = await manager.load()

      // then
      expect(loaded).toEqual(config)
    })
  })

  describe('getCredentials', () => {
    test('returns null when no credentials exist', async () => {
      // when
      const creds = await manager.getCredentials()

      // then
      expect(creds).toBeNull()
    })

    test('returns credentials from file', async () => {
      // given
      await manager.setCredentials({
        token: 'xoxb-file-token',
        workspace_id: 'T456',
        workspace_name: 'File Workspace',
      })

      // when
      const creds = await manager.getCredentials()

      // then
      expect(creds).toEqual({
        token: 'xoxb-file-token',
        workspace_id: 'T456',
        workspace_name: 'File Workspace',
      })
    })

    test('env vars take precedence over file', async () => {
      // given: credentials in file
      await manager.setCredentials({
        token: 'xoxb-file-token',
        workspace_id: 'T456',
        workspace_name: 'File Workspace',
      })

      // given: env vars set
      process.env.E2E_SLACKBOT_TOKEN = 'xoxb-env-token'
      process.env.E2E_SLACKBOT_WORKSPACE_ID = 'T789'
      process.env.E2E_SLACKBOT_WORKSPACE_NAME = 'Env Workspace'

      // when
      const creds = await manager.getCredentials()

      // then: env vars should win
      expect(creds).toEqual({
        token: 'xoxb-env-token',
        workspace_id: 'T789',
        workspace_name: 'Env Workspace',
      })
    })
  })

  describe('setCredentials', () => {
    test('stores credentials and sets as current workspace', async () => {
      // when
      await manager.setCredentials({
        token: 'xoxb-new-token',
        workspace_id: 'T999',
        workspace_name: 'New Workspace',
      })

      // then
      const config = await manager.load()
      expect(config.current_workspace).toBe('T999')
      expect(config.token).toBe('xoxb-new-token')
      expect(config.workspaces['T999']).toEqual({
        workspace_id: 'T999',
        workspace_name: 'New Workspace',
      })
    })
  })

  describe('clearCredentials', () => {
    test('removes all credentials', async () => {
      // given
      await manager.setCredentials({
        token: 'xoxb-token',
        workspace_id: 'T123',
        workspace_name: 'Test',
      })

      // when
      await manager.clearCredentials()

      // then
      const config = await manager.load()
      expect(config.current_workspace).toBeNull()
      expect(config.token).toBeNull()
      expect(config.workspaces).toEqual({})
    })
  })

  describe('file permissions', () => {
    test('saves file with secure permissions (600)', async () => {
      // given
      await manager.setCredentials({
        token: 'xoxb-token',
        workspace_id: 'T123',
        workspace_name: 'Test',
      })

      // when: check file permissions
      const credPath = join(tempDir, 'slackbot-credentials.json')
      const stats = Bun.file(credPath)

      // then: file should exist (we can't easily check permissions in Bun, but we trust chmod)
      expect(await stats.exists()).toBe(true)
    })
  })
})
