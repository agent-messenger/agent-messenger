import { afterAll, describe, expect, it } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'

import { WhatsAppCredentialManager } from '@/platforms/whatsapp/credential-manager'
import type { WhatsAppAccount } from '@/platforms/whatsapp/types'

const testDirs: string[] = []

function setup(): WhatsAppCredentialManager {
  const testConfigDir = join(
    import.meta.dir,
    `.test-whatsapp-config-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )
  testDirs.push(testConfigDir)
  return new WhatsAppCredentialManager(testConfigDir)
}

function makeAccount(overrides?: Partial<WhatsAppAccount>): WhatsAppAccount {
  return {
    account_id: 'test-account',
    phone_number: '+12025551234',
    name: 'Test User',
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

describe('WhatsAppCredentialManager', () => {
  describe('loadConfig', () => {
    it('returns default config when file does not exist', async () => {
      const manager = setup()
      const config = await manager.loadConfig()

      expect(config).toEqual({ current: null, accounts: {} })
    })
  })

  describe('saveConfig', () => {
    it('creates file and can be re-read via loadConfig', async () => {
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
    it('returns null when no accounts exist', async () => {
      const manager = setup()
      const account = await manager.getAccount()

      expect(account).toBeNull()
    })

    it('returns null for specific accountId when no accounts exist', async () => {
      const manager = setup()
      const account = await manager.getAccount('nonexistent')

      expect(account).toBeNull()
    })
  })

  describe('setAccount', () => {
    it('round-trips: set then get returns same account', async () => {
      const manager = setup()
      const account = makeAccount()

      await manager.setAccount(account)
      const retrieved = await manager.getAccount('test-account')

      expect(retrieved).toEqual(account)
    })

    it('sets first account as current automatically', async () => {
      const manager = setup()
      const account = makeAccount()

      await manager.setAccount(account)
      const current = await manager.getAccount()

      expect(current).toEqual(account)
    })

    it('does not override current when it is already set', async () => {
      const manager = setup()
      const first = makeAccount({ account_id: 'first-account' })
      const second = makeAccount({ account_id: 'second-account' })

      await manager.setAccount(first)
      await manager.setAccount(second)

      const current = await manager.getAccount()
      expect(current?.account_id).toBe('first-account')
    })

    it('looks up account by normalized ID via createAccountId', async () => {
      const manager = setup()
      const account = makeAccount({ account_id: 'plus-12025551234' })

      await manager.setAccount(account)
      const retrieved = await manager.getAccount('+12025551234')

      expect(retrieved).toEqual(account)
    })
  })

  describe('listAccounts', () => {
    it('returns empty array when no accounts', async () => {
      const manager = setup()
      const accounts = await manager.listAccounts()

      expect(accounts).toEqual([])
    })

    it('returns all accounts with is_current flag', async () => {
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
    it('switches active account and returns true', async () => {
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

    it('returns false for non-existent account', async () => {
      const manager = setup()

      const result = await manager.setCurrent('nonexistent')

      expect(result).toBe(false)
    })
  })

  describe('removeAccount', () => {
    it('removes account and adjusts current to next available', async () => {
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

    it('returns false for non-existent account', async () => {
      const manager = setup()

      const result = await manager.removeAccount('nonexistent')

      expect(result).toBe(false)
    })

    it('deletes session directory even when account is not in config', async () => {
      const manager = setup()

      const paths = await manager.ensureAccountPaths('orphan-account')
      expect(existsSync(paths.account_dir)).toBe(true)

      const result = await manager.removeAccount('orphan-account')

      expect(result).toBe(true)
      expect(existsSync(paths.account_dir)).toBe(false)
    })

    it('returns false when neither config entry nor directory exists', async () => {
      const manager = setup()

      const result = await manager.removeAccount('ghost-account')

      expect(result).toBe(false)
    })
  })

  describe('clearCredentials', () => {
    it('removes credentials file when it exists', async () => {
      const manager = setup()
      const account = makeAccount()
      await manager.setAccount(account)

      const testConfigDir = testDirs[testDirs.length - 1]!
      const credentialsPath = join(testConfigDir, 'whatsapp-credentials.json')
      expect(existsSync(credentialsPath)).toBe(true)

      await manager.clearCredentials()

      expect(existsSync(credentialsPath)).toBe(false)
    })

    it('does not throw when credentials file does not exist', async () => {
      const manager = setup()

      await expect(manager.clearCredentials()).resolves.toBeUndefined()
    })
  })

  describe('getAccountPaths', () => {
    it('returns correct paths structure for account ID', async () => {
      const testConfigDir = join(
        import.meta.dir,
        `.test-whatsapp-config-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      )
      testDirs.push(testConfigDir)
      const manager = new WhatsAppCredentialManager(testConfigDir)

      const paths = manager.getAccountPaths('test-account')

      expect(paths.account_dir).toBe(join(testConfigDir, 'whatsapp', 'test-account'))
      expect(paths.auth_dir).toBe(join(testConfigDir, 'whatsapp', 'test-account', 'auth'))
    })

    it('normalizes account ID via createAccountId', async () => {
      const testConfigDir = join(
        import.meta.dir,
        `.test-whatsapp-config-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      )
      testDirs.push(testConfigDir)
      const manager = new WhatsAppCredentialManager(testConfigDir)

      const paths = manager.getAccountPaths('+12025551234')

      expect(paths.account_dir).toContain('plus-12025551234')
      expect(paths.auth_dir).toContain('plus-12025551234')
    })
  })

  describe('ensureAccountPaths', () => {
    it('creates directories', async () => {
      const manager = setup()

      const paths = await manager.ensureAccountPaths('test-account')

      expect(existsSync(paths.auth_dir)).toBe(true)
    })

    it('returns paths structure', async () => {
      const testConfigDir = join(
        import.meta.dir,
        `.test-whatsapp-config-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      )
      testDirs.push(testConfigDir)
      const manager = new WhatsAppCredentialManager(testConfigDir)

      const paths = await manager.ensureAccountPaths('my-account')

      expect(paths.account_dir).toBe(join(testConfigDir, 'whatsapp', 'my-account'))
      expect(paths.auth_dir).toBe(join(testConfigDir, 'whatsapp', 'my-account', 'auth'))
    })
  })
})
