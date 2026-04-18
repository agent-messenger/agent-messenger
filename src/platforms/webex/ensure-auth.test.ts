import { afterEach, beforeEach, describe, expect, spyOn, it } from 'bun:test'

import { WebexClient } from './client'
import { WebexCredentialManager } from './credential-manager'
import { ensureWebexAuth } from './ensure-auth'
import { WebexTokenExtractor } from './token-extractor'

let loadConfigSpy: ReturnType<typeof spyOn>
let getTokenSpy: ReturnType<typeof spyOn>
let loginSpy: ReturnType<typeof spyOn>
let testAuthSpy: ReturnType<typeof spyOn>
let extractSpy: ReturnType<typeof spyOn>

beforeEach(() => {
  loadConfigSpy = spyOn(WebexCredentialManager.prototype, 'loadConfig').mockResolvedValue(null)
  getTokenSpy = spyOn(WebexCredentialManager.prototype, 'getToken').mockResolvedValue(null)
  loginSpy = spyOn(WebexClient.prototype, 'login').mockResolvedValue({} as WebexClient)
  testAuthSpy = spyOn(WebexClient.prototype, 'testAuth').mockResolvedValue({
    id: 'user-123',
    displayName: 'Test User',
    emails: ['test@example.com'],
    type: 'person',
  })
  extractSpy = spyOn(WebexTokenExtractor.prototype, 'extract').mockResolvedValue(null)
})

afterEach(() => {
  loadConfigSpy?.mockRestore()
  getTokenSpy?.mockRestore()
  loginSpy?.mockRestore()
  testAuthSpy?.mockRestore()
  extractSpy?.mockRestore()
})

describe('ensureWebexAuth', () => {
  it('does nothing when no config stored', async () => {
    // given
    loadConfigSpy.mockResolvedValue(null)

    // when
    await ensureWebexAuth()

    // then
    expect(getTokenSpy).not.toHaveBeenCalled()
    expect(testAuthSpy).not.toHaveBeenCalled()
  })

  it('validates token when stored', async () => {
    // given
    loadConfigSpy.mockResolvedValue({
      accessToken: 'test-webex-token',
      refreshToken: 'refresh',
      expiresAt: Date.now() + 3600000,
      clientId: 'stored-id',
      clientSecret: 'stored-secret',
    })
    getTokenSpy.mockResolvedValue('test-webex-token')

    // when
    await ensureWebexAuth()

    // then
    expect(getTokenSpy).toHaveBeenCalledWith('stored-id', 'stored-secret')
    expect(loginSpy).toHaveBeenCalledWith({ token: 'test-webex-token' })
    expect(testAuthSpy).toHaveBeenCalled()
  })

  it('does not throw when token validation fails', async () => {
    // given
    loadConfigSpy.mockResolvedValue({
      accessToken: 'invalid-token',
      refreshToken: 'refresh',
      expiresAt: Date.now() + 3600000,
    })
    getTokenSpy.mockResolvedValue('invalid-token')
    testAuthSpy.mockRejectedValue(new Error('401 Unauthorized'))

    // when / then
    await expect(ensureWebexAuth()).resolves.toBeUndefined()
  })

  it('does not throw when credential manager fails', async () => {
    // given
    getTokenSpy.mockRejectedValue(new Error('Disk read error'))

    // when / then
    await expect(ensureWebexAuth()).resolves.toBeUndefined()
  })
})
