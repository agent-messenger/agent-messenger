import { mkdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { LineCredentialManager } from './credential-manager'
import type { LineAccountCredentials } from './types'

const makeAccount = (id: string): LineAccountCredentials => ({
  account_id: id,
  auth_token: `token-${id}`,
  device: 'DESKTOPMAC',
  display_name: `User ${id}`,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
})

let tempDir: string
let manager: LineCredentialManager

beforeEach(async () => {
  tempDir = join(tmpdir(), `line-cred-test-${Date.now()}`)
  await mkdir(tempDir, { recursive: true })
  manager = new LineCredentialManager(tempDir)
})

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true })
})

describe('LineCredentialManager', () => {
  test('load returns default config when file does not exist', async () => {
    const config = await manager.load()
    expect(config).toEqual({ current_account: null, accounts: {} })
  })

  test('save and load round trip', async () => {
    const account = makeAccount('alice')
    const config = { current_account: 'alice', accounts: { alice: account } }

    await manager.save(config)
    const loaded = await manager.load()

    expect(loaded).toEqual(config)
  })

  test('file is created with 0o600 permissions', async () => {
    await manager.save({ current_account: null, accounts: {} })
    const fileStat = await stat(join(tempDir, 'line-credentials.json'))
    // Check owner read/write only (0o600)
    expect(fileStat.mode & 0o777).toBe(0o600)
  })

  test('setAccount adds account and sets as current if first', async () => {
    const account = makeAccount('alice')
    await manager.setAccount(account)

    const loaded = await manager.load()
    expect(loaded.accounts['alice']).toEqual(account)
    expect(loaded.current_account).toBe('alice')
  })

  test('setAccount does not change current if already set', async () => {
    await manager.setAccount(makeAccount('alice'))
    await manager.setAccount(makeAccount('bob'))

    const loaded = await manager.load()
    expect(loaded.current_account).toBe('alice')
  })

  test('getAccount returns null when no accounts', async () => {
    const result = await manager.getAccount()
    expect(result).toBeNull()
  })

  test('getAccount returns current account when no id given', async () => {
    const account = makeAccount('alice')
    await manager.setAccount(account)

    const result = await manager.getAccount()
    expect(result).toEqual(account)
  })

  test('getAccount returns account by id', async () => {
    await manager.setAccount(makeAccount('alice'))
    const bob = makeAccount('bob')
    await manager.setAccount(bob)

    const result = await manager.getAccount('bob')
    expect(result).toEqual(bob)
  })

  test('getAccount returns null for unknown id', async () => {
    await manager.setAccount(makeAccount('alice'))
    const result = await manager.getAccount('unknown')
    expect(result).toBeNull()
  })

  test('removeAccount removes the account', async () => {
    await manager.setAccount(makeAccount('alice'))
    await manager.removeAccount('alice')

    const loaded = await manager.load()
    expect(loaded.accounts['alice']).toBeUndefined()
  })

  test('removeAccount clears current if it was active', async () => {
    await manager.setAccount(makeAccount('alice'))
    await manager.removeAccount('alice')

    const loaded = await manager.load()
    expect(loaded.current_account).toBeNull()
  })

  test('removeAccount sets next account as current when active is removed', async () => {
    await manager.setAccount(makeAccount('alice'))
    await manager.setAccount(makeAccount('bob'))
    await manager.removeAccount('alice')

    const loaded = await manager.load()
    expect(loaded.current_account).toBe('bob')
  })

  test('setCurrentAccount updates current account', async () => {
    await manager.setAccount(makeAccount('alice'))
    await manager.setAccount(makeAccount('bob'))
    await manager.setCurrentAccount('bob')

    const loaded = await manager.load()
    expect(loaded.current_account).toBe('bob')
  })

  test('listAccounts returns correct format', async () => {
    await manager.setAccount(makeAccount('alice'))
    await manager.setAccount(makeAccount('bob'))

    const list = await manager.listAccounts()
    expect(list).toHaveLength(2)

    const alice = list.find((a) => a.account_id === 'alice')
    expect(alice).toBeDefined()
    expect(alice?.is_current).toBe(true)
    expect(alice?.device).toBe('DESKTOPMAC')
    expect(alice?.display_name).toBe('User alice')
    expect(alice?.created_at).toBeDefined()

    const bob = list.find((a) => a.account_id === 'bob')
    expect(bob?.is_current).toBe(false)
  })

  test('clearAll removes the credentials file', async () => {
    await manager.setAccount(makeAccount('alice'))
    await manager.clearAll()

    const config = await manager.load()
    expect(config).toEqual({ current_account: null, accounts: {} })
  })

  test('clearAll does not throw if file does not exist', async () => {
    await expect(manager.clearAll()).resolves.toBeUndefined()
  })
})
