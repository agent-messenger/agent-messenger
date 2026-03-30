import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'

import { WebexClient } from './client'
import { WebexCredentialManager } from './credential-manager'
import { ensureWebexAuth } from './ensure-auth'

let getTokenSpy: ReturnType<typeof spyOn>
let loginSpy: ReturnType<typeof spyOn>
let testAuthSpy: ReturnType<typeof spyOn>

beforeEach(() => {
  getTokenSpy = spyOn(WebexCredentialManager.prototype, 'getToken').mockResolvedValue(null)
  loginSpy = spyOn(WebexClient.prototype, 'login').mockResolvedValue({} as WebexClient)
  testAuthSpy = spyOn(WebexClient.prototype, 'testAuth').mockResolvedValue({
    id: 'user-123',
    displayName: 'Test User',
    emails: ['test@example.com'],
    type: 'person',
  })
})

afterEach(() => {
  getTokenSpy?.mockRestore()
  loginSpy?.mockRestore()
  testAuthSpy?.mockRestore()
})

describe('ensureWebexAuth', () => {
  test('does nothing when no token stored', async () => {
    // given
    getTokenSpy.mockResolvedValue(null)

    // when
    await ensureWebexAuth()

    // then
    expect(testAuthSpy).not.toHaveBeenCalled()
  })

  test('validates token when stored', async () => {
    // given
    getTokenSpy.mockResolvedValue('test-webex-token')

    // when
    await ensureWebexAuth()

    // then
    expect(loginSpy).toHaveBeenCalledWith({ token: 'test-webex-token' })
    expect(testAuthSpy).toHaveBeenCalled()
  })

  test('does not throw when token validation fails', async () => {
    // given
    getTokenSpy.mockResolvedValue('invalid-token')
    testAuthSpy.mockRejectedValue(new Error('401 Unauthorized'))

    // when / then
    await expect(ensureWebexAuth()).resolves.toBeUndefined()
  })

  test('does not throw when credential manager fails', async () => {
    // given
    getTokenSpy.mockRejectedValue(new Error('Disk read error'))

    // when / then
    await expect(ensureWebexAuth()).resolves.toBeUndefined()
  })
})
