import { afterAll, describe, expect, test } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'

import { WeChatBotCredentialManager } from '@/platforms/wechatbot/credential-manager'

const testDirs: string[] = []

function setup(): WeChatBotCredentialManager {
  const testConfigDir = join(
    import.meta.dir,
    `.test-wechatbot-config-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )
  testDirs.push(testConfigDir)
  return new WeChatBotCredentialManager(testConfigDir)
}

afterAll(() => {
  for (const dir of testDirs) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('WeChatBotCredentialManager', () => {
  test('load returns default config when file does not exist', async () => {
    const manager = setup()
    const config = await manager.load()

    expect(config).toEqual({
      current: null,
      accounts: {},
    })
  })

  test('save creates file with correct content', async () => {
    const testConfigDir = join(
      import.meta.dir,
      `.test-wechatbot-config-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    )
    testDirs.push(testConfigDir)
    const manager = new WeChatBotCredentialManager(testConfigDir)
    const config = {
      current: { account_id: 'wx123' },
      accounts: {
        wx123: {
          app_id: 'wx123',
          app_secret: 'secret123',
          account_name: 'Test Account',
        },
      },
    }

    await manager.save(config)

    const credentialsPath = join(testConfigDir, 'wechatbot-credentials.json')
    expect(existsSync(credentialsPath)).toBe(true)

    const file = Bun.file(credentialsPath)
    const content = await file.text()
    const loaded = JSON.parse(content)
    expect(loaded).toEqual(config)
  })

  test('getCredentials returns null when not configured', async () => {
    const manager = setup()
    const creds = await manager.getCredentials()
    expect(creds).toBeNull()
  })

  test('getCredentials returns credentials from env vars when E2E env vars are set', async () => {
    const originalAppId = process.env.E2E_WECHATBOT_APP_ID
    const originalAppSecret = process.env.E2E_WECHATBOT_APP_SECRET

    process.env.E2E_WECHATBOT_APP_ID = 'env-app-id'
    process.env.E2E_WECHATBOT_APP_SECRET = 'env-app-secret'

    try {
      const manager = setup()
      const creds = await manager.getCredentials()
      expect(creds).toEqual({
        app_id: 'env-app-id',
        app_secret: 'env-app-secret',
        account_name: 'env',
      })
    } finally {
      if (originalAppId === undefined) {
        delete process.env.E2E_WECHATBOT_APP_ID
      } else {
        process.env.E2E_WECHATBOT_APP_ID = originalAppId
      }
      if (originalAppSecret === undefined) {
        delete process.env.E2E_WECHATBOT_APP_SECRET
      } else {
        process.env.E2E_WECHATBOT_APP_SECRET = originalAppSecret
      }
    }
  })

  test('getCredentials ignores env vars when accountId is provided', async () => {
    const originalAppId = process.env.E2E_WECHATBOT_APP_ID
    const originalAppSecret = process.env.E2E_WECHATBOT_APP_SECRET

    process.env.E2E_WECHATBOT_APP_ID = 'env-app-id'
    process.env.E2E_WECHATBOT_APP_SECRET = 'env-app-secret'

    try {
      const manager = setup()
      const creds = await manager.getCredentials('nonexistent-id')
      expect(creds).toBeNull()
    } finally {
      if (originalAppId === undefined) {
        delete process.env.E2E_WECHATBOT_APP_ID
      } else {
        process.env.E2E_WECHATBOT_APP_ID = originalAppId
      }
      if (originalAppSecret === undefined) {
        delete process.env.E2E_WECHATBOT_APP_SECRET
      } else {
        process.env.E2E_WECHATBOT_APP_SECRET = originalAppSecret
      }
    }
  })

  test('getCredentials returns specific account by accountId', async () => {
    const manager = setup()
    await manager.setCredentials({ app_id: 'wx-a', app_secret: 'secret-a', account_name: 'Account A' })
    await manager.setCredentials({ app_id: 'wx-b', app_secret: 'secret-b', account_name: 'Account B' })

    const creds = await manager.getCredentials('wx-a')
    expect(creds).toEqual({
      app_id: 'wx-a',
      app_secret: 'secret-a',
      account_name: 'Account A',
    })
  })

  test('getCredentials returns null for nonexistent accountId', async () => {
    const manager = setup()
    const creds = await manager.getCredentials('nonexistent')
    expect(creds).toBeNull()
  })

  test('setCredentials saves and sets as current', async () => {
    const manager = setup()
    await manager.setCredentials({ app_id: 'wx123', app_secret: 'secret123', account_name: 'My Account' })

    const creds = await manager.getCredentials()
    expect(creds).toEqual({
      app_id: 'wx123',
      app_secret: 'secret123',
      account_name: 'My Account',
    })

    const config = await manager.load()
    expect(config.current).toEqual({ account_id: 'wx123' })
  })

  test('removeAccount deletes account and adjusts current', async () => {
    const manager = setup()
    await manager.setCredentials({ app_id: 'wx123', app_secret: 'secret123', account_name: 'My Account' })

    const removed = await manager.removeAccount('wx123')
    expect(removed).toBe(true)

    const creds = await manager.getCredentials()
    expect(creds).toBeNull()

    const config = await manager.load()
    expect(config.current).toBeNull()
    expect(config.accounts['wx123']).toBeUndefined()
  })

  test('removeAccount returns false for non-existent account', async () => {
    const manager = setup()
    const removed = await manager.removeAccount('nonexistent')
    expect(removed).toBe(false)
  })

  test('removeAccount does not clear current when a different account is removed', async () => {
    const manager = setup()
    await manager.setCredentials({ app_id: 'wx-a', app_secret: 'secret-a', account_name: 'Account A' })
    await manager.setCredentials({ app_id: 'wx-b', app_secret: 'secret-b', account_name: 'Account B' })

    const removed = await manager.removeAccount('wx-a')
    expect(removed).toBe(true)

    const config = await manager.load()
    expect(config.current).toEqual({ account_id: 'wx-b' })
  })

  test('setCurrent switches active account', async () => {
    const manager = setup()
    await manager.setCredentials({ app_id: 'wx-a', app_secret: 'secret-a', account_name: 'Account A' })
    await manager.setCredentials({ app_id: 'wx-b', app_secret: 'secret-b', account_name: 'Account B' })

    const result = await manager.setCurrent('wx-a')
    expect(result).toBe(true)

    const config = await manager.load()
    expect(config.current).toEqual({ account_id: 'wx-a' })
  })

  test('setCurrent returns false for non-existent account', async () => {
    const manager = setup()
    const result = await manager.setCurrent('nonexistent')
    expect(result).toBe(false)
  })

  test('listAll returns all accounts with is_current flag', async () => {
    const manager = setup()
    await manager.setCredentials({ app_id: 'wx-a', app_secret: 'secret-a', account_name: 'Account A' })
    await manager.setCredentials({ app_id: 'wx-b', app_secret: 'secret-b', account_name: 'Account B' })

    const accounts = await manager.listAll()
    expect(accounts).toHaveLength(2)

    const acctA = accounts.find((a) => a.app_id === 'wx-a')
    const acctB = accounts.find((a) => a.app_id === 'wx-b')

    expect(acctA?.is_current).toBe(false)
    expect(acctB?.is_current).toBe(true)
  })

  test('listAll returns empty array when no accounts', async () => {
    const manager = setup()
    const accounts = await manager.listAll()
    expect(accounts).toHaveLength(0)
  })

  test('clearCredentials resets everything', async () => {
    const manager = setup()
    await manager.setCredentials({ app_id: 'wx123', app_secret: 'secret123', account_name: 'My Account' })

    await manager.clearCredentials()

    const config = await manager.load()
    expect(config.current).toBeNull()
    expect(config.accounts).toEqual({})
  })

  test('round-trip: set → get → remove → get null', async () => {
    const manager = setup()

    await manager.setCredentials({ app_id: 'wx123', app_secret: 'secret123', account_name: 'My Account' })

    const creds = await manager.getCredentials()
    expect(creds?.app_id).toBe('wx123')
    expect(creds?.app_secret).toBe('secret123')

    await manager.removeAccount('wx123')

    const afterRemove = await manager.getCredentials()
    expect(afterRemove).toBeNull()
  })
})
