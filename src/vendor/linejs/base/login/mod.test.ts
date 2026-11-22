import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test'

import { Login } from './mod.js'

describe('Login.requestSQR2', () => {
  let logSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    logSpy = spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    logSpy.mockRestore()
  })

  it('does not print the token response (access/refresh tokens) to stdout', async () => {
    // given: a QR login that completes with a token response
    const tokenInfo = { 1: 'access-token-secret', 2: 'refresh-token-secret', 3: 1, 6: 1 }
    const stored: Record<string, unknown> = {}
    const client = {
      emit: mock(() => {}),
      storage: { set: mock(async (k: string, v: unknown) => void (stored[k] = v)) },
      e2ee: { createSqrSecret: () => ['secret', '?secret=x&e2eeVersion=1'], decodeE2EEKeyV1: mock(async () => {}) },
    }
    const login = new Login(client as never)
    Object.assign(login, {
      createSession: async () => ({ 1: 'sqr' }),
      createQrCode: async () => ({ 1: 'https://line.me/R/au/lgn/sq/x' }),
      checkQrCodeVerified: async () => true,
      verifyCertificate: async () => {},
      getQrCert: async () => 'cert',
      qrCodeLoginV2: async () => ({ 3: tokenInfo, 4: 'u-mid' }),
    })

    // when
    const authToken = await login.requestSQR2()

    // then: the access token is returned and the refresh token stored, but nothing is printed
    expect(authToken).toBe('access-token-secret')
    expect(stored.refreshToken).toBe('refresh-token-secret')
    expect(logSpy).not.toHaveBeenCalled()
  })
})
