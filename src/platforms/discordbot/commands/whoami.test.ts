import { afterEach, beforeEach, describe, expect, mock, it } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const mockTestAuth = mock(() =>
  Promise.resolve({
    id: 'bot-user-id',
    username: 'testbot',
    global_name: 'Test Bot',
    avatar: 'avatar123',
    bot: true,
  }),
)

mock.module('../client', () => ({
  DiscordBotClient: class MockDiscordBotClient {
    async login(_credentials?: any) {
      return this
    }
    testAuth = mockTestAuth
  },
}))

import { DiscordBotCredentialManager } from '../credential-manager'
import { whoamiAction } from './whoami'

describe('whoami command', () => {
  let tempDir: string
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(async () => {
    tempDir = join(tmpdir(), `discordbot-whoami-test-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })
    originalEnv = { ...process.env }
    delete process.env.E2E_DISCORDBOT_TOKEN
    mockTestAuth.mockClear()
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true })
    }
    process.env = originalEnv
  })

  it('returns auth info for current bot', async () => {
    const manager = new DiscordBotCredentialManager(tempDir)
    await manager.setCredentials({
      token: 'bot-token-123',
      bot_id: 'bot1',
      bot_name: 'Test Bot',
    })

    const result = await whoamiAction({ _credManager: manager })

    expect(result.id).toBe('bot-user-id')
    expect(result.username).toBe('testbot')
    expect(result.global_name).toBe('Test Bot')
    expect(result.avatar).toBe('avatar123')
    expect(result.bot).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('returns auth info for specific --bot', async () => {
    const manager = new DiscordBotCredentialManager(tempDir)
    await manager.setCredentials({
      token: 'bot-token-123',
      bot_id: 'deploy',
      bot_name: 'Deploy Bot',
    })

    const result = await whoamiAction({ bot: 'deploy', _credManager: manager })

    expect(result.id).toBe('bot-user-id')
    expect(result.username).toBe('testbot')
    expect(mockTestAuth).toHaveBeenCalledTimes(1)
  })

  it('returns error when client throws', async () => {
    mockTestAuth.mockImplementationOnce(() => Promise.reject(new Error('API Error')))

    const manager = new DiscordBotCredentialManager(tempDir)
    await manager.setCredentials({
      token: 'bot-token-123',
      bot_id: 'bot1',
      bot_name: 'Test Bot',
    })

    const result = await whoamiAction({ _credManager: manager })

    expect(result.error).toBeDefined()
    expect(result.error).toContain('API Error')
  })
})
