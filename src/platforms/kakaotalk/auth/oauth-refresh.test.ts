import { describe, expect, it, mock } from 'bun:test'

import { KakaoOAuthRefreshError, refreshKakaoOAuthToken } from './oauth-refresh'

const HEX_DEVICE_UUID = 'a'.repeat(64)
const credentials = {
  accessToken: 'access-secret',
  refreshToken: 'refresh-secret',
  deviceUuid: HEX_DEVICE_UUID,
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function captureError(promise: Promise<unknown>): Promise<KakaoOAuthRefreshError> {
  return promise.then(
    () => {
      throw new Error('Expected refresh to fail')
    },
    (error: unknown) => {
      expect(error).toBeInstanceOf(KakaoOAuthRefreshError)
      return error as KakaoOAuthRefreshError
    },
  )
}

function expectSecretsRedacted(error: Error, ...secrets: string[]): void {
  const rendered = `${String(error)}\n${error.stack ?? ''}\n${JSON.stringify(error)}`
  for (const secret of secrets) {
    expect(rendered).not.toContain(secret)
  }
}

describe('refreshKakaoOAuthToken', () => {
  it('sends the Android sub-device refresh request and returns rotated tokens', async () => {
    const fetchImpl = mock(async () =>
      jsonResponse({
        status: 0,
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        token_type: 'bearer',
        expires_in: 3600,
      }),
    )

    const result = await refreshKakaoOAuthToken(credentials, {
      fetchImpl,
      requestId: () => 'request-id',
    })

    expect(result).toEqual({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      tokenType: 'bearer',
      expiresIn: 3600,
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://katalk.kakao.com/android/account/oauth2_token.json')
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({
      A: 'android/25.9.2/ko',
      Authorization: `access-secret-${HEX_DEVICE_UUID}`,
      'User-Agent': 'KT/25.9.2 An/13 ko',
      'Accept-Language': 'ko',
      'Content-Type': 'application/json; charset=utf-8',
      C: 'request-id',
      Connection: 'Close',
    })
    expect(JSON.parse(String(init.body))).toEqual({
      access_token: credentials.accessToken,
      refresh_token: credentials.refreshToken,
      grant_type: 'refresh_token',
    })
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('derives the Android device id for a non-hex UUID', async () => {
    const fetchImpl = mock(async () => jsonResponse({ status: 0, access_token: 'new-access' }))

    await refreshKakaoOAuthToken({ ...credentials, deviceUuid: 'device-uuid' }, { fetchImpl })

    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(init.headers).toMatchObject({
      Authorization: 'access-secret-db214b8bbba42ef7a5fbc4c1bbba91305178ade87b29f1378f55b69fc04caac5',
    })
  })

  it('preserves the input refresh token when Kakao does not rotate it', async () => {
    const fetchImpl = mock(async () => jsonResponse({ status: 0, access_token: 'new-access' }))

    await expect(refreshKakaoOAuthToken(credentials, { fetchImpl })).resolves.toEqual({
      accessToken: 'new-access',
      refreshToken: credentials.refreshToken,
      tokenType: undefined,
      expiresIn: undefined,
    })
  })

  it('rejects missing credentials before making a request', async () => {
    const fetchImpl = mock(async () => jsonResponse({ status: 0, access_token: 'unused' }))

    const error = await captureError(refreshKakaoOAuthToken({ ...credentials, refreshToken: '' }, { fetchImpl }))

    expect(error).toMatchObject({ code: 'refresh_credentials_missing' })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('classifies a Kakao rejection with safe status metadata', async () => {
    const fetchImpl = mock(async () =>
      jsonResponse({ status: -950, message: 'rejected', raw: 'raw-response-secret' }, 401),
    )

    const error = await captureError(refreshKakaoOAuthToken(credentials, { fetchImpl }))

    expect(error).toMatchObject({ code: 'refresh_rejected', serverStatus: -950, httpStatus: 401 })
    expectSecretsRedacted(error, credentials.accessToken, credentials.refreshToken, 'raw-response-secret')
  })

  it('classifies an HTTP failure without a Kakao status', async () => {
    const fetchImpl = mock(async () => jsonResponse({ message: 'unavailable' }, 503))

    const error = await captureError(refreshKakaoOAuthToken(credentials, { fetchImpl }))

    expect(error).toMatchObject({ code: 'refresh_http_error', httpStatus: 503 })
    expect(error.serverStatus).toBeUndefined()
  })

  it('rejects a malformed successful response without exposing the body', async () => {
    const fetchImpl = mock(async () => jsonResponse({ status: 0, access_token: '', raw: 'do-not-log' }))

    const error = await captureError(refreshKakaoOAuthToken(credentials, { fetchImpl }))

    expect(error).toMatchObject({ code: 'refresh_malformed_response', httpStatus: 200 })
    expectSecretsRedacted(error, credentials.accessToken, credentials.refreshToken, 'do-not-log')
  })

  it('rejects a non-JSON response without exposing its text', async () => {
    const fetchImpl = mock(async () => new Response('body-secret', { status: 200 }))

    const error = await captureError(refreshKakaoOAuthToken(credentials, { fetchImpl }))

    expect(error).toMatchObject({ code: 'refresh_malformed_response', httpStatus: 200 })
    expectSecretsRedacted(error, credentials.accessToken, credentials.refreshToken, 'body-secret')
  })

  it('aborts a request after the configured timeout', async () => {
    const fetchImpl = mock(
      async (_url: string | URL | Request, init?: RequestInit): Promise<Response> =>
        await new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(Object.assign(new Error('timed out with access-secret'), { name: 'AbortError' }))
          })
        }),
    )

    const error = await captureError(refreshKakaoOAuthToken(credentials, { fetchImpl, timeoutMs: 5 }))

    expect(error).toMatchObject({ code: 'refresh_timeout' })
    expectSecretsRedacted(error, credentials.accessToken, credentials.refreshToken)
  })

  it('classifies network failures without retaining a secret-bearing cause', async () => {
    const fetchImpl = mock(async () => {
      throw new Error(`network failure ${credentials.accessToken} ${credentials.refreshToken}`)
    })

    const error = await captureError(refreshKakaoOAuthToken(credentials, { fetchImpl }))

    expect(error).toMatchObject({ code: 'refresh_request_failed' })
    expect(error.cause).toBeUndefined()
    expectSecretsRedacted(error, credentials.accessToken, credentials.refreshToken)
  })
})
