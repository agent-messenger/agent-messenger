import * as jose from 'node-jose'

export class WebexEncryptionService {
  private rawKeys: Map<string, string>
  private keyCache: Map<string, jose.JWK.Key> = new Map()

  constructor(serializedKeys: Map<string, string>) {
    this.rawKeys = serializedKeys
  }

  async getKey(keyUri: string): Promise<jose.JWK.Key | null> {
    const cached = this.keyCache.get(keyUri)
    if (cached) return cached

    const raw = this.rawKeys.get(keyUri)
    if (!raw) return null

    try {
      const parsed = JSON.parse(raw) as { jwk: object }
      const joseKey = await jose.JWK.asKey(parsed.jwk)
      this.keyCache.set(keyUri, joseKey)
      return joseKey
    } catch {
      return null
    }
  }

  async encryptText(keyUri: string, plaintext: string): Promise<string | null> {
    const key = await this.getKey(keyUri)
    if (!key) return null

    try {
      // Webex desktop/web clients auto-tombstone edit activities whose JWE is missing
      // `kid` — they can't resolve the KMS key and treat the activity as malformed.
      return await jose.JWE.createEncrypt(
        { format: 'compact', contentAlg: 'A256GCM' },
        { key, header: { alg: 'dir', kid: keyUri }, reference: null },
      ).final(plaintext, 'utf8')
    } catch {
      return null
    }
  }

  async decryptText(keyUri: string, ciphertext: string): Promise<string | null> {
    const key = await this.getKey(keyUri)
    if (!key) return null

    try {
      const result = await jose.JWE.createDecrypt(key).decrypt(ciphertext)
      return result.plaintext.toString('utf8')
    } catch {
      return null
    }
  }
}
