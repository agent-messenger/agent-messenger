import { afterEach, beforeEach, describe, expect, mock, it } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const mockTestAuth = mock(() =>
  Promise.resolve({
    ok: true,
    user_id: 'U123',
    team_id: 'T456',
    bot_id: 'B789',
    user: 'testbot',
    team: 'Test Team',
  }),
)

mock.module('../client', () => ({
  SlackBotClient: class MockSlackBotClient {
    async login(_credentials?: any) {
      return this
    }
    testAuth = mockTestAuth
  },
}))

import { SlackBotCredentialManager } from '../credential-manager'
import { clearAction, listAction, removeAction, setAction, statusAction, useAction } from './auth'

describe('auth commands', () => {
  let tempDir: string
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(async () => {
    tempDir = join(tmpdir(), `slackbot-auth-test-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })
    originalEnv = { ...process.env }
    mockTestAuth.mockClear()
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true })
    }
    process.env = originalEnv
  })

  describe('setAction', () => {
    it('validates and stores bot token with default bot_id from auth', async () => {
      const manager = new SlackBotCredentialManager(tempDir)

      const result = await setAction('xoxb-test-token', { _credManager: manager })

      expect(result.success).toBe(true)
      expect(result.workspace_id).toBe('T456')
      expect(result.bot_id).toBe('B789')

      const creds = await manager.getCredentials()
      expect(creds?.token).toBe('xoxb-test-token')
      expect(creds?.bot_id).toBe('B789')
    })

    it('uses --bot flag as bot_id', async () => {
      const manager = new SlackBotCredentialManager(tempDir)

      const result = await setAction('xoxb-test-token', { bot: 'deploy', _credManager: manager })

      expect(result.bot_id).toBe('deploy')
      const creds = await manager.getCredentials('deploy')
      expect(creds?.token).toBe('xoxb-test-token')
    })

    it('rejects user tokens', async () => {
      const manager = new SlackBotCredentialManager(tempDir)

      const result = await setAction('xoxp-user-token', { _credManager: manager })

      expect(result.error).toBeDefined()
      expect(result.error).toContain('bot token')
    })

    it('rejects invalid token format', async () => {
      const manager = new SlackBotCredentialManager(tempDir)

      const result = await setAction('invalid-token', { _credManager: manager })

      expect(result.error).toBeDefined()
    })
  })

  describe('clearAction', () => {
    it('removes all stored credentials', async () => {
      const manager = new SlackBotCredentialManager(tempDir)
      await manager.setCredentials({
        token: 'xoxb-token',
        workspace_id: 'T123',
        workspace_name: 'Test',
        bot_id: 'mybot',
        bot_name: 'My Bot',
      })

      const result = await clearAction({ _credManager: manager })

      expect(result.success).toBe(true)
      expect(await manager.getCredentials()).toBeNull()
    })
  })

  describe('statusAction', () => {
    it('returns no credentials when none set', async () => {
      const manager = new SlackBotCredentialManager(tempDir)

      const result = await statusAction({ _credManager: manager })

      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('returns valid status for current bot', async () => {
      const manager = new SlackBotCredentialManager(tempDir)
      await manager.setCredentials({
        token: 'xoxb-token',
        workspace_id: 'T456',
        workspace_name: 'Test Workspace',
        bot_id: 'mybot',
        bot_name: 'My Bot',
      })

      const result = await statusAction({ _credManager: manager })

      expect(result.valid).toBe(true)
      expect(result.workspace_id).toBe('T456')
      expect(result.bot_id).toBe('mybot')
    })

    it('returns status for specific --bot', async () => {
      const manager = new SlackBotCredentialManager(tempDir)
      await manager.setCredentials({
        token: 'xoxb-token',
        workspace_id: 'T456',
        workspace_name: 'Test',
        bot_id: 'deploy',
        bot_name: 'Deploy',
      })
      await manager.setCredentials({
        token: 'xoxb-token2',
        workspace_id: 'T456',
        workspace_name: 'Test',
        bot_id: 'alert',
        bot_name: 'Alert',
      })

      const result = await statusAction({ bot: 'deploy', _credManager: manager })

      expect(result.valid).toBe(true)
      expect(result.bot_id).toBe('deploy')
    })
  })

  describe('listAction', () => {
    it('returns all stored bots', async () => {
      const manager = new SlackBotCredentialManager(tempDir)
      await manager.setCredentials({
        token: 'xoxb-a',
        workspace_id: 'T123',
        workspace_name: 'WS A',
        bot_id: 'deploy',
        bot_name: 'Deploy',
      })
      await manager.setCredentials({
        token: 'xoxb-b',
        workspace_id: 'T123',
        workspace_name: 'WS A',
        bot_id: 'alert',
        bot_name: 'Alert',
      })

      const result = await listAction({ _credManager: manager })

      expect(result.bots).toHaveLength(2)
      expect(result.bots?.find((b) => b.bot_id === 'alert')?.is_current).toBe(true)
    })
  })

  describe('useAction', () => {
    it('switches current bot', async () => {
      const manager = new SlackBotCredentialManager(tempDir)
      await manager.setCredentials({
        token: 'xoxb-a',
        workspace_id: 'T123',
        workspace_name: 'WS',
        bot_id: 'deploy',
        bot_name: 'Deploy',
      })
      await manager.setCredentials({
        token: 'xoxb-b',
        workspace_id: 'T123',
        workspace_name: 'WS',
        bot_id: 'alert',
        bot_name: 'Alert',
      })

      const result = await useAction('deploy', { _credManager: manager })

      expect(result.success).toBe(true)
      expect(result.bot_id).toBe('deploy')
    })

    it('returns error for unknown bot', async () => {
      const manager = new SlackBotCredentialManager(tempDir)

      const result = await useAction('nonexistent', { _credManager: manager })

      expect(result.error).toBeDefined()
    })
  })

  describe('removeAction', () => {
    it('removes a stored bot', async () => {
      const manager = new SlackBotCredentialManager(tempDir)
      await manager.setCredentials({
        token: 'xoxb-a',
        workspace_id: 'T123',
        workspace_name: 'WS',
        bot_id: 'deploy',
        bot_name: 'Deploy',
      })

      const result = await removeAction('deploy', { _credManager: manager })

      expect(result.success).toBe(true)
      expect(await manager.getCredentials('deploy')).toBeNull()
    })

    it('returns error for unknown bot', async () => {
      const manager = new SlackBotCredentialManager(tempDir)

      const result = await removeAction('nonexistent', { _credManager: manager })

      expect(result.error).toBeDefined()
    })
  })
})
