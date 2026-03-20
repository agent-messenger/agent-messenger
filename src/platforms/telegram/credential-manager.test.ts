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
})
