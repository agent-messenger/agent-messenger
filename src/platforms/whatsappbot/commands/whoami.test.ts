import { afterEach, beforeEach, describe, expect, mock, it } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const mockVerifyToken = mock(() => Promise.resolve({ verified_name: 'Test Business' }))

mock.module('../client', () => ({
  WhatsAppBotClient: class MockWhatsAppBotClient {
    async login(_credentials?: { phoneNumberId: string; accessToken: string }) {
      return this
    }
    verifyToken = mockVerifyToken
  },
}))

// Re-import whoamiAction AFTER mock.module so the mock applies
const { whoamiAction } = await import('./whoami')

import { WhatsAppBotCredentialManager } from '../credential-manager'

describe('whoami command', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = join(tmpdir(), `whatsappbot-whoami-test-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })
    mockVerifyToken.mockClear()
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true })
    }
  })

  it('returns phone number id, account name, and verified name', async () => {
    const manager = new WhatsAppBotCredentialManager(tempDir)
    await manager.setCredentials({
      phone_number_id: '12345678901',
      account_name: 'Test Business',
      access_token: 'EAAtest-token',
    })

    const result = await whoamiAction({ _credManager: manager })

    expect(result.phone_number_id).toBe('12345678901')
    expect(result.account_name).toBe('Test Business')
    expect(result.verified_name).toBe('Test Business')
    expect(result.error).toBeUndefined()
  })

  it('returns info for specific --account', async () => {
    const manager = new WhatsAppBotCredentialManager(tempDir)
    await manager.setCredentials({
      phone_number_id: '11111111111',
      account_name: 'Account A',
      access_token: 'token-a',
    })
    await manager.setCredentials({
      phone_number_id: '22222222222',
      account_name: 'Account B',
      access_token: 'token-b',
    })

    const result = await whoamiAction({ account: '11111111111', _credManager: manager })

    expect(result.phone_number_id).toBe('11111111111')
    expect(result.account_name).toBe('Account A')
    expect(result.verified_name).toBe('Test Business')
  })

  it('returns error when verifyToken fails', async () => {
    mockVerifyToken.mockImplementationOnce(() => Promise.reject(new Error('Invalid token')))

    const manager = new WhatsAppBotCredentialManager(tempDir)
    await manager.setCredentials({
      phone_number_id: '12345678901',
      account_name: 'Test Business',
      access_token: 'bad-token',
    })

    const result = await whoamiAction({ _credManager: manager })

    expect(result.error).toBeDefined()
    expect(result.error).toContain('Invalid token')
  })

  it('returns error when no credentials', async () => {
    const manager = new WhatsAppBotCredentialManager(tempDir)

    const result = await whoamiAction({ _credManager: manager })

    expect(result.error).toBeDefined()
    expect(result.error).toContain('No credentials')
  })
})
