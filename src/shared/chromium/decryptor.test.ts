import { beforeEach, describe, expect, spyOn, it } from 'bun:test'
import { createCipheriv, pbkdf2Sync, randomBytes } from 'node:crypto'

import * as linuxKeyring from '@/shared/utils/linux-keyring'

import { BROWSER_KEYCHAIN_VARIANTS } from './browsers'
import { ChromiumCookieDecryptor } from './decryptor'

function encryptAESCBC(value: string, key: Buffer, prefix = 'v10'): Buffer {
  const iv = Buffer.alloc(16, 0x20)
  const cipher = createCipheriv('aes-128-cbc', key, iv)
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return Buffer.concat([Buffer.from(prefix), ciphertext])
}

function encryptAESGCM(value: string, key: Buffer, prefix = 'v10'): Buffer {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([Buffer.from(prefix), iv, ciphertext, authTag])
}

describe('ChromiumCookieDecryptor', () => {
  let peanutsKey: Buffer

  beforeEach(() => {
    peanutsKey = pbkdf2Sync('peanuts', 'saltysalt', 1, 16, 'sha1')
  })

  describe('constructor', () => {
    it('prepends appKeychainVariants before browser variants', () => {
      // given
      const appVariants = [{ service: 'App Safe Storage', account: 'App' }]

      // when
      const decryptor = new ChromiumCookieDecryptor({ platform: 'darwin', appKeychainVariants: appVariants })

      // then
      expect((decryptor as any).keychainVariants).toEqual([...appVariants, ...BROWSER_KEYCHAIN_VARIANTS])
    })

    it('uses only browser variants when no appKeychainVariants provided', () => {
      // given
      const decryptor = new ChromiumCookieDecryptor({ platform: 'darwin' })

      // then
      expect((decryptor as any).keychainVariants).toEqual(BROWSER_KEYCHAIN_VARIANTS)
    })
  })

  describe('isEncryptedValue', () => {
    it('returns true for v10 prefix with sufficient length', () => {
      // given
      const decryptor = new ChromiumCookieDecryptor({ platform: 'linux' })

      // when
      const result = decryptor.isEncryptedValue(Buffer.from('v10x'))

      // then
      expect(result).toBe(true)
    })

    it('returns true for v11 prefix with sufficient length', () => {
      // given
      const decryptor = new ChromiumCookieDecryptor({ platform: 'linux' })

      // when
      const result = decryptor.isEncryptedValue(Buffer.from('v11x'))

      // then
      expect(result).toBe(true)
    })

    it('returns false for non-v10/v11 prefix', () => {
      // given
      const decryptor = new ChromiumCookieDecryptor({ platform: 'linux' })

      // when
      const result = decryptor.isEncryptedValue(Buffer.from('abcde'))

      // then
      expect(result).toBe(false)
    })

    it('returns false for too-short buffer (< 4 bytes)', () => {
      // given
      const decryptor = new ChromiumCookieDecryptor({ platform: 'linux' })

      // when
      const result = decryptor.isEncryptedValue(Buffer.from('v10'))

      // then
      expect(result).toBe(false)
    })

    it('returns false for null/empty buffer', () => {
      // given
      const decryptor = new ChromiumCookieDecryptor({ platform: 'linux' })

      // when/then
      expect(decryptor.isEncryptedValue(Buffer.alloc(0))).toBe(false)
      expect(decryptor.isEncryptedValue(null as unknown as Buffer)).toBe(false)
    })
  })

  describe('decryptAESCBC / decryptAESCBCRaw', () => {
    it('decrypts v10-prefixed AES-128-CBC data with correct key', () => {
      // given
      const decryptor = new ChromiumCookieDecryptor({ platform: 'linux' })
      const encrypted = encryptAESCBC('test-value', peanutsKey)

      // when
      const result = decryptor.decryptAESCBC(encrypted, peanutsKey)

      // then
      expect(result).toBe('test-value')
    })

    it('returns null with wrong key', () => {
      // given
      const decryptor = new ChromiumCookieDecryptor({ platform: 'linux' })
      const encrypted = encryptAESCBC('test-value', peanutsKey)
      const wrongKey = pbkdf2Sync('wrong-password', 'saltysalt', 1, 16, 'sha1')

      // when
      const result = decryptor.decryptAESCBC(encrypted, wrongKey)

      // then
      expect(result).toBeNull()
    })

    it('returns null for corrupted ciphertext', () => {
      // given
      const decryptor = new ChromiumCookieDecryptor({ platform: 'linux' })
      const encrypted = encryptAESCBC('test-value', peanutsKey)
      const corrupted = Buffer.from(encrypted)
      corrupted[corrupted.length - 1] ^= 0xff

      // when
      const result = decryptor.decryptAESCBC(corrupted, peanutsKey)

      // then
      expect(result).toBeNull()
    })

    it('decryptAESCBC returns string, decryptAESCBCRaw returns Buffer', () => {
      // given
      const decryptor = new ChromiumCookieDecryptor({ platform: 'linux' })
      const encrypted = encryptAESCBC('test-value', peanutsKey)

      // when
      const stringResult = decryptor.decryptAESCBC(encrypted, peanutsKey)
      const rawResult = decryptor.decryptAESCBCRaw(encrypted, peanutsKey)

      // then
      expect(stringResult).toBe('test-value')
      expect(rawResult).toEqual(Buffer.from('test-value'))
    })
  })

  describe('decryptAESGCM / decryptAESGCMRaw', () => {
    it('decrypts v10-prefixed AES-256-GCM data with correct key', () => {
      // given
      const decryptor = new ChromiumCookieDecryptor({ platform: 'win32' })
      const masterKey = randomBytes(32)
      const encrypted = encryptAESGCM('test-value', masterKey)

      // when
      const result = decryptor.decryptAESGCM(encrypted, masterKey)

      // then
      expect(result).toBe('test-value')
    })

    it('returns null with wrong key', () => {
      // given
      const decryptor = new ChromiumCookieDecryptor({ platform: 'win32' })
      const masterKey = randomBytes(32)
      const encrypted = encryptAESGCM('test-value', masterKey)

      // when
      const result = decryptor.decryptAESGCM(encrypted, randomBytes(32))

      // then
      expect(result).toBeNull()
    })

    it('returns null for data shorter than minimum length (3+12+16 = 31 bytes)', () => {
      // given
      const decryptor = new ChromiumCookieDecryptor({ platform: 'win32' })

      // when
      const result = decryptor.decryptAESGCM(Buffer.alloc(30), randomBytes(32))

      // then
      expect(result).toBeNull()
    })

    it('decryptAESGCM returns string, decryptAESGCMRaw returns Buffer', () => {
      // given
      const decryptor = new ChromiumCookieDecryptor({ platform: 'win32' })
      const masterKey = randomBytes(32)
      const encrypted = encryptAESGCM('test-value', masterKey)

      // when
      const stringResult = decryptor.decryptAESGCM(encrypted, masterKey)
      const rawResult = decryptor.decryptAESGCMRaw(encrypted, masterKey)

      // then
      expect(stringResult).toBe('test-value')
      expect(rawResult).toEqual(Buffer.from('test-value'))
    })
  })

  describe('decryptCookie / decryptCookieRaw', () => {
    it('returns plaintext for non-encrypted values (no v10/v11 prefix)', () => {
      // given
      const decryptor = new ChromiumCookieDecryptor({ platform: 'linux' })
      const plaintext = Buffer.from('plain-cookie')

      // when
      const stringResult = decryptor.decryptCookie(plaintext)
      const rawResult = decryptor.decryptCookieRaw(plaintext)

      // then
      expect(stringResult).toBe('plain-cookie')
      expect(rawResult).toEqual(plaintext)
    })

    it('dispatches to Linux decryption for linux platform with v10 prefix', () => {
      // given
      const decryptor = new ChromiumCookieDecryptor({ platform: 'linux' })
      const encrypted = Buffer.from('v10cookie')
      const spy = spyOn(decryptor, 'decryptLinuxCookieRaw')

      // when
      decryptor.decryptCookieRaw(encrypted)

      // then
      expect(spy).toHaveBeenCalledWith(encrypted)
      spy.mockRestore()
    })

    it('returns null for unsupported platform (e.g. freebsd)', () => {
      // given
      const decryptor = new ChromiumCookieDecryptor({ platform: 'freebsd' as NodeJS.Platform })

      // when
      const result = decryptor.decryptCookie(Buffer.from('v10cookie'))

      // then
      expect(result).toBeNull()
    })

    it('decryptCookie returns string, decryptCookieRaw returns Buffer', () => {
      // given
      const decryptor = new ChromiumCookieDecryptor({ platform: 'linux' })
      const encrypted = encryptAESCBC('test-value', peanutsKey)

      // when
      const stringResult = decryptor.decryptCookie(encrypted)
      const rawResult = decryptor.decryptCookieRaw(encrypted)

      // then
      expect(stringResult).toBe('test-value')
      expect(rawResult).toEqual(Buffer.from('test-value'))
    })
  })

  describe('decryptLinuxCookieRaw', () => {
    it('decrypts v10-prefixed cookie using peanuts key (known key, verifiable)', () => {
      // given
      const decryptor = new ChromiumCookieDecryptor({ platform: 'linux' })
      const encrypted = encryptAESCBC('linux-cookie', peanutsKey)

      // when
      const result = decryptor.decryptLinuxCookieRaw(encrypted)

      // then
      expect(result).toEqual(Buffer.from('linux-cookie'))
    })

    it('falls back to peanuts key for v11 when no keyring app names configured', () => {
      // given
      const decryptor = new ChromiumCookieDecryptor({ platform: 'linux' })
      const encrypted = encryptAESCBC('linux-v11-cookie', peanutsKey, 'v11')

      // when
      const result = decryptor.decryptLinuxCookieRaw(encrypted)

      // then
      expect(result).toEqual(Buffer.from('linux-v11-cookie'))
    })
  })

  describe('decryptDPAPI', () => {
    it('returns null on non-win32 platforms', () => {
      // given
      const decryptor = new ChromiumCookieDecryptor({ platform: 'linux' })

      // when
      const result = decryptor.decryptDPAPI(Buffer.from('encrypted'))

      // then
      expect(result).toBeNull()
    })
  })

  describe('extractDPAPIPayload', () => {
    it('extracts payload wrapped in markers', () => {
      // given
      const b64 = Buffer.from('hello').toString('base64')
      const stdout = `<<<B64>>>${b64}<<<END>>>\r\n`

      // when
      const result = ChromiumCookieDecryptor.extractDPAPIPayload(stdout)

      // then
      expect(result).toBe(b64)
    })

    it('strips CLIXML progress-stream contamination before the payload', () => {
      // given: PowerShell emits CLIXML on first module auto-load
      const b64 = Buffer.from('secret-token').toString('base64')
      const stdout =
        '#< CLIXML\r\n' +
        '<Objs Version="1.1.0.1" xmlns="http://schemas.microsoft.com/powershell/2004/04">' +
        '<Obj S="progress" RefId="0"><TN RefId="0"><T>System.Management.Automation.PSCustomObject</T>' +
        '<T>System.Object</T></TN><MS><I64 N="SourceId">1</I64><PR N="Record">' +
        '<AV>Preparing modules for first use.</AV><AI>0</AI><Nil /><PI>-1</PI><PC>-1</PC>' +
        '<T>Completed</T><SR>-1</SR><SD> </SD></PR></MS></Obj></Objs>' +
        `<<<B64>>>${b64}<<<END>>>\r\n`

      // when
      const result = ChromiumCookieDecryptor.extractDPAPIPayload(stdout)

      // then
      expect(result).toBe(b64)
    })

    it('tolerates whitespace and line breaks inside the payload', () => {
      // given
      const b64 = Buffer.from('hello').toString('base64')
      const chunked = b64.slice(0, 3) + '\r\n' + b64.slice(3)
      const stdout = `<<<B64>>>${chunked}<<<END>>>`

      // when
      const result = ChromiumCookieDecryptor.extractDPAPIPayload(stdout)

      // then
      expect(result).toBe(b64)
    })

    it('returns null when markers are missing', () => {
      // given: stdout contains only CLIXML noise, no real payload
      const stdout = '#< CLIXML\r\n<Objs></Objs>\r\n'

      // when
      const result = ChromiumCookieDecryptor.extractDPAPIPayload(stdout)

      // then
      expect(result).toBeNull()
    })

    it('returns null when payload between markers is empty', () => {
      // when
      const result = ChromiumCookieDecryptor.extractDPAPIPayload('<<<B64>>><<<END>>>')

      // then
      expect(result).toBeNull()
    })
  })

  describe('stripIntegrityHash', () => {
    it('returns input unchanged when length <= 32', () => {
      // given
      const decrypted = Buffer.alloc(32, 0x41)

      // when
      const result = ChromiumCookieDecryptor.stripIntegrityHash(decrypted)

      // then
      expect(result).toEqual(decrypted)
    })

    it('strips first 32 bytes when they contain non-printable characters', () => {
      // given
      const hash = Buffer.concat([Buffer.from([0x00, 0x1f, 0xff]), Buffer.alloc(29, 0x01)])
      const value = Buffer.from('cookie-value')

      // when
      const result = ChromiumCookieDecryptor.stripIntegrityHash(Buffer.concat([hash, value]))

      // then
      expect(result).toEqual(value)
    })

    it('returns input unchanged when first 32 bytes are all printable ASCII', () => {
      // given
      const printablePrefix = Buffer.from('12345678901234567890123456789012')
      const decrypted = Buffer.concat([printablePrefix, Buffer.from('cookie-value')])

      // when
      const result = ChromiumCookieDecryptor.stripIntegrityHash(decrypted)

      // then
      expect(result).toEqual(decrypted)
    })

    it('correctly strips binary hash prefix followed by readable cookie value', () => {
      // given
      const hash = randomBytes(32)
      const value = Buffer.from('readable-cookie-value')

      // when
      const result = ChromiumCookieDecryptor.stripIntegrityHash(Buffer.concat([hash, value]))

      // then
      expect(result).toEqual(value)
    })

    it('handles non-printable bytes that would be mangled by UTF-8 conversion (the v130+ fix)', () => {
      // given
      const binaryPrefix = Buffer.from([
        ...Array.from({ length: 16 }, (_, i) => i),
        ...Array.from({ length: 16 }, (_, i) => 0x80 + i),
      ])
      const value = Buffer.from('v130-cookie-value')

      // when
      const result = ChromiumCookieDecryptor.stripIntegrityHash(Buffer.concat([binaryPrefix, value]))

      // then
      expect(result).toEqual(value)
    })
  })

  describe('loadCachedKey / clearKeyCache', () => {
    it('loadCachedKey is no-op on non-darwin platform', async () => {
      // given
      const keyCache = {
        get: async () => Buffer.from('should-not-be-used'),
        clear: async () => {},
      }
      const decryptor = new ChromiumCookieDecryptor({
        platform: 'linux',
        keyCache: keyCache as any,
        keyCachePlatform: 'slack',
      })

      // when
      await decryptor.loadCachedKey()

      // then
      expect((decryptor as any).cachedKey).toBeNull()
      expect((decryptor as any).usedCachedKey).toBe(false)
    })

    it('loadCachedKey is no-op when no keyCache configured', async () => {
      // given
      const decryptor = new ChromiumCookieDecryptor({ platform: 'darwin', keyCachePlatform: 'slack' })

      // when
      await decryptor.loadCachedKey()

      // then
      expect((decryptor as any).cachedKey).toBeNull()
      expect((decryptor as any).usedCachedKey).toBe(false)
    })

    it('clearKeyCache resets cached key state', async () => {
      // given
      const clear = async () => {}
      const keyCache = { get: async () => null, clear }
      const decryptor = new ChromiumCookieDecryptor({
        platform: 'darwin',
        keyCache: keyCache as any,
        keyCachePlatform: 'slack',
      })
      ;(decryptor as any).cachedKey = Buffer.from('cached-key')
      ;(decryptor as any).usedCachedKey = true

      // when
      await decryptor.clearKeyCache()

      // then
      expect((decryptor as any).cachedKey).toBeNull()
      expect((decryptor as any).usedCachedKey).toBe(false)
    })
  })

  describe('linux v11 keyring behavior', () => {
    it('uses configured keyring password before falling back', () => {
      // given
      const password = 'secret-from-keyring'
      const key = pbkdf2Sync(password, 'saltysalt', 1, 16, 'sha1')
      const spy = spyOn(linuxKeyring, 'lookupLinuxKeyringPassword').mockImplementation(() => password)
      const decryptor = new ChromiumCookieDecryptor({
        platform: 'linux',
        linuxKeyringAppNames: ['Discord'],
      })
      const encrypted = encryptAESCBC('linux-keyring-cookie', key, 'v11')

      // when
      const result = decryptor.decryptLinuxCookieRaw(encrypted)

      // then
      expect(spy).toHaveBeenCalledWith('Discord')
      expect(result).toEqual(Buffer.from('linux-keyring-cookie'))
      spy.mockRestore()
    })
  })
})
