import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'

mock.module('node:child_process', () => ({ exec: mock() }))

import { WebexClient } from '../client'
import { WebexCredentialManager } from '../credential-manager'
import { loginAction, logoutAction, statusAction } from './auth'

describe('auth commands', () => {
  let consoleSpy: ReturnType<typeof spyOn>
  let _consoleErrorSpy: ReturnType<typeof spyOn>
  const mockPerson = {
    id: 'person-1',
    displayName: 'Test User',
    emails: ['test@example.com'],
    orgId: 'org-1',
    type: 'person' as const,
    created: '2024-01-01T00:00:00.000Z',
  }

  beforeEach(() => {
    consoleSpy = spyOn(console, 'log').mockImplementation(() => {})
    _consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    mock.restore()
  })

  describe('loginAction with --token', () => {
    test('authenticates with provided token (bot token flow)', async () => {
      spyOn(WebexClient.prototype, 'login').mockResolvedValue(new WebexClient())
      spyOn(WebexClient.prototype, 'testAuth').mockResolvedValue(mockPerson)
      spyOn(WebexCredentialManager.prototype, 'saveConfig').mockResolvedValue(undefined)

      await loginAction({ token: 'bot-token-123', pretty: false })

      expect(consoleSpy).toHaveBeenCalledTimes(1)
      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string)
      expect(output.authenticated).toBe(true)
      expect(output.user.displayName).toBe('Test User')
    })

    test('saves tokenType as manual with expiresAt 0', async () => {
      spyOn(WebexClient.prototype, 'login').mockResolvedValue(new WebexClient())
      spyOn(WebexClient.prototype, 'testAuth').mockResolvedValue(mockPerson)
      const saveSpy = spyOn(WebexCredentialManager.prototype, 'saveConfig').mockResolvedValue(undefined)

      await loginAction({ token: 'bot-token-123', pretty: false })

      const savedConfig = saveSpy.mock.calls[0][0] as { tokenType: string; expiresAt: number; refreshToken: string }
      expect(savedConfig.tokenType).toBe('manual')
      expect(savedConfig.expiresAt).toBe(0)
      expect(savedConfig.refreshToken).toBe('')
    })
  })

  describe('loginAction with --client-id and --client-secret', () => {
    test('uses provided credentials for Device Grant flow', async () => {
      spyOn(WebexCredentialManager.prototype, 'requestDeviceCode').mockResolvedValue({
        deviceCode: 'd',
        userCode: 'u',
        verificationUri: 'https://v',
        verificationUriComplete: 'https://vc',
        expiresIn: 300,
        interval: 0.01,
      })
      spyOn(WebexCredentialManager.prototype, 'pollDeviceToken').mockResolvedValue({
        accessToken: 'at',
        refreshToken: 'rt',
        expiresAt: Date.now() + 3600000,
      })
      spyOn(WebexCredentialManager.prototype, 'saveConfig').mockResolvedValue(undefined)
      spyOn(WebexClient.prototype, 'login').mockResolvedValue(new WebexClient())
      spyOn(WebexClient.prototype, 'testAuth').mockResolvedValue(mockPerson)

      await loginAction({ clientId: 'my-id', clientSecret: 'my-secret', pretty: false })

      expect(WebexCredentialManager.prototype.requestDeviceCode).toHaveBeenCalledWith('my-id')
      expect(WebexCredentialManager.prototype.pollDeviceToken).toHaveBeenCalledWith('d', 0.01, 300, 'my-id', 'my-secret')
    })

    test('saves tokenType as oauth in config', async () => {
      spyOn(WebexCredentialManager.prototype, 'requestDeviceCode').mockResolvedValue({
        deviceCode: 'd',
        userCode: 'u',
        verificationUri: 'https://v',
        verificationUriComplete: 'https://vc',
        expiresIn: 300,
        interval: 0.01,
      })
      spyOn(WebexCredentialManager.prototype, 'pollDeviceToken').mockResolvedValue({
        accessToken: 'at',
        refreshToken: 'rt',
        expiresAt: Date.now() + 3600000,
      })
      const saveSpy = spyOn(WebexCredentialManager.prototype, 'saveConfig').mockResolvedValue(undefined)
      spyOn(WebexClient.prototype, 'login').mockResolvedValue(new WebexClient())
      spyOn(WebexClient.prototype, 'testAuth').mockResolvedValue(mockPerson)

      await loginAction({ clientId: 'my-id', clientSecret: 'my-secret', pretty: false })

      const savedConfig = saveSpy.mock.calls[0][0] as { tokenType: string }
      expect(savedConfig.tokenType).toBe('oauth')
    })

    test('saves clientId and clientSecret in config', async () => {
      spyOn(WebexCredentialManager.prototype, 'requestDeviceCode').mockResolvedValue({
        deviceCode: 'd',
        userCode: 'u',
        verificationUri: 'https://v',
        verificationUriComplete: 'https://vc',
        expiresIn: 300,
        interval: 0.01,
      })
      spyOn(WebexCredentialManager.prototype, 'pollDeviceToken').mockResolvedValue({
        accessToken: 'at',
        refreshToken: 'rt',
        expiresAt: Date.now() + 3600000,
      })
      spyOn(WebexCredentialManager.prototype, 'saveConfig').mockResolvedValue(undefined)
      spyOn(WebexClient.prototype, 'login').mockResolvedValue(new WebexClient())
      spyOn(WebexClient.prototype, 'testAuth').mockResolvedValue(mockPerson)

      await loginAction({ clientId: 'my-id', clientSecret: 'my-secret', pretty: false })

      const savedConfig = (WebexCredentialManager.prototype.saveConfig as ReturnType<typeof spyOn>).mock.calls[0][0] as { clientId: string; clientSecret: string }
      expect(savedConfig.clientId).toBe('my-id')
      expect(savedConfig.clientSecret).toBe('my-secret')
    })
  })

  describe('statusAction', () => {
    test('shows authenticated status when token is valid', async () => {
      spyOn(WebexCredentialManager.prototype, 'loadConfig').mockResolvedValue(null)
      spyOn(WebexCredentialManager.prototype, 'getToken').mockResolvedValue('valid-token')
      spyOn(WebexClient.prototype, 'login').mockResolvedValue(new WebexClient())
      spyOn(WebexClient.prototype, 'testAuth').mockResolvedValue(mockPerson)

      await statusAction({ pretty: false })

      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string)
      expect(output.authenticated).toBe(true)
      expect(output.user.displayName).toBe('Test User')
    })

    test('shows not authenticated when no token', async () => {
      spyOn(WebexCredentialManager.prototype, 'loadConfig').mockResolvedValue(null)
      spyOn(WebexCredentialManager.prototype, 'getToken').mockResolvedValue(null)
      const exitSpy = spyOn(process, 'exit').mockImplementation(() => undefined as never)

      await statusAction({ pretty: false })

      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string)
      expect(output.error).toContain('Not authenticated')
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    test('shows not authenticated when token validation fails', async () => {
      spyOn(WebexCredentialManager.prototype, 'loadConfig').mockResolvedValue(null)
      spyOn(WebexCredentialManager.prototype, 'getToken').mockResolvedValue('invalid-token')
      spyOn(WebexClient.prototype, 'login').mockResolvedValue(new WebexClient())
      spyOn(WebexClient.prototype, 'testAuth').mockRejectedValue(new Error('401 Unauthorized'))

      await statusAction({ pretty: false })

      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string)
      expect(output.authenticated).toBe(false)
    })

    test('loads config for stored client credentials', async () => {
      spyOn(WebexCredentialManager.prototype, 'loadConfig').mockResolvedValue({
        accessToken: 'at',
        refreshToken: 'rt',
        expiresAt: Date.now() + 3600000,
        clientId: 'stored-id',
        clientSecret: 'stored-secret',
      })
      spyOn(WebexCredentialManager.prototype, 'getToken').mockResolvedValue('valid-token')
      spyOn(WebexClient.prototype, 'login').mockResolvedValue(new WebexClient())
      spyOn(WebexClient.prototype, 'testAuth').mockResolvedValue(mockPerson)

      await statusAction({ pretty: false })

      expect(WebexCredentialManager.prototype.getToken).toHaveBeenCalledWith('stored-id', 'stored-secret')
    })
  })

  describe('logoutAction', () => {
    test('clears credentials when authenticated', async () => {
      spyOn(WebexCredentialManager.prototype, 'loadConfig').mockResolvedValue({
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: Date.now() + 3600000,
      })
      const clearSpy = spyOn(WebexCredentialManager.prototype, 'clearCredentials').mockResolvedValue(undefined)

      await logoutAction({ pretty: false })

      expect(clearSpy).toHaveBeenCalled()
      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string)
      expect(output.success).toBe(true)
    })

    test('shows error when not authenticated', async () => {
      spyOn(WebexCredentialManager.prototype, 'loadConfig').mockResolvedValue(null)
      const exitSpy = spyOn(process, 'exit').mockImplementation(() => undefined as never)

      await logoutAction({ pretty: false })

      const output = JSON.parse(consoleSpy.mock.calls[0][0] as string)
      expect(output.error).toContain('Not authenticated')
      expect(exitSpy).toHaveBeenCalledWith(1)
    })
  })
})
