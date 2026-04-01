import { afterAll, describe, expect, mock, test } from 'bun:test'
import { rmSync } from 'node:fs'
import { join } from 'node:path'

import { WeChatCredentialManager } from '@/platforms/wechat/credential-manager'

mock.module('../client', () => ({
  WeChatClient: class MockWeChatClient {
    private _accountId: string | null = null

    constructor(_opts?: { host?: string; port?: number }) {}

    async isConnected() {
      return true
    }

    async getLoginInfo() {
      return { user_id: 'wxid_test123', nickname: 'Test User' }
    }

    async login(opts?: { accountId?: string }) {
      if (opts?.accountId) this._accountId = opts.accountId
      return this
    }

    getAccountId() {
      return this._accountId ?? 'wxid-test123'
    }

    async saveCurrentAccount(_userInfo: { user_id: string; nickname: string }) {
      return {
        account_id: this.getAccountId(),
        name: 'Test User',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      }
    }
  },
}))

const { statusAction, listAction, useAction, logoutAction } = await import(
  '@/platforms/wechat/commands/auth'
)

const testDirs: string[] = []

function makeCredManager(): WeChatCredentialManager {
  const dir = join(
    import.meta.dir,
    `.test-wechat-auth-config-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )
  testDirs.push(dir)
  return new WeChatCredentialManager(dir)
}

afterAll(() => {
  for (const dir of testDirs) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('statusAction', () => {
  test('returns user info when OneBot server is reachable', async () => {
    const result = await statusAction({})
    expect(result.user_id).toBe('wxid_test123')
    expect(result.name).toBe('Test User')
  })

  test('returns error when server is not reachable', async () => {
    mock.module('../client', () => ({
      WeChatClient: class UnreachableClient {
        constructor(_opts?: { host?: string; port?: number }) {}
        async isConnected() { return false }
        async getLoginInfo() { return { user_id: '', nickname: '' } }
        async login() { return this }
        getAccountId() { return null }
        async saveCurrentAccount() { return null }
      },
    }))

    const { statusAction: freshStatusAction } = await import('@/platforms/wechat/commands/auth')
    const result = await freshStatusAction({})
    expect(result.error).toBeDefined()
  })
})

describe('listAction', () => {
  test('returns empty accounts array when none configured', async () => {
    const credManager = makeCredManager()
    const result = await listAction({ _credManager: credManager })

    expect(result.accounts).toEqual([])
  })

  test('returns all accounts with is_current flag', async () => {
    const credManager = makeCredManager()
    const now = new Date().toISOString()
    await credManager.setAccount({ account_id: 'wxid-a', name: 'User A', created_at: now, updated_at: now })
    await credManager.setAccount({ account_id: 'wxid-b', name: 'User B', created_at: now, updated_at: now })

    const result = await listAction({ _credManager: credManager })

    expect(result.accounts).toHaveLength(2)
    const acctA = result.accounts?.find((a) => a.account_id === 'wxid-a')
    const acctB = result.accounts?.find((a) => a.account_id === 'wxid-b')
    expect(acctA?.is_current).toBe(true)
    expect(acctB?.is_current).toBe(false)
  })
})

describe('useAction', () => {
  test('switches to specified account and returns success', async () => {
    const credManager = makeCredManager()
    const now = new Date().toISOString()
    await credManager.setAccount({ account_id: 'wxid-a', name: 'User A', created_at: now, updated_at: now })
    await credManager.setAccount({ account_id: 'wxid-b', name: 'User B', created_at: now, updated_at: now })

    const result = await useAction('wxid-b', { _credManager: credManager })

    expect(result.success).toBe(true)
    expect(result.account_id).toBe('wxid-b')
  })

  test('returns error when account not found', async () => {
    const credManager = makeCredManager()
    const result = await useAction('nonexistent', { _credManager: credManager })

    expect(result.error).toBeDefined()
    expect(result.error).toContain('nonexistent')
    expect(result.success).toBeUndefined()
  })
})

describe('logoutAction', () => {
  test('removes account and returns success', async () => {
    const credManager = makeCredManager()
    const now = new Date().toISOString()
    await credManager.setAccount({ account_id: 'wxid-123', name: 'Test User', created_at: now, updated_at: now })

    const result = await logoutAction({ _credManager: credManager })

    expect(result.success).toBe(true)

    const account = await credManager.getAccount()
    expect(account).toBeNull()
  })

  test('returns error when no account configured', async () => {
    const credManager = makeCredManager()
    const result = await logoutAction({ _credManager: credManager })

    expect(result.error).toBeDefined()
  })

  test('returns error when specific account not found', async () => {
    const credManager = makeCredManager()
    const result = await logoutAction({ account: 'nonexistent', _credManager: credManager })

    expect(result.error).toBeDefined()
  })
})
