import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const mockGetBusinessProfile = mock(() =>
  Promise.resolve({
    about: 'Support Workspace',
    description: 'Main support phone',
  }),
)

mock.module('../client', () => ({
  WhatsAppBotClient: class MockWhatsAppBotClient {
    constructor(phoneNumberId: string, accessToken: string) {
      if (!phoneNumberId || !accessToken) {
        throw new Error('Credentials required')
      }
    }
    getBusinessProfile = mockGetBusinessProfile
  },
}))

import { WhatsAppBotCredentialManager } from '../credential-manager'
import { clearAction, listAction, removeAction, setAction, statusAction, useAction } from './auth'

describe('auth commands', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = join(tmpdir(), `whatsappbot-auth-test-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })
    mockGetBusinessProfile.mockClear()
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true })
    }
  })

  describe('setAction', () => {
    test('validates and stores credentials with workspace info from API', async () => {
      const manager = new WhatsAppBotCredentialManager(tempDir)

      const result = await setAction('1234567890', 'token-123', { _credManager: manager })

      expect(result.success).toBe(true)
      expect(result.workspace_id).toBe('1234567890')
      expect(result.workspace_name).toBe('Support Workspace')

      const creds = await manager.getCredentials()
      expect(creds?.access_token).toBe('token-123')
      expect(creds?.workspace_id).toBe('1234567890')
    })

    test('uses --workspace option as workspace name', async () => {
      const manager = new WhatsAppBotCredentialManager(tempDir)

      const result = await setAction('1234567890', 'token-123', {
        workspace: 'My Custom Name',
        _credManager: manager,
      })

      expect(result.success).toBe(true)
      expect(result.workspace_name).toBe('My Custom Name')

      const creds = await manager.getCredentials()
      expect(creds?.workspace_name).toBe('My Custom Name')
    })

    test('handles client errors gracefully', async () => {
      mockGetBusinessProfile.mockImplementationOnce(() => Promise.reject(new Error('Invalid credentials')))

      const manager = new WhatsAppBotCredentialManager(tempDir)

      const result = await setAction('1234567890', 'bad-token', { _credManager: manager })

      expect(result.error).toBeDefined()
      expect(result.error).toContain('Invalid credentials')
    })
  })

  describe('statusAction', () => {
    test('returns no credentials when none set', async () => {
      const manager = new WhatsAppBotCredentialManager(tempDir)

      const result = await statusAction({ _credManager: manager })

      expect(result.valid).toBe(false)
      expect(result.error).toBeDefined()
    })

    test('returns valid status for current workspace', async () => {
      const manager = new WhatsAppBotCredentialManager(tempDir)
      await manager.setCredentials({
        workspace_id: '1234567890',
        workspace_name: 'Stored Workspace',
        phone_number_id: '1234567890',
        access_token: 'token-123',
      })

      const result = await statusAction({ _credManager: manager })

      expect(result.valid).toBe(true)
      expect(result.workspace_id).toBe('1234567890')
      expect(result.workspace_name).toBe('Support Workspace')
    })

    test('returns invalid when API call fails', async () => {
      mockGetBusinessProfile.mockImplementationOnce(() => Promise.reject(new Error('Unauthorized')))

      const manager = new WhatsAppBotCredentialManager(tempDir)
      await manager.setCredentials({
        workspace_id: '1234567890',
        workspace_name: 'Stored Workspace',
        phone_number_id: '1234567890',
        access_token: 'invalid-token',
      })

      const result = await statusAction({ _credManager: manager })

      expect(result.valid).toBe(false)
      expect(result.workspace_name).toBe('Stored Workspace')
    })
  })

  describe('clearAction', () => {
    test('removes all stored credentials', async () => {
      const manager = new WhatsAppBotCredentialManager(tempDir)
      await manager.setCredentials({
        workspace_id: '1234567890',
        workspace_name: 'Stored Workspace',
        phone_number_id: '1234567890',
        access_token: 'token-123',
      })

      const result = await clearAction({ _credManager: manager })

      expect(result.success).toBe(true)
      expect(await manager.getCredentials()).toBeNull()
    })
  })

  describe('listAction', () => {
    test('returns all stored workspaces', async () => {
      const manager = new WhatsAppBotCredentialManager(tempDir)
      await manager.setCredentials({
        workspace_id: '1234567890',
        workspace_name: 'Workspace 1',
        phone_number_id: '1234567890',
        access_token: 'token-1',
      })
      await manager.setCredentials({
        workspace_id: '9876543210',
        workspace_name: 'Workspace 2',
        phone_number_id: '9876543210',
        access_token: 'token-2',
      })

      const result = await listAction({ _credManager: manager })

      expect(result.workspaces).toHaveLength(2)
      expect(result.workspaces?.find((workspace) => workspace.workspace_id === '9876543210')?.is_current).toBe(true)
      expect(result.workspaces?.find((workspace) => workspace.workspace_id === '1234567890')?.is_current).toBe(false)
    })
  })

  describe('useAction', () => {
    test('switches current workspace', async () => {
      const manager = new WhatsAppBotCredentialManager(tempDir)
      await manager.setCredentials({
        workspace_id: '1234567890',
        workspace_name: 'Workspace 1',
        phone_number_id: '1234567890',
        access_token: 'token-1',
      })
      await manager.setCredentials({
        workspace_id: '9876543210',
        workspace_name: 'Workspace 2',
        phone_number_id: '9876543210',
        access_token: 'token-2',
      })

      const result = await useAction('1234567890', { _credManager: manager })

      expect(result.success).toBe(true)
      expect(result.workspace_id).toBe('1234567890')
    })
  })

  describe('removeAction', () => {
    test('removes a stored workspace', async () => {
      const manager = new WhatsAppBotCredentialManager(tempDir)
      await manager.setCredentials({
        workspace_id: '1234567890',
        workspace_name: 'Workspace 1',
        phone_number_id: '1234567890',
        access_token: 'token-1',
      })

      const result = await removeAction('1234567890', { _credManager: manager })

      expect(result.success).toBe(true)
      expect(await manager.getCredentials('1234567890')).toBeNull()
    })
  })
})
