import { afterAll, describe, expect, mock, it } from 'bun:test'
import { rmSync } from 'node:fs'
import { join } from 'node:path'

import { WeChatBotCredentialManager } from '@/platforms/wechatbot/credential-manager'

mock.module('../client', () => ({
  WeChatBotClient: class MockWeChatBotClient {
    async login() {
      return this
    }
    verifyCredentials = mock(() => Promise.resolve(true))
  },
}))

const { setAction, statusAction, clearAction, listAction, useAction, removeAction } =
  await import('@/platforms/wechatbot/commands/auth')

const testDirs: string[] = []

function makeCredManager(): WeChatBotCredentialManager {
  const dir = join(import.meta.dir, `.test-auth-config-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  testDirs.push(dir)
  return new WeChatBotCredentialManager(dir)
}

afterAll(() => {
  for (const dir of testDirs) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('setAction', () => {
  it('returns success with app_id when credentials are valid', async () => {
    const credManager = makeCredManager()
    const result = await setAction('wx123', 'secret123', { _credManager: credManager })

    expect(result.success).toBe(true)
    expect(result.app_id).toBe('wx123')
    expect(result.account_name).toBe('wx123')
  })

  it('saves credentials to credManager', async () => {
    const credManager = makeCredManager()
    await setAction('wx456', 'secret456', { _credManager: credManager })

    const creds = await credManager.getCredentials()
    expect(creds?.app_id).toBe('wx456')
  })

  it('returns error when verifyCredentials returns false', async () => {
    mock.module('../client', () => ({
      WeChatBotClient: class MockWeChatBotClient {
        async login() {
          return this
        }
        verifyCredentials = mock(() => Promise.resolve(false))
      },
    }))

    const { setAction: setActionFresh } = await import('@/platforms/wechatbot/commands/auth')
    const credManager = makeCredManager()
    const result = await setActionFresh('wx-bad', 'bad-secret', { _credManager: credManager })

    expect(result.error).toBeDefined()
    expect(result.success).toBeUndefined()
  })
})

describe('statusAction', () => {
  it('returns valid: false when no credentials configured', async () => {
    const credManager = makeCredManager()
    const result = await statusAction({ _credManager: credManager })

    expect(result.valid).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('returns valid: true when credentials exist and are valid', async () => {
    mock.module('../client', () => ({
      WeChatBotClient: class MockWeChatBotClient {
        async login() {
          return this
        }
        verifyCredentials = mock(() => Promise.resolve(true))
      },
    }))

    const { statusAction: statusActionFresh } = await import('@/platforms/wechatbot/commands/auth')
    const credManager = makeCredManager()
    await credManager.setCredentials({ app_id: 'wx123', app_secret: 'secret123', account_name: 'My Account' })

    const result = await statusActionFresh({ _credManager: credManager })

    expect(result.valid).toBe(true)
    expect(result.app_id).toBe('wx123')
  })

  it('returns valid: false when credentials exist but are invalid', async () => {
    mock.module('../client', () => ({
      WeChatBotClient: class MockWeChatBotClient {
        async login() {
          return this
        }
        verifyCredentials = mock(() => Promise.resolve(false))
      },
    }))

    const { statusAction: statusActionFresh } = await import('@/platforms/wechatbot/commands/auth')
    const credManager = makeCredManager()
    await credManager.setCredentials({ app_id: 'wx123', app_secret: 'bad-secret', account_name: 'My Account' })

    const result = await statusActionFresh({ _credManager: credManager })

    expect(result.valid).toBe(false)
  })

  it('returns error message when account not found', async () => {
    const credManager = makeCredManager()
    const result = await statusAction({ account: 'nonexistent', _credManager: credManager })

    expect(result.valid).toBe(false)
    expect(result.error).toContain('nonexistent')
  })
})

describe('clearAction', () => {
  it('clears all credentials and returns success', async () => {
    const credManager = makeCredManager()
    await credManager.setCredentials({ app_id: 'wx123', app_secret: 'secret123', account_name: 'My Account' })

    const result = await clearAction({ _credManager: credManager })

    expect(result.success).toBe(true)

    const creds = await credManager.getCredentials()
    expect(creds).toBeNull()
  })
})

describe('listAction', () => {
  it('returns empty accounts array when none configured', async () => {
    const credManager = makeCredManager()
    const result = await listAction({ _credManager: credManager })

    expect(result.accounts).toEqual([])
  })

  it('returns all accounts with is_current flag', async () => {
    const credManager = makeCredManager()
    await credManager.setCredentials({ app_id: 'wx-a', app_secret: 'secret-a', account_name: 'Account A' })
    await credManager.setCredentials({ app_id: 'wx-b', app_secret: 'secret-b', account_name: 'Account B' })

    const result = await listAction({ _credManager: credManager })

    expect(result.accounts).toHaveLength(2)
    const acctA = result.accounts?.find((a) => a.app_id === 'wx-a')
    const acctB = result.accounts?.find((a) => a.app_id === 'wx-b')
    expect(acctA?.is_current).toBe(false)
    expect(acctB?.is_current).toBe(true)
  })
})

describe('useAction', () => {
  it('switches to specified account and returns success', async () => {
    const credManager = makeCredManager()
    await credManager.setCredentials({ app_id: 'wx-a', app_secret: 'secret-a', account_name: 'Account A' })
    await credManager.setCredentials({ app_id: 'wx-b', app_secret: 'secret-b', account_name: 'Account B' })

    const result = await useAction('wx-a', { _credManager: credManager })

    expect(result.success).toBe(true)
    expect(result.app_id).toBe('wx-a')
  })

  it('returns error when account not found', async () => {
    const credManager = makeCredManager()
    const result = await useAction('nonexistent', { _credManager: credManager })

    expect(result.error).toBeDefined()
    expect(result.error).toContain('nonexistent')
    expect(result.success).toBeUndefined()
  })
})

describe('removeAction', () => {
  it('removes specified account and returns success', async () => {
    const credManager = makeCredManager()
    await credManager.setCredentials({ app_id: 'wx123', app_secret: 'secret123', account_name: 'My Account' })

    const result = await removeAction('wx123', { _credManager: credManager })

    expect(result.success).toBe(true)

    const creds = await credManager.getCredentials()
    expect(creds).toBeNull()
  })

  it('returns error when account not found', async () => {
    const credManager = makeCredManager()
    const result = await removeAction('nonexistent', { _credManager: credManager })

    expect(result.error).toBeDefined()
    expect(result.error).toContain('nonexistent')
    expect(result.success).toBeUndefined()
  })
})
