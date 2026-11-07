import { DEFAULT_CIPHERS, type ConnectionOptions, type TLSSocketOptions } from 'node:tls'
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

export const PING_INTERVAL_MS = 20_000

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

// Android tablet messaging supports TLS on this port. Booking, checkin and
// media-upload transports keep their existing paths.
export const MESSAGING_TLS_PORT = 10009
const DEFAULT_MESSAGING_TLS_OPTIONS: ConnectionOptions = {
  servername: 'kakao.com',
  ecdhCurve: 'X25519:P-256:P-384',
  ciphers: [
    'TLS_AES_128_GCM_SHA256',
    'TLS_AES_256_GCM_SHA384',
    'TLS_CHACHA20_POLY1305_SHA256',
    ...DEFAULT_CIPHERS.split(':').filter((cipher) => !cipher.startsWith('TLS_')),
  ].join(':'),
}

// These exact runtime profiles produced a 228-byte ClientHello in wire tests.
// Do not assume another Node/OpenSSL build has the same extension encoding.
export function createMessagingTlsOptions(
  platform: string = process.platform,
  node: string = process.versions.node,
  openssl: string = process.versions.openssl,
): ConnectionOptions & Pick<TLSSocketOptions, 'requestOCSP'> {
  const signatures =
    platform === 'linux' && node === '24.14.1' && openssl === '3.5.5'
      ? ['ecdsa_secp256r1_sha256', 'rsa_pss_rsae_sha256', 'rsa_pkcs1_sha256']
      : platform === 'darwin' && node === '26.13.0' && openssl === '4.1.0'
        ? ['ecdsa_secp256r1_sha256', 'rsa_pss_rsae_sha256', 'rsa_pkcs1_sha256', 'rsa_pss_pss_sha256']
        : undefined
  if (!signatures) return { ...DEFAULT_MESSAGING_TLS_OPTIONS }
  return {
    ...DEFAULT_MESSAGING_TLS_OPTIONS,
    requestOCSP: true,
    sigalgs: signatures.join(':'),
    ciphers: [
      'TLS_AES_128_GCM_SHA256',
      'TLS_AES_256_GCM_SHA384',
      'TLS_CHACHA20_POLY1305_SHA256',
      'ECDHE-ECDSA-AES128-GCM-SHA256',
      'ECDHE-ECDSA-AES256-GCM-SHA384',
      'ECDHE-ECDSA-CHACHA20-POLY1305',
      'ECDHE-RSA-AES128-GCM-SHA256',
      'ECDHE-RSA-AES256-GCM-SHA384',
      'ECDHE-RSA-CHACHA20-POLY1305',
    ].join(':'),
  }
}

export const MESSAGING_TLS_OPTIONS = createMessagingTlsOptions()
