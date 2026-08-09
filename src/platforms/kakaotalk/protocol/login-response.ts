import type { KakaoAuthErrorCode } from '../types'
import type { LoginListResponse, LocoPacket } from './types'

const CONNECTION_CLOSED_STATUS = -1
const INVALID_ACCESS_TOKEN_STATUS = -950

export class KakaoLoginResponseError extends Error {
  readonly code: KakaoAuthErrorCode
  readonly serverStatus: number

  constructor(code: KakaoAuthErrorCode, serverStatus: number) {
    const reason = code === 'invalid_access_token' ? 'invalid access token' : 'rejected'
    super(`KakaoTalk LOGINLIST ${reason} (status ${serverStatus})`)
    this.name = 'KakaoLoginResponseError'
    this.code = code
    this.serverStatus = serverStatus
  }
}

function isSyntheticConnectionClose(response: LocoPacket): boolean {
  return response.statusCode === CONNECTION_CLOSED_STATUS && response.body.error === 'connection closed'
}

function throwAuthenticationError(serverStatus: number): never {
  const code: KakaoAuthErrorCode =
    serverStatus === INVALID_ACCESS_TOKEN_STATUS ? 'invalid_access_token' : 'login_rejected'
  throw new KakaoLoginResponseError(code, serverStatus)
}

export function validateLoginListResponse(response: LocoPacket): LoginListResponse {
  if (isSyntheticConnectionClose(response)) {
    throw new Error('KakaoTalk LOGINLIST transport failed: connection closed')
  }

  const bodyStatus = typeof response.body.status === 'number' ? response.body.status : 0
  if (bodyStatus !== 0) throwAuthenticationError(bodyStatus)
  if (response.statusCode !== 0) throwAuthenticationError(response.statusCode)

  return response.body as unknown as LoginListResponse
}
