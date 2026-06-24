import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { IMessageCredentialManager } from './credential-manager'
import type { IMessageAccount } from './types'

const testDirs: string[] = []
const savedEnv: Record<string, string | undefined> = {}

function setup(): IMessageCredentialManager {
  const dir = join(import.meta.dir, `.test-imessage-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  testDirs.push(dir)
  return new IMessageCredentialManager(dir)
}

function makeAccount(overrides?: Partial<IMessageAccount>): IMessageAccount {
  const now = new Date().toISOString()
  return {
    account_id: 'home',
    provider: 'bluebubbles',
    server_url: 'http://host.docker.internal:1234',
    password: 'secret',
    label: 'Home Mac',
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

function clearEnv(): void {
  for (const key of ['AGENT_IMESSAGE_URL', 'AGENT_IMESSAGE_PASSWORD', 'BLUEBUBBLES_URL', 'BLUEBUBBLES_PASSWORD']) {
    savedEnv[key] = process.env[key]
    delete process.env[key]
  }
}

function restoreEnv(): void {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

afterEach(() => {
  restoreEnv()
  for (const dir of testDirs) rmSync(dir, { recursive: true, force: true })
})

describe('IMessageCredentialManager', () => {
  it('persists provider-aware schema with 0600 mode', async () => {
    clearEnv()
    const manager = setup()
    await manager.setAccount(makeAccount())

    const dir = testDirs[testDirs.length - 1]!
    const path = join(dir, 'imessage-credentials.json')
    expect(existsSync(path)).toBe(true)
    expect(statSync(path).mode & 0o777).toBe(0o600)

    const config = await manager.loadConfig()
    expect(config.accounts.home?.provider).toBe('bluebubbles')
  })

  it('resolution order: flags beat AGENT_IMESSAGE_* beat BLUEBUBBLES_* beat stored', async () => {
    clearEnv()
    const manager = setup()
    await manager.setAccount(makeAccount({ server_url: 'http://stored:1234', password: 'stored-pw' }))

    expect(await manager.resolveCredentials()).toEqual({ server_url: 'http://stored:1234', password: 'stored-pw' })

    process.env.BLUEBUBBLES_URL = 'http://bb:1234'
    process.env.BLUEBUBBLES_PASSWORD = 'bb-pw'
    expect(await manager.resolveCredentials()).toEqual({ server_url: 'http://bb:1234', password: 'bb-pw' })

    process.env.AGENT_IMESSAGE_URL = 'http://ai:1234'
    process.env.AGENT_IMESSAGE_PASSWORD = 'ai-pw'
    expect(await manager.resolveCredentials()).toEqual({ server_url: 'http://ai:1234', password: 'ai-pw' })

    expect(await manager.resolveCredentials(undefined, { serverUrl: 'http://flag:1234', password: 'flag-pw' })).toEqual(
      {
        server_url: 'http://flag:1234',
        password: 'flag-pw',
      },
    )
  })

  it('does not write env-derived credentials to disk', async () => {
    clearEnv()
    const manager = setup()
    process.env.AGENT_IMESSAGE_URL = 'http://env:1234'
    process.env.AGENT_IMESSAGE_PASSWORD = 'env-pw'

    await manager.resolveCredentials()

    const dir = testDirs[testDirs.length - 1]!
    expect(existsSync(join(dir, 'imessage-credentials.json'))).toBe(false)
  })

  it('returns null when nothing is configured', async () => {
    clearEnv()
    const manager = setup()
    expect(await manager.resolveCredentials()).toBeNull()
  })

  it('removeAccount reassigns current to first remaining or null', async () => {
    clearEnv()
    const manager = setup()
    await manager.setAccount(makeAccount({ account_id: 'a' }))
    await manager.setAccount(makeAccount({ account_id: 'b' }))

    expect(await manager.removeAccount('a')).toBe(true)
    expect((await manager.getAccount())?.account_id).toBe('b')

    expect(await manager.removeAccount('b')).toBe(true)
    expect(await manager.getAccount()).toBeNull()
  })

  it('setCurrent returns false for unknown account', async () => {
    clearEnv()
    const manager = setup()
    expect(await manager.setCurrent('ghost')).toBe(false)
  })
})
