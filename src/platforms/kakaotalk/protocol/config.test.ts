import { expect, it } from 'bun:test'

import { createMessagingTlsOptions } from './config'

it('selects the measured profiles without disabling SNI or restricting TLS to 1.3', () => {
  for (const [platform, node, openssl, count] of [
    ['linux', '24.14.1', '3.5.5', 3],
    ['darwin', '26.13.0', '4.1.0', 4],
  ] as const) {
    const options = createMessagingTlsOptions(platform, node, openssl)
    expect(options.servername).toBe('kakao.com')
    expect(options.ecdhCurve).toBe('X25519:P-256:P-384')
    expect(options.requestOCSP).toBe(true)
    expect(options.sigalgs?.split(':')).toHaveLength(count)
    expect(options.ciphers?.split(':')).toHaveLength(9)
    expect(options.minVersion).toBeUndefined()
    expect(options.rejectUnauthorized).not.toBe(false)
  }
})

it('preserves the previous offer for unmeasured builds and other platforms', () => {
  for (const runtime of [
    ['linux', '24.14.2', '3.5.5'],
    ['darwin', '26.13.0', '4.1.1'],
    ['win32', '24.14.1', '3.5.5'],
  ] as const) {
    const options = createMessagingTlsOptions(...runtime)
    expect(options.sigalgs).toBeUndefined()
    expect(options.requestOCSP).toBeUndefined()
    expect(options.servername).toBe('kakao.com')
    expect(options.ciphers?.split(':').slice(0, 3)).toEqual([
      'TLS_AES_128_GCM_SHA256',
      'TLS_AES_256_GCM_SHA384',
      'TLS_CHACHA20_POLY1305_SHA256',
    ])
  }
})
