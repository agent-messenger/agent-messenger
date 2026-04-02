import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const mockVerifyCredentials = mock(() => Promise.resolve(true))

mock.module('../client', () => ({
  WeChatBotClient: class MockWeChatBotClient {
    async login(_credentials?: { appId: string; appSecret: string }) {
      return this
    }
    verifyCredentials = mockVerifyCredentials
  },
}))

import { WeChatBotCredentialManager } from '../credential-manager'
import { whoamiAction } from './whoami'

describe('whoami command', () => {
  let tempDir: string
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(async () => {
    tempDir = join(tmpdir(), `wechatbot-whoami-test-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })
    originalEnv = { ...process.env }
    delete process.env.E2E_WECHATBOT_APP_ID
    delete process.env.E2E_WECHATBOT_APP_SECRET
    mockVerifyCredentials.mockClear()
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true })
    }
    process.env = originalEnv
  })

  test('returns app_id, account_name, and verified status', async () => {
    const manager = new WeChatBotCredentialManager(tempDir)
    await manager.setCredentials({
      app_id: 'wx1234567890',
      app_secret: 'secret123',
      account_name: 'Test Official Account',
    })

    const result = await whoamiAction({ _credManager: manager })

    expect(result.app_id).toBe('wx1234567890')
    expect(result.account_name).toBe('Test Official Account')
    expect(result.verified).toBe(true)
    expect(result.error).toBeUndefined()
  })

  test('returns info for specific --account', async () => {
    const manager = new WeChatBotCredentialManager(tempDir)
    await manager.setCredentials({
      app_id: 'wxAAA',
      app_secret: 'secretA',
      account_name: 'Account A',
    })
    await manager.setCredentials({
      app_id: 'wxBBB',
      app_secret: 'secretB',
      account_name: 'Account B',
    })

    const result = await whoamiAction({ account: 'wxAAA', _credManager: manager })

    expect(result.app_id).toBe('wxAAA')
    expect(result.account_name).toBe('Account A')
    expect(result.verified).toBe(true)
  })

  test('returns verified false when credentials are invalid', async () => {
    mockVerifyCredentials.mockImplementationOnce(() => Promise.resolve(false))

    const manager = new WeChatBotCredentialManager(tempDir)
    await manager.setCredentials({
      app_id: 'wx1234567890',
      app_secret: 'bad-secret',
      account_name: 'Test Account',
    })

    const result = await whoamiAction({ _credManager: manager })

    expect(result.app_id).toBe('wx1234567890')
    expect(result.verified).toBe(false)
    expect(result.error).toBeUndefined()
  })

  test('returns error when client throws', async () => {
    mockVerifyCredentials.mockImplementationOnce(() => Promise.reject(new Error('Network error')))

    const manager = new WeChatBotCredentialManager(tempDir)
    await manager.setCredentials({
      app_id: 'wx1234567890',
      app_secret: 'secret123',
      account_name: 'Test Account',
    })

    const result = await whoamiAction({ _credManager: manager })

    expect(result.error).toBeDefined()
    expect(result.error).toContain('Network error')
  })
})
