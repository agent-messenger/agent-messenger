import { afterAll, describe, expect, test } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'

import { WeChatCredentialManager } from '@/platforms/wechat/credential-manager'

const testDirs: string[] = []

function setup(): WeChatCredentialManager {
  const testConfigDir = join(
    import.meta.dir,
    `.test-wechat-config-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )
  testDirs.push(testConfigDir)
  return new WeChatCredentialManager(testConfigDir)
}

afterAll(() => {
  for (const dir of testDirs) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('WeChatCredentialManager', () => {
  test('loadConfig returns default config when file does not exist', async () => {
    const manager = setup()
    const config = await manager.loadConfig()

    expect(config).toEqual({
      current: null,
      accounts: {},
    })
  })

  test('saveConfig creates file with correct content', async () => {
    const testConfigDir = join(
      import.meta.dir,
      `.test-wechat-config-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    )
    testDirs.push(testConfigDir)
    const manager = new WeChatCredentialManager(testConfigDir)
    const config = {
      current: 'wxid-123',
      accounts: {
        'wxid-123': {
          account_id: 'wxid-123',
          name: 'Test User',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
        },
      },
    }

    await manager.saveConfig(config)

    const credentialsPath = join(testConfigDir, 'wechat-credentials.json')
    expect(existsSync(credentialsPath)).toBe(true)

    const file = Bun.file(credentialsPath)
    const content = await file.text()
    const loaded = JSON.parse(content)
    expect(loaded).toEqual(config)
  })

  test('getAccount returns null when not configured', async () => {
    const manager = setup()
    const account = await manager.getAccount()
    expect(account).toBeNull()
  })

  test('getAccount returns account from env vars when E2E env vars are set', async () => {
    const originalWxid = process.env.E2E_WECHAT_WXID
    process.env.E2E_WECHAT_WXID = 'wxid_test123'

    try {
      const manager = setup()
      const account = await manager.getAccount()
      expect(account).not.toBeNull()
      expect(account?.account_id).toBe('wxid_test123')
    } finally {
      if (originalWxid === undefined) {
        delete process.env.E2E_WECHAT_WXID
      } else {
        process.env.E2E_WECHAT_WXID = originalWxid
      }
    }
  })

  test('getAccount ignores env vars when accountId is provided', async () => {
    const originalWxid = process.env.E2E_WECHAT_WXID
    process.env.E2E_WECHAT_WXID = 'wxid_test123'

    try {
      const manager = setup()
      const account = await manager.getAccount('nonexistent-id')
      expect(account).toBeNull()
    } finally {
      if (originalWxid === undefined) {
        delete process.env.E2E_WECHAT_WXID
      } else {
        process.env.E2E_WECHAT_WXID = originalWxid
      }
    }
  })

  test('setAccount saves and sets as current if no current', async () => {
    const manager = setup()
    const now = new Date().toISOString()
    await manager.setAccount({
      account_id: 'wxid-123',
      name: 'Test User',
      created_at: now,
      updated_at: now,
    })

    const account = await manager.getAccount()
    expect(account).not.toBeNull()
    expect(account?.account_id).toBe('wxid-123')
    expect(account?.name).toBe('Test User')

    const config = await manager.loadConfig()
    expect(config.current).toBe('wxid-123')
  })

  test('setAccount does not change current if already set', async () => {
    const manager = setup()
    const now = new Date().toISOString()
    await manager.setAccount({ account_id: 'wxid-a', name: 'User A', created_at: now, updated_at: now })
    await manager.setAccount({ account_id: 'wxid-b', name: 'User B', created_at: now, updated_at: now })

    const config = await manager.loadConfig()
    expect(config.current).toBe('wxid-a')
  })

  test('setCurrent switches active account', async () => {
    const manager = setup()
    const now = new Date().toISOString()
    await manager.setAccount({ account_id: 'wxid-a', name: 'User A', created_at: now, updated_at: now })
    await manager.setAccount({ account_id: 'wxid-b', name: 'User B', created_at: now, updated_at: now })

    const result = await manager.setCurrent('wxid-b')
    expect(result).toBe(true)

    const config = await manager.loadConfig()
    expect(config.current).toBe('wxid-b')
  })

  test('setCurrent returns false for non-existent account', async () => {
    const manager = setup()
    const result = await manager.setCurrent('nonexistent')
    expect(result).toBe(false)
  })

  test('listAccounts returns all accounts with is_current flag', async () => {
    const manager = setup()
    const now = new Date().toISOString()
    await manager.setAccount({ account_id: 'wxid-a', name: 'User A', created_at: now, updated_at: now })
    await manager.setAccount({ account_id: 'wxid-b', name: 'User B', created_at: now, updated_at: now })

    const accounts = await manager.listAccounts()
    expect(accounts).toHaveLength(2)

    const acctA = accounts.find((a) => a.account_id === 'wxid-a')
    const acctB = accounts.find((a) => a.account_id === 'wxid-b')

    expect(acctA?.is_current).toBe(true)
    expect(acctB?.is_current).toBe(false)
  })

  test('listAccounts returns empty array when no accounts', async () => {
    const manager = setup()
    const accounts = await manager.listAccounts()
    expect(accounts).toHaveLength(0)
  })

  test('removeAccount removes and adjusts current', async () => {
    const manager = setup()
    const now = new Date().toISOString()
    await manager.setAccount({ account_id: 'wxid-123', name: 'Test User', created_at: now, updated_at: now })

    const removed = await manager.removeAccount('wxid-123')
    expect(removed).toBe(true)

    const account = await manager.getAccount()
    expect(account).toBeNull()

    const config = await manager.loadConfig()
    expect(config.current).toBeNull()
    expect(config.accounts['wxid-123']).toBeUndefined()
  })

  test('removeAccount returns false for non-existent account', async () => {
    const manager = setup()
    const removed = await manager.removeAccount('nonexistent')
    expect(removed).toBe(false)
  })

  test('clearCredentials removes credentials file', async () => {
    const manager = setup()
    const now = new Date().toISOString()
    await manager.setAccount({ account_id: 'wxid-123', name: 'Test User', created_at: now, updated_at: now })

    await manager.clearCredentials()

    const config = await manager.loadConfig()
    expect(config.current).toBeNull()
    expect(config.accounts).toEqual({})
  })

  test('getAccountPaths returns correct paths', () => {
    const manager = setup()
    const paths = manager.getAccountPaths('wxid-123')
    expect(paths.account_dir).toContain('wxid-123')
  })

  test('round-trip: set → get → remove → get null', async () => {
    const manager = setup()
    const now = new Date().toISOString()

    await manager.setAccount({ account_id: 'wxid-123', name: 'Test User', created_at: now, updated_at: now })

    const account = await manager.getAccount()
    expect(account?.account_id).toBe('wxid-123')
    expect(account?.name).toBe('Test User')

    await manager.removeAccount('wxid-123')

    const afterRemove = await manager.getAccount()
    expect(afterRemove).toBeNull()
  })
})
