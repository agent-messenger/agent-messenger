import type { KakaoAuthErrorCode } from '../types'
import type { LoginListResponse, LocoPacket } from './types'

export class KakaoLoginResponseError extends Error {
  readonly code: KakaoAuthErrorCode
  readonly serverStatus: number

  constructor(code: KakaoAuthErrorCode, serverStatus: number) {
    const reason = code === 'invalid_access_token' ? 'invalid access token' : 'login rejected'
    super(`KakaoTalk LOGINLIST ${reason} (status ${serverStatus})`)
    this.name = 'KakaoLoginResponseError'
    this.code = code
    this.serverStatus = serverStatus
  }
}

export function validateLoginListResponse(response: LocoPacket): LoginListResponse {
  if (response.statusCode !== 0) {
    throw new KakaoLoginResponseError('login_rejected', response.statusCode)
  }

  const bodyStatus = typeof response.body.status === 'number' ? response.body.status : 0
  if (bodyStatus === -950) {
    throw new KakaoLoginResponseError('invalid_access_token', bodyStatus)
  }
  if (bodyStatus !== 0) {
    throw new KakaoLoginResponseError('login_rejected', bodyStatus)
  }

  return response.body as unknown as LoginListResponse
}
