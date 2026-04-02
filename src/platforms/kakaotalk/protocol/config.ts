// Protocol constants for KakaoTalk LOCO.
// See protocol/NOTICE.md for attribution of protocol knowledge.

import type { KakaoDeviceType } from '../types'

// LOCO RSA public key (PKCS#1 DER, base64). RSA-2048, e=3.
// Source: openkakao (MIT) — extracted from KakaoTalk macOS binary.
export const LOCO_RSA_PUBLIC_KEY_DER_B64 =
  'MIIBCAKCAQEAo7B26MRFhR8ZpnDCMarG20Lv0JcX0GBIpcxWkGzRqye53zf/1QF+' +
  'fBOhQFtdHD5IeaakmdPGGKckcrC1DKXvHvbupwNp2UE/5mLY4rR5qfchQu5wzubCr' +
  'RIEXVKyXEogSiiWjjfwumpJ7j7J8qx6ZRhBYPIvYsQ6QGfNjSpvE9m4KYqwAnY9I' +
  '2ydGHnX/OW4+pEIgrIeFSR+DQokeRMI5RmDYUQC6foDBXxX6eF4scw5/mcojvxGG' +
  'UXLyqEdH8wSPnULhh8NRH6+PBFfQRpC3JXdsh2kJ3SlvLHd9/pfEGKAEMdPNvMcQ' +
  'O/P4on9gbq6RKZVamwwEhBBS2Ajw/RjcQIBAw=='

export const BOOKING_HOST = 'booking-loco.kakao.com'
export const BOOKING_PORT = 443

export const CHECKIN_HOST = 'ticket-loco.kakao.com'
export const CHECKIN_PORT = 995

// PC slot identity — platform-aware: 'win' on Windows, 'mac' on macOS
const PC_APP_VERSION = '26.2.0'
const PC_OS: string = process.platform === 'win32' ? 'win' : 'mac'
export const PC_OS_NAME: string = process.platform === 'win32' ? 'Windows' : 'macOS'

// Android (tablet slot) identity — must match the Android sub-device agent
// used in auth/kakao-login.ts so the server sees a consistent tablet session.
const ANDROID_APP_VERSION = '25.9.2'
const ANDROID_OS = 'android'

// dtype: 2 = sub-device, 1 = main device (ref: node-kakao config.ts)
export const DTYPE = 2
export const MCCMNC = '99999'
export const LANG = 'ko'
export const COUNTRY_ISO = 'KR'
export const PROTOCOL_VERSION = '1'

export const PING_INTERVAL_MS = 300_000

export interface LocoDeviceConfig {
  os: string
  appVersion: string
  useSub: boolean
}

export function getLocoDeviceConfig(deviceType: KakaoDeviceType): LocoDeviceConfig {
  if (deviceType === 'tablet') {
    return { os: ANDROID_OS, appVersion: ANDROID_APP_VERSION, useSub: true }
  }
  return { os: PC_OS, appVersion: PC_APP_VERSION, useSub: false }
}
