import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import * as fs from 'node:fs'

import { InstagramCredentialManager } from '@/platforms/instagram/credential-manager'
import { ensureInstagramAuth } from '@/platforms/instagram/ensure-auth'
import type { InstagramAccount } from '@/platforms/instagram/types'

let getAccountSpy: ReturnType<typeof spyOn>
let getAccountPathsSpy: ReturnType<typeof spyOn>
let existsSyncSpy: ReturnType<typeof spyOn>
let exitSpy: ReturnType<typeof spyOn>
let consoleSpy: ReturnType<typeof spyOn>

const validAccount: InstagramAccount = {
  account_id: 'test-account',
  username: 'testuser',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

const validPaths = {
  account_dir: '/tmp/test/instagram/test-account',
  session_path: '/tmp/test/instagram/test-account/session.json',
}

beforeEach(() => {
  getAccountSpy = spyOn(InstagramCredentialManager.prototype, 'getAccount').mockResolvedValue(null)

  getAccountPathsSpy = spyOn(
    InstagramCredentialManager.prototype,
    'getAccountPaths',
  ).mockReturnValue(validPaths)

  existsSyncSpy = spyOn(fs, 'existsSync').mockReturnValue(false)

  exitSpy = spyOn(process, 'exit').mockImplementation((code) => {
    throw new Error(`process.exit(${code})`)
  })

  consoleSpy = spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  getAccountSpy?.mockRestore()
  getAccountPathsSpy?.mockRestore()
  existsSyncSpy?.mockRestore()
  exitSpy?.mockRestore()
  consoleSpy?.mockRestore()
})

describe('ensureInstagramAuth', () => {
  test('exits with error when no account configured', async () => {
    // given
    getAccountSpy.mockResolvedValue(null)

    // when / then
    await expect(ensureInstagramAuth()).rejects.toThrow('process.exit(1)')
    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(consoleSpy).toHaveBeenCalled()
  })

  test('exits with error when session file missing', async () => {
    // given
    getAccountSpy.mockResolvedValue(validAccount)
    existsSyncSpy.mockReturnValue(false)

    // when / then
    await expect(ensureInstagramAuth()).rejects.toThrow('process.exit(1)')
    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(consoleSpy).toHaveBeenCalled()
  })

  test('succeeds when account and session file exist', async () => {
    // given
    getAccountSpy.mockResolvedValue(validAccount)
    existsSyncSpy.mockReturnValue(true)

    // when
    await ensureInstagramAuth()

    // then
    expect(exitSpy).not.toHaveBeenCalled()
  })
})
