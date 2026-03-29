import { afterAll, describe, expect, test } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'

import { InstagramCredentialManager } from '@/platforms/instagram/credential-manager'
import type { InstagramAccount } from '@/platforms/instagram/types'

const testDirs: string[] = []

function setup(): InstagramCredentialManager {
  const testConfigDir = join(
    import.meta.dir,
    `.test-instagram-config-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )
  testDirs.push(testConfigDir)
  return new InstagramCredentialManager(testConfigDir)
}

function makeAccount(overrides?: Partial<InstagramAccount>): InstagramAccount {
  return {
    account_id: 'test-account',
    username: 'testuser',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

afterAll(() => {
  for (const dir of testDirs) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('InstagramCredentialManager', () => {
  describe('loadConfig', () => {
    test('returns default config when file does not exist', async () => {
      const manager = setup()
      const config = await manager.loadConfig()

      expect(config).toEqual({ current: null, accounts: {} })
    })
  })

  describe('saveConfig', () => {
    test('creates file and can be re-read via loadConfig', async () => {
      const manager = setup()
      const config = {
        current: 'test-account',
        accounts: {
          'test-account': makeAccount(),
        },
      }

      await manager.saveConfig(config)
      const loaded = await manager.loadConfig()

      expect(loaded).toEqual(config)
    })
  })

  describe('getAccount', () => {
    test('returns null when no accounts exist', async () => {
      const manager = setup()
      const account = await manager.getAccount()

      expect(account).toBeNull()
    })

    test('returns null for specific accountId when no accounts exist', async () => {
      const manager = setup()
      const account = await manager.getAccount('nonexistent')

      expect(account).toBeNull()
    })
  })

  describe('setAccount', () => {
    test('round-trips: set then get returns same account', async () => {
      const manager = setup()
      const account = makeAccount()

      await manager.setAccount(account)
      const retrieved = await manager.getAccount('test-account')

      expect(retrieved).toEqual(account)
    })

    test('sets first account as current automatically', async () => {
      const manager = setup()
      const account = makeAccount()

      await manager.setAccount(account)
      const current = await manager.getAccount()

      expect(current).toEqual(account)
    })

    test('does not override current when it is already set', async () => {
      const manager = setup()
      const first = makeAccount({ account_id: 'first-account' })
      const second = makeAccount({ account_id: 'second-account' })

      await manager.setAccount(first)
      await manager.setAccount(second)

      const current = await manager.getAccount()
      expect(current?.account_id).toBe('first-account')
    })

    test('getAccount with normalized ID lookup via createAccountId', async () => {
      const manager = setup()
      const account = makeAccount({ account_id: 'my-username' })

      await manager.setAccount(account)
      const retrieved = await manager.getAccount('My Username')

      expect(retrieved).toEqual(account)
    })
  })

  describe('listAccounts', () => {
    test('returns empty array when no accounts', async () => {
      const manager = setup()
      const accounts = await manager.listAccounts()

      expect(accounts).toEqual([])
    })

    test('returns all accounts with is_current flag', async () => {
      const manager = setup()
      const first = makeAccount({ account_id: 'first-account' })
      const second = makeAccount({ account_id: 'second-account' })

      await manager.setAccount(first)
      await manager.setAccount(second)

      const accounts = await manager.listAccounts()

      expect(accounts).toHaveLength(2)
      const firstResult = accounts.find((a) => a.account_id === 'first-account')
      const secondResult = accounts.find((a) => a.account_id === 'second-account')
      expect(firstResult?.is_current).toBe(true)
      expect(secondResult?.is_current).toBe(false)
    })
  })

  describe('setCurrent', () => {
    test('switches active account and returns true', async () => {
      const manager = setup()
      const first = makeAccount({ account_id: 'first-account' })
      const second = makeAccount({ account_id: 'second-account' })

      await manager.setAccount(first)
      await manager.setAccount(second)

      const result = await manager.setCurrent('second-account')
      expect(result).toBe(true)

      const current = await manager.getAccount()
      expect(current?.account_id).toBe('second-account')
    })

    test('returns false for non-existent account', async () => {
      const manager = setup()

      const result = await manager.setCurrent('nonexistent')

      expect(result).toBe(false)
    })
  })

  describe('removeAccount', () => {
    test('removes account and adjusts current to next available', async () => {
      const manager = setup()
      const first = makeAccount({ account_id: 'first-account' })
      const second = makeAccount({ account_id: 'second-account' })

      await manager.setAccount(first)
      await manager.setAccount(second)

      const result = await manager.removeAccount('first-account')
      expect(result).toBe(true)

      const accounts = await manager.listAccounts()
      expect(accounts).toHaveLength(1)
      expect(accounts[0]?.account_id).toBe('second-account')

      const current = await manager.getAccount()
      expect(current?.account_id).toBe('second-account')
    })

    test('returns false for non-existent account', async () => {
      const manager = setup()

      const result = await manager.removeAccount('nonexistent')

      expect(result).toBe(false)
    })
  })

  describe('clearCredentials', () => {
    test('removes credentials file when it exists', async () => {
      const manager = setup()
      const account = makeAccount()
      await manager.setAccount(account)

      const testConfigDir = testDirs[testDirs.length - 1]!
      const credentialsPath = join(testConfigDir, 'instagram-credentials.json')
      expect(existsSync(credentialsPath)).toBe(true)

      await manager.clearCredentials()

      expect(existsSync(credentialsPath)).toBe(false)
    })

    test('does not throw when credentials file does not exist', async () => {
      const manager = setup()

      await expect(manager.clearCredentials()).resolves.toBeUndefined()
    })
  })

  describe('getAccountPaths', () => {
    test('returns correct paths structure for account ID', async () => {
      const testConfigDir = join(
        import.meta.dir,
        `.test-instagram-config-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      )
      testDirs.push(testConfigDir)
      const manager = new InstagramCredentialManager(testConfigDir)

      const paths = manager.getAccountPaths('test-account')

      expect(paths.account_dir).toBe(join(testConfigDir, 'instagram', 'test-account'))
      expect(paths.session_path).toBe(join(testConfigDir, 'instagram', 'test-account', 'session.json'))
    })

    test('normalizes account ID via createAccountId', async () => {
      const testConfigDir = join(
        import.meta.dir,
        `.test-instagram-config-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      )
      testDirs.push(testConfigDir)
      const manager = new InstagramCredentialManager(testConfigDir)

      const paths = manager.getAccountPaths('My Username')

      expect(paths.account_dir).toContain('my-username')
      expect(paths.session_path).toContain('my-username')
    })
  })

  describe('ensureAccountPaths', () => {
    test('creates directories', async () => {
      const manager = setup()

      const paths = await manager.ensureAccountPaths('test-account')

      expect(existsSync(paths.account_dir)).toBe(true)
    })

    test('returns paths structure', async () => {
      const testConfigDir = join(
        import.meta.dir,
        `.test-instagram-config-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      )
      testDirs.push(testConfigDir)
      const manager = new InstagramCredentialManager(testConfigDir)

      const paths = await manager.ensureAccountPaths('my-account')

      expect(paths.account_dir).toBe(join(testConfigDir, 'instagram', 'my-account'))
      expect(paths.session_path).toBe(join(testConfigDir, 'instagram', 'my-account', 'session.json'))
    })
  })
})
