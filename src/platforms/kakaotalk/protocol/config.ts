// Protocol constants for KakaoTalk LOCO.
// See protocol/NOTICE.md for attribution of protocol knowledge.

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

export const APP_VERSION = '26.2.0'
export const OS = 'mac'
export const DTYPE = 2
export const MCCMNC = '99999'
export const LANG = 'ko'
export const COUNTRY_ISO = 'KR'
export const PROTOCOL_VERSION = '1'

export const PING_INTERVAL_MS = 300_000
