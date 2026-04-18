import { afterAll, describe, expect, it } from 'bun:test'
import { rmSync } from 'node:fs'
import { join } from 'node:path'

import { KakaoCredentialManager } from './credential-manager'
import type { KakaoAccountCredentials } from './types'

const testDirs: string[] = []

function setup(): KakaoCredentialManager {
  const testConfigDir = join(import.meta.dir, `.test-kakao-config-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  testDirs.push(testConfigDir)
  return new KakaoCredentialManager(testConfigDir)
}

function makeAccount(overrides?: Partial<KakaoAccountCredentials>): KakaoAccountCredentials {
  return {
    account_id: 'test-account',
    oauth_token: 'oauth-token-123',
    user_id: 'user-123',
    refresh_token: 'refresh-token-123',
    device_uuid: 'device-uuid-123',
    device_type: 'tablet',
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

describe('KakaoCredentialManager', () => {
  describe('load', () => {
    it('returns default config when file does not exist', async () => {
      const manager = setup()
      const config = await manager.load()

      expect(config).toEqual({ current_account: null, accounts: {} })
    })
  })

  describe('save/load round-trip', () => {
    it('creates file and can be re-read via load', async () => {
      const manager = setup()
      const account = makeAccount()
      const config = {
        current_account: 'test-account',
        accounts: {
          'test-account': account,
        },
      }

      await manager.save(config)
      const loaded = await manager.load()

      expect(loaded).toEqual(config)
    })
  })

  describe('getAccount', () => {
    it('returns null when no accounts exist', async () => {
      const manager = setup()
      const account = await manager.getAccount()

      expect(account).toBeNull()
    })

    it('returns null for nonexistent account ID', async () => {
      const manager = setup()
      const account = await manager.getAccount('nonexistent')

      expect(account).toBeNull()
    })

    it('returns account by explicit ID', async () => {
      const manager = setup()
      const account = makeAccount()

      await manager.setAccount(account)
      const retrieved = await manager.getAccount('test-account')

      expect(retrieved).toEqual(account)
    })

    it('returns current account when no ID given', async () => {
      const manager = setup()
      const account = makeAccount()

      await manager.setAccount(account)
      const current = await manager.getAccount()

      expect(current).toEqual(account)
    })
  })

  describe('setAccount', () => {
    it('stores account and auto-sets current_account if null', async () => {
      const manager = setup()
      const account = makeAccount()

      await manager.setAccount(account)
      const config = await manager.load()

      expect(config.current_account).toBe('test-account')
      expect(config.accounts['test-account']).toEqual(account)
    })

    it('does NOT override existing current_account', async () => {
      const manager = setup()
      const first = makeAccount({ account_id: 'first-account' })
      const second = makeAccount({ account_id: 'second-account' })

      await manager.setAccount(first)
      await manager.setAccount(second)

      const config = await manager.load()
      expect(config.current_account).toBe('first-account')
    })
  })

  describe('listAccounts', () => {
    it('returns empty array for empty config', async () => {
      const manager = setup()
      const accounts = await manager.listAccounts()

      expect(accounts).toEqual([])
    })

    it('returns all accounts with correct is_current flag', async () => {
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

  describe('setCurrentAccount', () => {
    it('switches active account', async () => {
      const manager = setup()
      const first = makeAccount({ account_id: 'first-account' })
      const second = makeAccount({ account_id: 'second-account' })

      await manager.setAccount(first)
      await manager.setAccount(second)
      await manager.setCurrentAccount('second-account')

      const current = await manager.getAccount()
      expect(current?.account_id).toBe('second-account')
    })
  })

  describe('removeAccount', () => {
    it('removes and rotates current to next available', async () => {
      const manager = setup()
      const first = makeAccount({ account_id: 'first-account' })
      const second = makeAccount({ account_id: 'second-account' })

      await manager.setAccount(first)
      await manager.setAccount(second)
      await manager.removeAccount('first-account')

      const accounts = await manager.listAccounts()
      expect(accounts).toHaveLength(1)
      expect(accounts[0]?.account_id).toBe('second-account')

      const current = await manager.getAccount()
      expect(current?.account_id).toBe('second-account')
    })

    it('handles removing non-current account', async () => {
      const manager = setup()
      const first = makeAccount({ account_id: 'first-account' })
      const second = makeAccount({ account_id: 'second-account' })

      await manager.setAccount(first)
      await manager.setAccount(second)
      await manager.removeAccount('second-account')

      const accounts = await manager.listAccounts()
      expect(accounts).toHaveLength(1)
      expect(accounts[0]?.account_id).toBe('first-account')

      // current_account should still be first-account
      const config = await manager.load()
      expect(config.current_account).toBe('first-account')
    })
  })

  describe('savePendingLogin/loadPendingLogin/clearPendingLogin', () => {
    it('handles full save, load, and clear lifecycle', async () => {
      const manager = setup()
      const state = {
        device_uuid: 'uuid-abc',
        device_type: 'tablet' as const,
        email: 'user@example.com',
        created_at: new Date().toISOString(),
      }

      // given nothing saved
      const initial = await manager.loadPendingLogin()
      expect(initial).toBeNull()

      // when saved
      await manager.savePendingLogin(state)
      const loaded = await manager.loadPendingLogin()
      expect(loaded).toEqual(state)

      // when cleared
      await manager.clearPendingLogin()
      const afterClear = await manager.loadPendingLogin()
      expect(afterClear).toBeNull()
    })
  })
})
