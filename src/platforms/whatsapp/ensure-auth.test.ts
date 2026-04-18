import { afterEach, beforeEach, describe, expect, spyOn, it } from 'bun:test'
import * as fs from 'node:fs'

import { WhatsAppCredentialManager } from '@/platforms/whatsapp/credential-manager'
import { ensureWhatsAppAuth } from '@/platforms/whatsapp/ensure-auth'
import type { WhatsAppAccount } from '@/platforms/whatsapp/types'

let getAccountSpy: ReturnType<typeof spyOn>
let getAccountPathsSpy: ReturnType<typeof spyOn>
let existsSyncSpy: ReturnType<typeof spyOn>
let exitSpy: ReturnType<typeof spyOn>
let consoleSpy: ReturnType<typeof spyOn>

const validAccount: WhatsAppAccount = {
  account_id: 'test-account',
  phone_number: '+12025551234',
  name: 'Test User',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

const validPaths = {
  account_dir: '/tmp/test/whatsapp/test-account',
  auth_dir: '/tmp/test/whatsapp/test-account/auth',
}

beforeEach(() => {
  getAccountSpy = spyOn(WhatsAppCredentialManager.prototype, 'getAccount').mockResolvedValue(null)

  getAccountPathsSpy = spyOn(WhatsAppCredentialManager.prototype, 'getAccountPaths').mockReturnValue(validPaths)

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

describe('ensureWhatsAppAuth', () => {
  it('exits with error when no account configured', async () => {
    // given
    getAccountSpy.mockResolvedValue(null)

    // when / then
    await expect(ensureWhatsAppAuth()).rejects.toThrow('process.exit(1)')
    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(consoleSpy).toHaveBeenCalled()
  })

  it('exits with error when creds file missing', async () => {
    // given
    getAccountSpy.mockResolvedValue(validAccount)
    existsSyncSpy.mockReturnValue(false)

    // when / then
    await expect(ensureWhatsAppAuth()).rejects.toThrow('process.exit(1)')
    expect(exitSpy).toHaveBeenCalledWith(1)
    expect(consoleSpy).toHaveBeenCalled()
  })

  it('succeeds when account and creds file exist', async () => {
    // given
    getAccountSpy.mockResolvedValue(validAccount)
    existsSyncSpy.mockReturnValue(true)

    // when
    await ensureWhatsAppAuth()

    // then
    expect(exitSpy).not.toHaveBeenCalled()
  })
})
