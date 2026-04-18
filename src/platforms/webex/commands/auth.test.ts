import { afterEach, beforeEach, describe, expect, spyOn, it } from 'bun:test'
import * as childProcess from 'node:child_process'

import { WebexClient } from '../client'
import { WebexCredentialManager } from '../credential-manager'
import { WebexTokenExtractor } from '../token-extractor'
import { WebexError } from '../types'
import { extractAction, loginAction, logoutAction, statusAction } from './auth'

describe('auth commands', () => {
  let consoleSpy: ReturnType<typeof spyOn>
  let consoleErrorSpy: ReturnType<typeof spyOn>
  let execSpy: ReturnType<typeof spyOn>
  const protoSpies: ReturnType<typeof spyOn>[] = []
  const mockPerson = {
    id: 'person-1',
    displayName: 'Test User',
    emails: ['test@example.com'],
    orgId: 'org-1',
    type: 'person' as const,
    created: '2024-01-01T00:00:00.000Z',
  }

  function protoSpy<T extends object>(target: T, method: keyof T) {
    const s = spyOn(target, method as any)
    protoSpies.push(s)
    return s
  }

  beforeEach(() => {
    consoleSpy = spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {})
    execSpy = spyOn(childProcess, 'exec').mockImplementation((() => {}) as any)
  })

  afterEach(() => {
    consoleSpy.mockRestore()
    consoleErrorSpy.mockRestore()
    execSpy.mockRestore()
    for (const s of protoSpies) s.mockRestore()
    protoSpies.length = 0
  })

  describe('loginAction with --token', () => {
    it('authenticates with provided token (bot token flow)', async () => {
      protoSpy(WebexClient.prototype, 'login').mockResolvedValue(new WebexClient())
      protoSpy(WebexClient.prototype, 'testAuth').mockResolvedValue(mockPerson)
      protoSpy(WebexCredentialManager.prototype, 'saveConfig').mockResolvedValue(undefined)

      await loginAction({ token: 'bot-token-123', pretty: false })

      expect(consoleSpy).toHaveBeenCalled()
      const lastCall = consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1][0] as string
      const output = JSON.parse(lastCall)
      expect(output.authenticated).toBe(true)
      expect(output.user.displayName).toBe('Test User')
    })

    it('saves tokenType as manual with expiresAt 0', async () => {
      protoSpy(WebexClient.prototype, 'login').mockResolvedValue(new WebexClient())
      protoSpy(WebexClient.prototype, 'testAuth').mockResolvedValue(mockPerson)
      const saveSpy = protoSpy(WebexCredentialManager.prototype, 'saveConfig').mockResolvedValue(undefined)

      await loginAction({ token: 'bot-token-123', pretty: false })

      const savedConfig = saveSpy.mock.calls[0][0] as { tokenType: string; expiresAt: number; refreshToken: string }
      expect(savedConfig.tokenType).toBe('manual')
      expect(savedConfig.expiresAt).toBe(0)
      expect(savedConfig.refreshToken).toBe('')
    })
  })

  describe('loginAction with --client-id and --client-secret', () => {
    it('uses provided credentials for Device Grant flow', async () => {
      protoSpy(WebexCredentialManager.prototype, 'requestDeviceCode').mockResolvedValue({
        deviceCode: 'd',
        userCode: 'u',
        verificationUri: 'https://v',
        verificationUriComplete: 'https://vc',
        expiresIn: 300,
        interval: 0.01,
      })
      protoSpy(WebexCredentialManager.prototype, 'pollDeviceToken').mockResolvedValue({
        accessToken: 'at',
        refreshToken: 'rt',
        expiresAt: Date.now() + 3600000,
      })
      protoSpy(WebexCredentialManager.prototype, 'saveConfig').mockResolvedValue(undefined)
      protoSpy(WebexClient.prototype, 'login').mockResolvedValue(new WebexClient())
      protoSpy(WebexClient.prototype, 'testAuth').mockResolvedValue(mockPerson)

      await loginAction({ clientId: 'my-id', clientSecret: 'my-secret', pretty: false })

      expect(WebexCredentialManager.prototype.requestDeviceCode).toHaveBeenCalledWith('my-id')
      expect(WebexCredentialManager.prototype.pollDeviceToken).toHaveBeenCalledWith(
        'd',
        0.01,
        300,
        'my-id',
        'my-secret',
      )
    })

    it('saves tokenType as oauth in config', async () => {
      protoSpy(WebexCredentialManager.prototype, 'requestDeviceCode').mockResolvedValue({
        deviceCode: 'd',
        userCode: 'u',
        verificationUri: 'https://v',
        verificationUriComplete: 'https://vc',
        expiresIn: 300,
        interval: 0.01,
      })
      protoSpy(WebexCredentialManager.prototype, 'pollDeviceToken').mockResolvedValue({
        accessToken: 'at',
        refreshToken: 'rt',
        expiresAt: Date.now() + 3600000,
      })
      const saveSpy = protoSpy(WebexCredentialManager.prototype, 'saveConfig').mockResolvedValue(undefined)
      protoSpy(WebexClient.prototype, 'login').mockResolvedValue(new WebexClient())
      protoSpy(WebexClient.prototype, 'testAuth').mockResolvedValue(mockPerson)

      await loginAction({ clientId: 'my-id', clientSecret: 'my-secret', pretty: false })

      const savedConfig = saveSpy.mock.calls[0][0] as { tokenType: string }
      expect(savedConfig.tokenType).toBe('oauth')
    })

    it('saves clientId and clientSecret in config', async () => {
      protoSpy(WebexCredentialManager.prototype, 'requestDeviceCode').mockResolvedValue({
        deviceCode: 'd',
        userCode: 'u',
        verificationUri: 'https://v',
        verificationUriComplete: 'https://vc',
        expiresIn: 300,
        interval: 0.01,
      })
      protoSpy(WebexCredentialManager.prototype, 'pollDeviceToken').mockResolvedValue({
        accessToken: 'at',
        refreshToken: 'rt',
        expiresAt: Date.now() + 3600000,
      })
      const saveSpy = protoSpy(WebexCredentialManager.prototype, 'saveConfig').mockResolvedValue(undefined)
      protoSpy(WebexClient.prototype, 'login').mockResolvedValue(new WebexClient())
      protoSpy(WebexClient.prototype, 'testAuth').mockResolvedValue(mockPerson)

      await loginAction({ clientId: 'my-id', clientSecret: 'my-secret', pretty: false })

      const savedConfig = saveSpy.mock.calls[0][0] as { clientId: string; clientSecret: string }
      expect(savedConfig.clientId).toBe('my-id')
      expect(savedConfig.clientSecret).toBe('my-secret')
    })
  })

  describe('statusAction', () => {
    it('shows authenticated status when token is valid', async () => {
      protoSpy(WebexCredentialManager.prototype, 'loadConfig').mockResolvedValue(null)
      protoSpy(WebexCredentialManager.prototype, 'getToken').mockResolvedValue('valid-token')
      protoSpy(WebexClient.prototype, 'login').mockResolvedValue(new WebexClient())
      protoSpy(WebexClient.prototype, 'testAuth').mockResolvedValue(mockPerson)

      await statusAction({ pretty: false })

      const lastCall = consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1][0] as string
      const output = JSON.parse(lastCall)
      expect(output.authenticated).toBe(true)
      expect(output.user.displayName).toBe('Test User')
    })

    it('shows not authenticated when no token', async () => {
      protoSpy(WebexCredentialManager.prototype, 'loadConfig').mockResolvedValue(null)
      protoSpy(WebexCredentialManager.prototype, 'getToken').mockResolvedValue(null)
      const exitSpy = protoSpy(process, 'exit').mockImplementation(() => undefined as never)

      await statusAction({ pretty: false })

      const lastCall = consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1][0] as string
      const output = JSON.parse(lastCall)
      expect(output.error).toContain('Not authenticated')
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    it('shows not authenticated when token validation fails', async () => {
      protoSpy(WebexCredentialManager.prototype, 'loadConfig').mockResolvedValue(null)
      protoSpy(WebexCredentialManager.prototype, 'getToken').mockResolvedValue('invalid-token')
      protoSpy(WebexClient.prototype, 'login').mockResolvedValue(new WebexClient())
      protoSpy(WebexClient.prototype, 'testAuth').mockRejectedValue(new Error('401 Unauthorized'))

      await statusAction({ pretty: false })

      const lastCall = consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1][0] as string
      const output = JSON.parse(lastCall)
      expect(output.authenticated).toBe(false)
    })

    it('loads config for stored client credentials', async () => {
      protoSpy(WebexCredentialManager.prototype, 'loadConfig').mockResolvedValue({
        accessToken: 'at',
        refreshToken: 'rt',
        expiresAt: Date.now() + 3600000,
        clientId: 'stored-id',
        clientSecret: 'stored-secret',
      })
      protoSpy(WebexCredentialManager.prototype, 'getToken').mockResolvedValue('valid-token')
      protoSpy(WebexClient.prototype, 'login').mockResolvedValue(new WebexClient())
      protoSpy(WebexClient.prototype, 'testAuth').mockResolvedValue(mockPerson)

      await statusAction({ pretty: false })

      expect(WebexCredentialManager.prototype.getToken).toHaveBeenCalledWith('stored-id', 'stored-secret')
    })
  })

  describe('extractAction', () => {
    it('passes deviceUrl and tokenType to client.login', async () => {
      protoSpy(WebexTokenExtractor.prototype, 'extract').mockResolvedValue({
        accessToken: 'extracted-token-at-least-twenty-chars',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 3600000,
        deviceUrl: 'https://wdm-r.wbx2.com/wdm/api/v1/devices/test-device-id',
        userId: 'user-1',
      })
      const loginSpy = protoSpy(WebexClient.prototype, 'login').mockResolvedValue(new WebexClient())
      protoSpy(WebexClient.prototype, 'testAuth').mockResolvedValue(mockPerson)
      protoSpy(WebexCredentialManager.prototype, 'saveConfig').mockResolvedValue(undefined)

      await extractAction({ pretty: false })

      expect(loginSpy).toHaveBeenCalledWith({
        token: 'extracted-token-at-least-twenty-chars',
        deviceUrl: 'https://wdm-r.wbx2.com/wdm/api/v1/devices/test-device-id',
        tokenType: 'extracted',
      })
    })

    it('attempts refresh when token is expired', async () => {
      protoSpy(WebexTokenExtractor.prototype, 'extract').mockResolvedValue({
        accessToken: 'expired-token-at-least-twenty-chars-',
        refreshToken: 'valid-refresh-token',
        expiresAt: Date.now() - 7200000,
      })
      const refreshSpy = protoSpy(WebexCredentialManager.prototype, 'refreshToken').mockResolvedValue({
        accessToken: 'refreshed-token-at-least-twenty-ch',
        refreshToken: 'new-refresh',
        expiresAt: Date.now() + 3600000,
      })
      const loginSpy = protoSpy(WebexClient.prototype, 'login').mockResolvedValue(new WebexClient())
      protoSpy(WebexClient.prototype, 'testAuth').mockResolvedValue(mockPerson)
      protoSpy(WebexCredentialManager.prototype, 'saveConfig').mockResolvedValue(undefined)

      await extractAction({ pretty: false })

      expect(refreshSpy).toHaveBeenCalled()
      expect(loginSpy).toHaveBeenCalledWith(expect.objectContaining({ token: 'refreshed-token-at-least-twenty-ch' }))
      const lastCall = consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1][0] as string
      const output = JSON.parse(lastCall)
      expect(output.authenticated).toBe(true)
      expect(output.refreshed).toBe(true)
    })

    it('reports expired token with actionable hint when refresh fails', async () => {
      protoSpy(WebexTokenExtractor.prototype, 'extract').mockResolvedValue({
        accessToken: 'expired-token-at-least-twenty-chars-',
        refreshToken: 'bad-refresh-token',
        expiresAt: Date.now() - 7200000,
      })
      protoSpy(WebexCredentialManager.prototype, 'refreshToken').mockResolvedValue(null)
      protoSpy(WebexClient.prototype, 'login').mockResolvedValue(new WebexClient())
      protoSpy(WebexClient.prototype, 'testAuth').mockRejectedValue(new WebexError('Unauthorized', 'http_401'))
      const exitSpy = protoSpy(process, 'exit').mockImplementation(() => undefined as never)

      await extractAction({ pretty: false })

      const lastCall = consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1][0] as string
      const output = JSON.parse(lastCall)
      expect(output.error).toContain('expired')
      expect(output.hint).toContain('web.webex.com')
      expect(output.hint).toContain('not webex.com')
      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    it('rethrows non-auth errors even when token is expired', async () => {
      protoSpy(WebexTokenExtractor.prototype, 'extract').mockResolvedValue({
        accessToken: 'expired-token-at-least-twenty-chars-',
        refreshToken: 'bad-refresh-token',
        expiresAt: Date.now() - 7200000,
      })
      protoSpy(WebexCredentialManager.prototype, 'refreshToken').mockResolvedValue(null)
      protoSpy(WebexClient.prototype, 'login').mockResolvedValue(new WebexClient())
      protoSpy(WebexClient.prototype, 'testAuth').mockRejectedValue(new Error('Network error'))
      protoSpy(process, 'exit').mockImplementation(() => undefined as never)

      await extractAction({ pretty: false })

      const lastCall = consoleErrorSpy.mock.calls[consoleErrorSpy.mock.calls.length - 1]?.[0] as string | undefined
      if (lastCall) {
        const output = JSON.parse(lastCall)
        expect(output.error).toContain('Network error')
      }
    })

    it('rethrows non-expiry auth errors', async () => {
      protoSpy(WebexTokenExtractor.prototype, 'extract').mockResolvedValue({
        accessToken: 'valid-token-at-least-twenty-chars-xx',
        expiresAt: Date.now() + 3600000,
      })
      protoSpy(WebexClient.prototype, 'login').mockResolvedValue(new WebexClient())
      protoSpy(WebexClient.prototype, 'testAuth').mockRejectedValue(new Error('Network error'))
      protoSpy(process, 'exit').mockImplementation(() => undefined as never)

      await extractAction({ pretty: false })

      const lastCall = consoleErrorSpy.mock.calls[consoleErrorSpy.mock.calls.length - 1]?.[0] as string | undefined
      if (lastCall) {
        const output = JSON.parse(lastCall)
        expect(output.error).toContain('Network error')
      }
    })

    it('outputs no token found when extract returns null', async () => {
      protoSpy(WebexTokenExtractor.prototype, 'extract').mockResolvedValue(null)
      const exitSpy = protoSpy(process, 'exit').mockImplementation(() => undefined as never)

      await extractAction({ pretty: false })

      const lastCall = consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1][0] as string
      const output = JSON.parse(lastCall)
      expect(output.error).toContain('No Webex token found')
      expect(exitSpy).toHaveBeenCalledWith(1)
    })
  })

  describe('logoutAction', () => {
    it('clears credentials when authenticated', async () => {
      protoSpy(WebexCredentialManager.prototype, 'loadConfig').mockResolvedValue({
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: Date.now() + 3600000,
      })
      const clearSpy = protoSpy(WebexCredentialManager.prototype, 'clearCredentials').mockResolvedValue(undefined)

      await logoutAction({ pretty: false })

      expect(clearSpy).toHaveBeenCalled()
      const lastCall = consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1][0] as string
      const output = JSON.parse(lastCall)
      expect(output.success).toBe(true)
    })

    it('shows error when not authenticated', async () => {
      protoSpy(WebexCredentialManager.prototype, 'loadConfig').mockResolvedValue(null)
      const exitSpy = protoSpy(process, 'exit').mockImplementation(() => undefined as never)

      await logoutAction({ pretty: false })

      const lastCall = consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1][0] as string
      const output = JSON.parse(lastCall)
      expect(output.error).toContain('Not authenticated')
      expect(exitSpy).toHaveBeenCalledWith(1)
    })
  })
})
