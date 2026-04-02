import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const mockTestAuth = mock(() =>
  Promise.resolve({
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
import { whoamiAction } from './whoami'

describe('whoami command', () => {
  let tempDir: string
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(async () => {
    tempDir = join(tmpdir(), `slackbot-whoami-test-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })
    originalEnv = { ...process.env }
    delete process.env.E2E_SLACKBOT_TOKEN
    mockTestAuth.mockClear()
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true })
    }
    process.env = originalEnv
  })

  test('returns auth info for current bot', async () => {
    const manager = new SlackBotCredentialManager(tempDir)
    await manager.setCredentials({
      token: 'xoxb-test-token',
      workspace_id: 'T456',
      workspace_name: 'Test Workspace',
      bot_id: 'B789',
      bot_name: 'Test Bot',
    })

    const result = await whoamiAction({ _credManager: manager })

    expect(result.user_id).toBe('U123')
    expect(result.team_id).toBe('T456')
    expect(result.bot_id).toBe('B789')
    expect(result.user).toBe('testbot')
    expect(result.team).toBe('Test Team')
    expect(result.error).toBeUndefined()
  })

  test('returns auth info for specific --bot', async () => {
    const manager = new SlackBotCredentialManager(tempDir)
    await manager.setCredentials({
      token: 'xoxb-test-token',
      workspace_id: 'T456',
      workspace_name: 'Test Workspace',
      bot_id: 'deploy',
      bot_name: 'Deploy Bot',
    })

    const result = await whoamiAction({ bot: 'deploy', _credManager: manager })

    expect(result.user_id).toBe('U123')
    expect(result.team_id).toBe('T456')
    expect(mockTestAuth).toHaveBeenCalledTimes(1)
  })

  test('returns error when client throws', async () => {
    mockTestAuth.mockImplementationOnce(() => Promise.reject(new Error('API Error')))

    const manager = new SlackBotCredentialManager(tempDir)
    await manager.setCredentials({
      token: 'xoxb-test-token',
      workspace_id: 'T456',
      workspace_name: 'Test Workspace',
      bot_id: 'B789',
      bot_name: 'Test Bot',
    })

    const result = await whoamiAction({ _credManager: manager })

    expect(result.error).toBeDefined()
    expect(result.error).toContain('API Error')
  })
})
