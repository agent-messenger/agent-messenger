import { afterEach, beforeEach, describe, expect, test, mock } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Mock the client module
const mockTestAuth = mock(() => 
  Promise.resolve({ 
    ok: true, 
    user_id: 'U123', 
    team_id: 'T456', 
    bot_id: 'B789', 
    user: 'testbot', 
    team: 'Test Team' 
  })
)

mock.module('../client', () => ({
  SlackBotClient: class MockSlackBotClient {
    constructor(token: string) {
      if (!token.startsWith('xoxb-')) {
        throw new Error('Token must be a bot token (xoxb-)')
      }
    }
    testAuth = mockTestAuth
  },
}))

// Now import the functions we'll test
import { setAction, clearAction, statusAction } from './auth'
import { SlackBotCredentialManager } from '../credential-manager'

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
    test('validates and stores bot token', async () => {
      // given
      const manager = new SlackBotCredentialManager(tempDir)
      
      // when
      const result = await setAction('xoxb-test-token', { _credManager: manager })

      // then
      expect(result.success).toBe(true)
      expect(result.workspace_id).toBe('T456')
      expect(result.workspace_name).toBe('Test Team')
      
      const creds = await manager.getCredentials()
      expect(creds?.token).toBe('xoxb-test-token')
    })

    test('rejects user tokens', async () => {
      // given
      const manager = new SlackBotCredentialManager(tempDir)
      
      // when
      const result = await setAction('xoxp-user-token', { _credManager: manager })

      // then
      expect(result.error).toBeDefined()
      expect(result.error).toContain('bot token')
    })

    test('rejects invalid token format', async () => {
      // given
      const manager = new SlackBotCredentialManager(tempDir)
      
      // when
      const result = await setAction('invalid-token', { _credManager: manager })

      // then
      expect(result.error).toBeDefined()
    })
  })

  describe('clearAction', () => {
    test('removes stored credentials', async () => {
      // given
      const manager = new SlackBotCredentialManager(tempDir)
      await manager.setCredentials({
        token: 'xoxb-token',
        workspace_id: 'T123',
        workspace_name: 'Test',
      })
      
      // when
      const result = await clearAction({ _credManager: manager })

      // then
      expect(result.success).toBe(true)
      const creds = await manager.getCredentials()
      expect(creds).toBeNull()
    })
  })

  describe('statusAction', () => {
    test('returns no credentials when none set', async () => {
      // given
      const manager = new SlackBotCredentialManager(tempDir)
      
      // when
      const result = await statusAction({ _credManager: manager })

      // then
      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    test('returns valid status when credentials exist', async () => {
      // given
      const manager = new SlackBotCredentialManager(tempDir)
      await manager.setCredentials({
        token: 'xoxb-token',
        workspace_id: 'T456',
        workspace_name: 'Test Workspace',
      })
      
      // when
      const result = await statusAction({ _credManager: manager })

      // then
      expect(result.valid).toBe(true)
      expect(result.workspace_id).toBe('T456')
      expect(result.workspace_name).toBe('Test Workspace')
    })
  })
})
