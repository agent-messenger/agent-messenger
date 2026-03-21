import { constants, createCipheriv, createDecipheriv, createPublicKey, publicEncrypt, randomBytes } from 'node:crypto'

import {
  GCM_NONCE_SIZE,
  GCM_TAG_SIZE,
  HANDSHAKE_ENCRYPT_TYPE,
  HANDSHAKE_KEY_ENCRYPT_TYPE,
  HANDSHAKE_KEY_SIZE,
} from './types'
import { LOCO_RSA_PUBLIC_KEY_DER_B64 } from './config'

export class LocoCrypto {
  private aesKey: Buffer

  constructor(aesKey?: Buffer) {
    this.aesKey = aesKey ?? randomBytes(16)
  }

  buildHandshakePacket(): Buffer {
    // PKCS#1 DER → SPKI PEM so Node.js crypto can import it
    const pkcs1Der = Buffer.from(LOCO_RSA_PUBLIC_KEY_DER_B64, 'base64')
    const publicKey = createPublicKey({ key: pkcs1Der, format: 'der', type: 'pkcs1' })

    const encryptedKey = publicEncrypt(
      { key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha1' },
      this.aesKey,
    )

    // Handshake: [key_size: 4 LE][key_encrypt_type: 4 LE][encrypt_type: 4 LE][encrypted_key: 256]
    const buf = Buffer.alloc(12 + encryptedKey.length)
    buf.writeUInt32LE(HANDSHAKE_KEY_SIZE, 0)
    buf.writeUInt32LE(HANDSHAKE_KEY_ENCRYPT_TYPE, 4)
    buf.writeUInt32LE(HANDSHAKE_ENCRYPT_TYPE, 8)
    encryptedKey.copy(buf, 12)
    return buf
  }

  // Wire format: [size: 4 LE][nonce: 12][ciphertext + GCM tag]
  encrypt(plaintext: Buffer): Buffer {
    const nonce = randomBytes(GCM_NONCE_SIZE)

    const cipher = createCipheriv('aes-128-gcm', this.aesKey, nonce)
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()])
    const tag = cipher.getAuthTag()

    const bodyLen = GCM_NONCE_SIZE + encrypted.length + tag.length
    const buf = Buffer.alloc(4 + bodyLen)
    buf.writeUInt32LE(bodyLen, 0)
    nonce.copy(buf, 4)
    encrypted.copy(buf, 4 + GCM_NONCE_SIZE)
    tag.copy(buf, 4 + GCM_NONCE_SIZE + encrypted.length)
    return buf
  }

  // Input: body after 4-byte size prefix — [nonce: 12][ciphertext + tag]
  decrypt(data: Buffer): Buffer {
    if (data.length < GCM_NONCE_SIZE + GCM_TAG_SIZE) {
      throw new Error(`GCM data too short: ${data.length} bytes`)
    }

    const nonce = data.subarray(0, GCM_NONCE_SIZE)
    const ciphertextWithTag = data.subarray(GCM_NONCE_SIZE)
    const tagStart = ciphertextWithTag.length - GCM_TAG_SIZE
    const ciphertext = ciphertextWithTag.subarray(0, tagStart)
    const tag = ciphertextWithTag.subarray(tagStart)

    const decipher = createDecipheriv('aes-128-gcm', this.aesKey, nonce)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()])
  }
}
