export {}

declare module 'node-jose' {
  namespace JWE {
    interface JWERecipient {
      key: JWK.Key
      header?: Record<string, string | null>
      reference?: string | null | boolean
    }

    function createEncrypt(options: EncryptOptions, recipient: JWERecipient): Encryptor

    interface Encryptor {
      final(data: string | Buffer, encoding?: BufferEncoding): Promise<string>
    }

    function createDecrypt(key: JWK.Key): Decryptor

    interface Decryptor {
      decrypt(input: string | Buffer): Promise<DecryptResult>
    }

    interface DecryptResult {
      plaintext: Buffer
    }
  }
}
