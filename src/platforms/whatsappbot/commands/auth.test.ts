import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const mockVerifyToken = mock(() =>
  Promise.resolve({
    verified_name: 'Test Business',
  }),
)

mock.module('../client', () => ({
  WhatsAppBotClient: class MockWhatsAppBotClient {
    async login(_credentials?: { phoneNumberId: string; accessToken: string }) {
      return this
    }
    verifyToken = mockVerifyToken
  },
}))

import { WhatsAppBotCredentialManager } from '../credential-manager'
import { clearAction, listAction, removeAction, setAction, statusAction, useAction } from './auth'

describe('auth commands', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = join(tmpdir(), `whatsappbot-auth-test-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })
    mockVerifyToken.mockClear()
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true })
    }
  })

  describe('setAction', () => {
    test('validates token and stores credentials', async () => {
      const manager = new WhatsAppBotCredentialManager(tempDir)

      const result = await setAction('12345678901', 'EAAtest-token', { _credManager: manager })

      expect(result.success).toBe(true)
      expect(result.phone_number_id).toBe('12345678901')
      expect(result.account_name).toBe('Test Business')

      const creds = await manager.getCredentials()
      expect(creds?.phone_number_id).toBe('12345678901')
      expect(creds?.access_token).toBe('EAAtest-token')
    })

    test('returns error when client throws', async () => {
      mockVerifyToken.mockImplementationOnce(() => Promise.reject(new Error('Invalid token')))
      const manager = new WhatsAppBotCredentialManager(tempDir)

      const result = await setAction('12345678901', 'bad-token', { _credManager: manager })

      expect(result.error).toBeDefined()
      expect(result.error).toContain('Invalid token')
    })
  })

  describe('statusAction', () => {
    test('returns invalid status when no credentials set', async () => {
      const manager = new WhatsAppBotCredentialManager(tempDir)

      const result = await statusAction({ _credManager: manager })

      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    test('returns valid status when credentials are set', async () => {
      const manager = new WhatsAppBotCredentialManager(tempDir)
      await manager.setCredentials({
        phone_number_id: '12345678901',
        account_name: 'Test Business',
        access_token: 'EAAtest-token',
      })

      const result = await statusAction({ _credManager: manager })

      expect(result.valid).toBe(true)
      expect(result.phone_number_id).toBe('12345678901')
      expect(result.account_name).toBe('Test Business')
    })

    test('returns invalid status when verifyToken fails', async () => {
      mockVerifyToken.mockImplementationOnce(() => Promise.reject(new Error('Token expired')))
      const manager = new WhatsAppBotCredentialManager(tempDir)
      await manager.setCredentials({
        phone_number_id: '12345678901',
        account_name: 'Test Business',
        access_token: 'expired-token',
      })

      const result = await statusAction({ _credManager: manager })

      expect(result.valid).toBe(false)
      expect(result.phone_number_id).toBe('12345678901')
    })

    test('returns error for unknown account', async () => {
      const manager = new WhatsAppBotCredentialManager(tempDir)

      const result = await statusAction({ account: 'nonexistent', _credManager: manager })

      expect(result.valid).toBe(false)
      expect(result.error).toContain('nonexistent')
    })
  })

  describe('clearAction', () => {
    test('removes all stored credentials', async () => {
      const manager = new WhatsAppBotCredentialManager(tempDir)
      await manager.setCredentials({
        phone_number_id: '12345678901',
        account_name: 'Test Business',
        access_token: 'EAAtest-token',
      })

      const result = await clearAction({ _credManager: manager })

      expect(result.success).toBe(true)
      expect(await manager.getCredentials()).toBeNull()
    })
  })

  describe('listAction', () => {
    test('returns empty accounts when none set', async () => {
      const manager = new WhatsAppBotCredentialManager(tempDir)

      const result = await listAction({ _credManager: manager })

      expect(result.accounts).toHaveLength(0)
    })

    test('returns all stored accounts', async () => {
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

      const result = await listAction({ _credManager: manager })

      expect(result.accounts).toHaveLength(2)
      expect(result.accounts?.find((a) => a.phone_number_id === '11111111111')?.account_name).toBe('Account A')
      expect(result.accounts?.find((a) => a.phone_number_id === '22222222222')?.is_current).toBe(true)
    })
  })

  describe('useAction', () => {
    test('switches current account', async () => {
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

      const result = await useAction('11111111111', { _credManager: manager })

      expect(result.success).toBe(true)
      expect(result.phone_number_id).toBe('11111111111')
      expect(result.account_name).toBe('Account A')
    })

    test('returns error for unknown account', async () => {
      const manager = new WhatsAppBotCredentialManager(tempDir)

      const result = await useAction('nonexistent', { _credManager: manager })

      expect(result.error).toBeDefined()
      expect(result.error).toContain('nonexistent')
    })
  })

  describe('removeAction', () => {
    test('removes a stored account', async () => {
      const manager = new WhatsAppBotCredentialManager(tempDir)
      await manager.setCredentials({
        phone_number_id: '12345678901',
        account_name: 'Test Business',
        access_token: 'EAAtest-token',
      })

      const result = await removeAction('12345678901', { _credManager: manager })

      expect(result.success).toBe(true)
      expect(await manager.getCredentials('12345678901')).toBeNull()
    })

    test('returns error for unknown account', async () => {
      const manager = new WhatsAppBotCredentialManager(tempDir)

      const result = await removeAction('nonexistent', { _credManager: manager })

      expect(result.error).toBeDefined()
      expect(result.error).toContain('nonexistent')
    })
  })
})
