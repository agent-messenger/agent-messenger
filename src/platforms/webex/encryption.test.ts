import { describe, expect, it } from 'bun:test'

import * as jose from 'node-jose'

import { WebexEncryptionService } from './encryption'

const decodeJweHeader = (jwe: string): Record<string, unknown> => {
  const [header = ''] = jwe.split('.')
  const padded = header + '='.repeat((4 - (header.length % 4)) % 4)
  const json = Buffer.from(padded, 'base64url').toString('utf8')
  return JSON.parse(json) as Record<string, unknown>
}

const createKeyring = async (keyUri: string) => {
  const keystore = jose.JWK.createKeyStore()
  const key = await keystore.generate('oct', 256, { alg: 'A256GCM' })
  const jwk = key.toJSON(true)
  const rawKeys = new Map<string, string>()
  rawKeys.set(keyUri, JSON.stringify({ jwk }))
  return new WebexEncryptionService(rawKeys)
}

describe('WebexEncryptionService', () => {
  const keyUri = 'kms://kms-aore.wbx2.com/keys/7819829b-5e0d-4139-9cad-1b6fe7aee533'

  it('encryptText emits JWE with alg, enc, and kid JOSE headers', async () => {
    const service = await createKeyring(keyUri)

    const jwe = await service.encryptText(keyUri, 'hello world')

    expect(jwe).not.toBeNull()
    const header = decodeJweHeader(jwe as string)
    expect(header.alg).toBe('dir')
    expect(header.enc).toBe('A256GCM')
    expect(header.kid).toBe(keyUri)
  })

  it('encryptText returns null when key is unknown', async () => {
    const service = await createKeyring(keyUri)

    const jwe = await service.encryptText('kms://other/keys/missing', 'hello')

    expect(jwe).toBeNull()
  })

  it('decryptText round-trips plaintext encrypted by encryptText', async () => {
    const service = await createKeyring(keyUri)

    const jwe = await service.encryptText(keyUri, 'round trip')
    const plaintext = await service.decryptText(keyUri, jwe as string)

    expect(plaintext).toBe('round trip')
  })
})
