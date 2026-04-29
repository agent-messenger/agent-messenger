import { afterEach, beforeEach, describe, expect, mock, it } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const mockGetChannel = mock(() =>
  Promise.resolve({
    id: 'channel-id-123',
    name: 'Test Channel',
    homepageUrl: 'https://test.channel.io',
    description: 'Test channel description',
  }),
)

mock.module('../client', () => ({
  ChannelBotClient: class MockChannelBotClient {
    async login(_credentials?: { accessKey: string; accessSecret: string }) {
      return this
    }
    getChannel = mockGetChannel
  },
}))

import { ChannelBotCredentialManager } from '../credential-manager'
import { whoamiAction } from './whoami'

describe('whoami command', () => {
  let tempDir: string
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(async () => {
    tempDir = join(tmpdir(), `channeltalkbot-whoami-test-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })
    originalEnv = { ...process.env }
    delete process.env.E2E_CHANNELBOT_ACCESS_KEY
    delete process.env.E2E_CHANNELBOT_ACCESS_SECRET
    delete process.env.E2E_CHANNELTALKBOT_ACCESS_KEY
    delete process.env.E2E_CHANNELTALKBOT_ACCESS_SECRET
    mockGetChannel.mockClear()
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true })
    }
    process.env = originalEnv
  })

  it('returns channel info for current workspace', async () => {
    const manager = new ChannelBotCredentialManager(tempDir)
    await manager.setCredentials({
      workspace_id: 'workspace1',
      workspace_name: 'Test Workspace',
      access_key: 'key123',
      access_secret: 'secret123',
    })

    const result = await whoamiAction({ _credManager: manager })

    expect(result.id).toBe('channel-id-123')
    expect(result.name).toBe('Test Channel')
    expect(result.homepage_url).toBe('https://test.channel.io')
    expect(result.description).toBe('Test channel description')
    expect(result.error).toBeUndefined()
  })

  it('returns channel info for specific --workspace', async () => {
    const manager = new ChannelBotCredentialManager(tempDir)
    await manager.setCredentials({
      workspace_id: 'workspace1',
      workspace_name: 'Workspace 1',
      access_key: 'key1',
      access_secret: 'secret1',
    })
    await manager.setCredentials({
      workspace_id: 'workspace2',
      workspace_name: 'Workspace 2',
      access_key: 'key2',
      access_secret: 'secret2',
    })

    const result = await whoamiAction({ workspace: 'workspace1', _credManager: manager })

    expect(result.id).toBe('channel-id-123')
    expect(result.name).toBe('Test Channel')
    expect(mockGetChannel).toHaveBeenCalledTimes(1)
  })

  it('returns error when client throws', async () => {
    mockGetChannel.mockImplementationOnce(() => Promise.reject(new Error('API Error')))

    const manager = new ChannelBotCredentialManager(tempDir)
    await manager.setCredentials({
      workspace_id: 'workspace1',
      workspace_name: 'Test Workspace',
      access_key: 'key123',
      access_secret: 'secret123',
    })

    const result = await whoamiAction({ _credManager: manager })

    expect(result.error).toBeDefined()
    expect(result.error).toContain('API Error')
  })
})
