import { afterAll, describe, expect, test } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { TelegramCredentialManager } from './credential-manager'

const testDirs: string[] = []

function setup(): TelegramCredentialManager {
  const testConfigDir = join(
    import.meta.dir,
    `.test-telegram-config-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )
  testDirs.push(testConfigDir)
  return new TelegramCredentialManager(testConfigDir)
}

afterAll(() => {
  for (const dir of testDirs) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('TelegramCredentialManager', () => {
  test('stores and retrieves accounts', async () => {
    const manager = setup()

    await manager.setAccount({
      account_id: 'default',
      api_id: 12345,
      api_hash: 'hash',
      phone_number: '+821012345678',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    const account = await manager.getAccount()
    expect(account?.account_id).toBe('default')
    expect(account?.phone_number).toBe('+821012345678')
  })

  test('switches current account', async () => {
    const manager = setup()

    await manager.setAccount({
      account_id: 'first',
      api_id: 1,
      api_hash: 'hash-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    await manager.setAccount({
      account_id: 'second',
      api_id: 2,
      api_hash: 'hash-2',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    const switched = await manager.setCurrent('second')
    const current = await manager.getAccount()

    expect(switched).toBe(true)
    expect(current?.account_id).toBe('second')
  })

  test('creates account directories', async () => {
    const manager = setup()
    const paths = await manager.ensureAccountPaths('+82 10 1234 5678')

    expect(existsSync(paths.account_dir)).toBe(true)
    expect(existsSync(paths.database_dir)).toBe(true)
    expect(existsSync(paths.files_dir)).toBe(true)
    expect(paths.account_dir.endsWith('plus-82-10-1234-5678')).toBe(true)
  })

  test('saves and loads provisioning state', async () => {
    const manager = setup()
    const state = {
      phone: '+14155551234',
      random_hash: 'abc123',
      created_at: new Date().toISOString(),
    }

    await manager.saveProvisioningState(state)
    const loaded = await manager.loadProvisioningState()

    expect(loaded).not.toBeNull()
    expect(loaded!.phone).toBe('+14155551234')
    expect(loaded!.random_hash).toBe('abc123')
  })

  test('returns null for expired provisioning state', async () => {
    const manager = setup()
    const expiredDate = new Date(Date.now() - 11 * 60 * 1000).toISOString()

    await manager.saveProvisioningState({
      phone: '+14155551234',
      random_hash: 'abc123',
      created_at: expiredDate,
    })

    const loaded = await manager.loadProvisioningState()
    expect(loaded).toBeNull()
  })

  test('clears provisioning state', async () => {
    const manager = setup()

    await manager.saveProvisioningState({
      phone: '+14155551234',
      random_hash: 'abc123',
      created_at: new Date().toISOString(),
    })

    await manager.clearProvisioningState()
    const loaded = await manager.loadProvisioningState()
    expect(loaded).toBeNull()
  })

  test('returns null when no provisioning state exists', async () => {
    const manager = setup()
    const loaded = await manager.loadProvisioningState()
    expect(loaded).toBeNull()
  })

  test('returns null for corrupted created_at in provisioning state', async () => {
    const manager = setup()

    await manager.saveProvisioningState({
      phone: '+14155551234',
      random_hash: 'abc123',
      created_at: 'not-a-date',
    })

    const loaded = await manager.loadProvisioningState()
    expect(loaded).toBeNull()
  })

  test('clearCredentials also clears provisioning state', async () => {
    const manager = setup()

    await manager.saveProvisioningState({
      phone: '+14155551234',
      random_hash: 'abc123',
      created_at: new Date().toISOString(),
    })

    await manager.clearCredentials()
    const loaded = await manager.loadProvisioningState()
    expect(loaded).toBeNull()
  })
})
