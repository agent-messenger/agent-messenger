import { createHash, randomUUID } from 'node:crypto'

import { ANDROID_AGENT, ANDROID_USER_AGENT } from './kakao-login'

const ANDROID_OAUTH_REFRESH_URL = 'https://katalk.kakao.com/android/account/oauth2_token.json'
const DEFAULT_REFRESH_TIMEOUT_MS = 15_000

export type KakaoOAuthRefreshErrorCode =
  | 'refresh_credentials_missing'
  | 'refresh_http_error'
  | 'refresh_malformed_response'
  | 'refresh_rejected'
  | 'refresh_request_failed'
  | 'refresh_timeout'

export class KakaoOAuthRefreshError extends Error {
  readonly code: KakaoOAuthRefreshErrorCode
  readonly serverStatus?: number
  readonly httpStatus?: number

  constructor(code: KakaoOAuthRefreshErrorCode, options?: { serverStatus?: number; httpStatus?: number }) {
    super(`KakaoTalk OAuth token refresh failed (${code})`)
    this.name = 'KakaoOAuthRefreshError'
    this.code = code
    this.serverStatus = options?.serverStatus
    this.httpStatus = options?.httpStatus
  }
}

export interface KakaoOAuthRefreshInput {
  accessToken: string
  refreshToken: string
  deviceUuid: string
}

export interface KakaoOAuthRefreshResult {
  accessToken: string
  refreshToken: string
  tokenType?: string
  expiresIn?: number
}

export interface KakaoOAuthRefreshOptions {
  fetchImpl?: typeof fetch
  requestId?: () => string
  timeoutMs?: number
}

function buildDeviceId(deviceUuid: string): string {
  if (/^[a-f0-9]{40,64}$/i.test(deviceUuid)) return deviceUuid
  return createHash('sha256').update(`dkljleskljfeisflssljeif ${deviceUuid}`, 'utf8').digest('hex')
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function transportError(error: unknown, signal: AbortSignal): KakaoOAuthRefreshError {
  const timedOut = signal.aborted || (error instanceof Error && error.name === 'AbortError')
  return new KakaoOAuthRefreshError(timedOut ? 'refresh_timeout' : 'refresh_request_failed')
}

export async function refreshKakaoOAuthToken(
  input: KakaoOAuthRefreshInput,
  options: KakaoOAuthRefreshOptions = {},
): Promise<KakaoOAuthRefreshResult> {
  if (!input.accessToken || !input.refreshToken || !input.deviceUuid) {
    throw new KakaoOAuthRefreshError('refresh_credentials_missing')
  }

  const fetchImpl = options.fetchImpl ?? fetch
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_REFRESH_TIMEOUT_MS)

  try {
    let response: Response
    try {
      response = await fetchImpl(ANDROID_OAUTH_REFRESH_URL, {
        method: 'POST',
        headers: {
          A: ANDROID_AGENT,
          Authorization: `${input.accessToken}-${buildDeviceId(input.deviceUuid)}`,
          'User-Agent': ANDROID_USER_AGENT,
          'Accept-Language': 'ko',
          'Content-Type': 'application/json; charset=utf-8',
          C: (options.requestId ?? randomUUID)(),
          Connection: 'Close',
        },
        body: JSON.stringify({
          access_token: input.accessToken,
          refresh_token: input.refreshToken,
          grant_type: 'refresh_token',
        }),
        signal: controller.signal,
      })
    } catch (error) {
      throw transportError(error, controller.signal)
    }

    let body: Record<string, unknown> | null
    try {
      body = readRecord(await response.json())
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw transportError(error, controller.signal)
      body = null
    }

    const serverStatus = body && typeof body.status === 'number' ? body.status : undefined
    if (!response.ok) {
      throw new KakaoOAuthRefreshError(
        serverStatus !== undefined && serverStatus !== 0 ? 'refresh_rejected' : 'refresh_http_error',
        { serverStatus: serverStatus !== 0 ? serverStatus : undefined, httpStatus: response.status },
      )
    }

    if (!body) {
      throw new KakaoOAuthRefreshError('refresh_malformed_response', { httpStatus: response.status })
    }

    if (serverStatus !== undefined && serverStatus !== 0) {
      throw new KakaoOAuthRefreshError('refresh_rejected', {
        serverStatus,
        httpStatus: response.status,
      })
    }

    const accessToken = typeof body.access_token === 'string' ? body.access_token : ''
    if (!accessToken) {
      throw new KakaoOAuthRefreshError('refresh_malformed_response', { httpStatus: response.status })
    }

    return {
      accessToken,
      refreshToken:
        typeof body.refresh_token === 'string' && body.refresh_token ? body.refresh_token : input.refreshToken,
      tokenType: typeof body.token_type === 'string' && body.token_type ? body.token_type : undefined,
      expiresIn: typeof body.expires_in === 'number' ? body.expires_in : undefined,
    }
  } finally {
    clearTimeout(timeout)
  }
}
