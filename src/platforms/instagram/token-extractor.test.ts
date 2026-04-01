import { beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { InstagramTokenExtractor } from './token-extractor'

describe('InstagramTokenExtractor', () => {
  let extractor: InstagramTokenExtractor

  beforeEach(() => {
    extractor = new InstagramTokenExtractor()
  })

  describe('getBrowserCookiesPaths', () => {
    test('returns darwin paths for all browsers on macOS', () => {
      const darwinExtractor = new InstagramTokenExtractor('darwin')
      const paths = darwinExtractor.getBrowserCookiesPaths()

      const base = join(homedir(), 'Library', 'Application Support')
      expect(paths).toContain(join(base, 'Google', 'Chrome', 'Default', 'Cookies'))
      expect(paths).toContain(join(base, 'Google', 'Chrome', 'Default', 'Network', 'Cookies'))
      expect(paths).toContain(join(base, 'Microsoft Edge', 'Default', 'Cookies'))
      expect(paths).toContain(join(base, 'Arc', 'User Data', 'Default', 'Cookies'))
      expect(paths).toContain(join(base, 'BraveSoftware', 'Brave-Browser', 'Default', 'Cookies'))
      expect(paths).toContain(join(base, 'Vivaldi', 'Default', 'Cookies'))
      expect(paths).toContain(join(base, 'Chromium', 'Default', 'Cookies'))
    })

    test('returns linux paths for supported browsers', () => {
      const linuxExtractor = new InstagramTokenExtractor('linux')
      const paths = linuxExtractor.getBrowserCookiesPaths()

      const base = join(homedir(), '.config')
      expect(paths).toContain(join(base, 'google-chrome', 'Default', 'Cookies'))
      expect(paths).toContain(join(base, 'microsoft-edge', 'Default', 'Cookies'))
      expect(paths).toContain(join(base, 'BraveSoftware', 'Brave-Browser', 'Default', 'Cookies'))
      expect(paths).toContain(join(base, 'vivaldi', 'Default', 'Cookies'))
      expect(paths).toContain(join(base, 'chromium', 'Default', 'Cookies'))
    })

    test('returns win32 paths for all browsers on Windows', () => {
      const winExtractor = new InstagramTokenExtractor('win32')
      const paths = winExtractor.getBrowserCookiesPaths()

      const localAppData = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local')
      expect(paths).toContain(join(localAppData, 'Google', 'Chrome', 'User Data', 'Default', 'Cookies'))
      expect(paths).toContain(join(localAppData, 'Microsoft', 'Edge', 'User Data', 'Default', 'Cookies'))
      expect(paths).toContain(join(localAppData, 'BraveSoftware', 'Brave-Browser', 'User Data', 'Default', 'Cookies'))
    })

    test('returns empty array for unsupported platform', () => {
      const unsupportedExtractor = new InstagramTokenExtractor('freebsd' as NodeJS.Platform)
      const paths = unsupportedExtractor.getBrowserCookiesPaths()
      expect(paths).toEqual([])
    })

    test('includes Network/Cookies variant paths', () => {
      const darwinExtractor = new InstagramTokenExtractor('darwin')
      const paths = darwinExtractor.getBrowserCookiesPaths()

      const base = join(homedir(), 'Library', 'Application Support')
      expect(paths).toContain(join(base, 'Google', 'Chrome', 'Default', 'Network', 'Cookies'))
    })
  })

  describe('getLocalStatePaths', () => {
    test('returns darwin Local State paths for all browsers', () => {
      const darwinExtractor = new InstagramTokenExtractor('darwin')
      const paths = darwinExtractor.getLocalStatePaths()

      const base = join(homedir(), 'Library', 'Application Support')
      expect(paths).toContain(join(base, 'Google', 'Chrome', 'Local State'))
      expect(paths).toContain(join(base, 'Microsoft Edge', 'Local State'))
      expect(paths).toContain(join(base, 'BraveSoftware', 'Brave-Browser', 'Local State'))
    })

    test('returns linux Local State paths for supported browsers', () => {
      const linuxExtractor = new InstagramTokenExtractor('linux')
      const paths = linuxExtractor.getLocalStatePaths()

      const base = join(homedir(), '.config')
      expect(paths).toContain(join(base, 'google-chrome', 'Local State'))
      expect(paths).toContain(join(base, 'microsoft-edge', 'Local State'))
    })

    test('returns win32 Local State paths for all browsers', () => {
      const winExtractor = new InstagramTokenExtractor('win32')
      const paths = winExtractor.getLocalStatePaths()

      const localAppData = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local')
      expect(paths).toContain(join(localAppData, 'Google', 'Chrome', 'User Data', 'Local State'))
      expect(paths).toContain(join(localAppData, 'Microsoft', 'Edge', 'User Data', 'Local State'))
    })
  })

  describe('getKeychainVariants', () => {
    test('returns all Chromium browser keychain variants', () => {
      expect(extractor.getKeychainVariants()).toEqual([
        { service: 'Chrome Safe Storage', account: 'Chrome' },
        { service: 'Chrome Canary Safe Storage', account: 'Chrome Canary' },
        { service: 'Microsoft Edge Safe Storage', account: 'Microsoft Edge' },
        { service: 'Arc Safe Storage', account: 'Arc' },
        { service: 'Brave Safe Storage', account: 'Brave' },
        { service: 'Vivaldi Safe Storage', account: 'Vivaldi' },
        { service: 'Chromium Safe Storage', account: 'Chromium' },
      ])
    })
  })

  describe('isEncryptedValue', () => {
    test('detects v10 encrypted values', () => {
      const encrypted = Buffer.from('v10encrypted_data')
      expect(extractor.isEncryptedValue(encrypted)).toBe(true)
    })

    test('detects v11 encrypted values', () => {
      const encrypted = Buffer.from('v11encrypted_data')
      expect(extractor.isEncryptedValue(encrypted)).toBe(true)
    })

    test('rejects non-encrypted values', () => {
      const plain = Buffer.from('plain_text')
      expect(extractor.isEncryptedValue(plain)).toBe(false)
    })

    test('rejects empty buffers', () => {
      const empty = Buffer.alloc(0)
      expect(extractor.isEncryptedValue(empty)).toBe(false)
    })

    test('rejects short buffers under 4 bytes', () => {
      const short = Buffer.from('v1')
      expect(extractor.isEncryptedValue(short)).toBe(false)
    })
  })

  describe('isValidSessionId', () => {
    test('accepts session IDs of 20 or more chars', () => {
      const valid = 'abcdefghijklmnopqrstu'
      expect(extractor.isValidSessionId(valid)).toBe(true)
    })

    test('accepts long session IDs', () => {
      const valid = 'a'.repeat(100)
      expect(extractor.isValidSessionId(valid)).toBe(true)
    })

    test('rejects session IDs shorter than 20 chars', () => {
      expect(extractor.isValidSessionId('short')).toBe(false)
    })

    test('rejects empty string', () => {
      expect(extractor.isValidSessionId('')).toBe(false)
    })

    test('rejects null and undefined', () => {
      expect(extractor.isValidSessionId(null as unknown as string)).toBe(false)
      expect(extractor.isValidSessionId(undefined as unknown as string)).toBe(false)
    })
  })

  describe('extract', () => {
    test('returns empty array when no cookie paths exist', async () => {
      const linuxExtractor = new InstagramTokenExtractor('linux')
      const spy = spyOn(linuxExtractor as any, 'copyAndExtract').mockResolvedValue(null)

      const result = await linuxExtractor.extract()
      expect(result).toEqual([])

      spy.mockRestore()
    })

    test('returns extracted cookies when found', async () => {
      const mockCookies = {
        sessionid: 'a'.repeat(25),
        ds_user_id: '12345678',
        csrftoken: 'abc123',
        mid: 'some_mid_value',
      }

      const linuxExtractor = new InstagramTokenExtractor('linux')
      const getBrowserCookiesPathsSpy = spyOn(linuxExtractor, 'getBrowserCookiesPaths').mockReturnValue([
        '/fake/path/Cookies',
      ])
      const existsSyncSpy = spyOn(
        await import('node:fs'),
        'existsSync',
      ).mockReturnValue(true)
      const copyAndExtractSpy = spyOn(linuxExtractor as any, 'copyAndExtract').mockResolvedValue(mockCookies)

      const result = await linuxExtractor.extract()
      expect(result).toEqual([mockCookies])

      getBrowserCookiesPathsSpy.mockRestore()
      existsSyncSpy.mockRestore()
      copyAndExtractSpy.mockRestore()
    })

    test('tries next path when first fails', async () => {
      const mockCookies = {
        sessionid: 'a'.repeat(25),
        ds_user_id: '12345678',
        csrftoken: 'abc123',
      }

      const darwinExtractor = new InstagramTokenExtractor('darwin')
      const getBrowserCookiesPathsSpy = spyOn(darwinExtractor, 'getBrowserCookiesPaths').mockReturnValue([
        '/fake/path1/Cookies',
        '/fake/path2/Cookies',
      ])
      const existsSyncSpy = spyOn(
        await import('node:fs'),
        'existsSync',
      ).mockReturnValue(true)
      const copyAndExtractSpy = spyOn(darwinExtractor as any, 'copyAndExtract')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockCookies)

      const result = await darwinExtractor.extract()
      expect(copyAndExtractSpy).toHaveBeenCalledTimes(2)
      expect(result).toEqual([mockCookies])

      getBrowserCookiesPathsSpy.mockRestore()
      existsSyncSpy.mockRestore()
      copyAndExtractSpy.mockRestore()
    })

    test('returns multiple entries when different ds_user_id values found across profiles', async () => {
      const mockCookies1 = {
        sessionid: 'a'.repeat(25),
        ds_user_id: '11111111',
        csrftoken: 'token1',
      }
      const mockCookies2 = {
        sessionid: 'b'.repeat(25),
        ds_user_id: '22222222',
        csrftoken: 'token2',
      }

      const linuxExtractor = new InstagramTokenExtractor('linux')
      const getBrowserCookiesPathsSpy = spyOn(linuxExtractor, 'getBrowserCookiesPaths').mockReturnValue([
        '/fake/profile1/Cookies',
        '/fake/profile2/Cookies',
      ])
      const existsSyncSpy = spyOn(
        await import('node:fs'),
        'existsSync',
      ).mockReturnValue(true)
      const copyAndExtractSpy = spyOn(linuxExtractor as any, 'copyAndExtract')
        .mockResolvedValueOnce(mockCookies1)
        .mockResolvedValueOnce(mockCookies2)

      const result = await linuxExtractor.extract()
      expect(result).toHaveLength(2)
      expect(result[0]?.ds_user_id).toBe('11111111')
      expect(result[1]?.ds_user_id).toBe('22222222')

      getBrowserCookiesPathsSpy.mockRestore()
      existsSyncSpy.mockRestore()
      copyAndExtractSpy.mockRestore()
    })

    test('deduplicates entries with the same ds_user_id across profiles', async () => {
      const mockCookies = {
        sessionid: 'a'.repeat(25),
        ds_user_id: '12345678',
        csrftoken: 'abc123',
      }

      const linuxExtractor = new InstagramTokenExtractor('linux')
      const getBrowserCookiesPathsSpy = spyOn(linuxExtractor, 'getBrowserCookiesPaths').mockReturnValue([
        '/fake/profile1/Cookies',
        '/fake/profile2/Cookies',
      ])
      const existsSyncSpy = spyOn(
        await import('node:fs'),
        'existsSync',
      ).mockReturnValue(true)
      const copyAndExtractSpy = spyOn(linuxExtractor as any, 'copyAndExtract').mockResolvedValue(mockCookies)

      const result = await linuxExtractor.extract()
      expect(result).toHaveLength(1)
      expect(result[0]?.ds_user_id).toBe('12345678')

      getBrowserCookiesPathsSpy.mockRestore()
      existsSyncSpy.mockRestore()
      copyAndExtractSpy.mockRestore()
    })
  })

  describe('copyAndExtract', () => {
    test('returns null when copy fails due to locked database', async () => {
      const darwinExtractor = new InstagramTokenExtractor('darwin')
      const copyFileSpy = spyOn(darwinExtractor as any, 'copyDatabaseToTemp').mockImplementation(() => {
        throw new Error('EBUSY: resource busy or locked')
      })

      const result = await (darwinExtractor as any).copyAndExtract('/path/to/Cookies')
      expect(result).toBeNull()

      copyFileSpy.mockRestore()
    })

    test('cleans up temp file after extraction', async () => {
      const darwinExtractor = new InstagramTokenExtractor('darwin')
      const copyFileSpy = spyOn(darwinExtractor as any, 'copyDatabaseToTemp').mockReturnValue('/tmp/test-cookies')
      const extractSpy = spyOn(darwinExtractor as any, 'extractFromSQLite').mockResolvedValue(null)
      const cleanupSpy = spyOn(darwinExtractor as any, 'cleanupTempFile').mockImplementation(() => {})

      await (darwinExtractor as any).copyAndExtract('/path/to/Cookies')

      expect(copyFileSpy).toHaveBeenCalled()
      expect(cleanupSpy).toHaveBeenCalled()

      copyFileSpy.mockRestore()
      extractSpy.mockRestore()
      cleanupSpy.mockRestore()
    })
  })

  describe('decryption', () => {
    describe('decryptAESGCM', () => {
      test('returns null for data too short for AES-GCM', () => {
        const invalidData = Buffer.from('too_short')
        const key = Buffer.alloc(32, 0)

        const result = (extractor as any).decryptAESGCM(invalidData, key)
        expect(result).toBeNull()
      })

      test('returns null when AES-GCM decryption fails with wrong key', () => {
        const fakeEncrypted = Buffer.concat([
          Buffer.from('v10'),
          Buffer.alloc(12, 1),
          Buffer.alloc(20, 2),
          Buffer.alloc(16, 3),
        ])
        const key = Buffer.alloc(32, 0)

        const result = (extractor as any).decryptAESGCM(fakeEncrypted, key)
        expect(result).toBeNull()
      })
    })

    describe('decryptAESCBC', () => {
      test('strips 32-byte non-printable integrity hash prefix (Chromium v130+)', () => {
        // given — AES-128-CBC encrypted buffer where decrypted result has a 32-byte non-printable prefix
        const { createCipheriv, pbkdf2Sync } = require('node:crypto')
        const key = pbkdf2Sync('peanuts', 'saltysalt', 1, 16, 'sha1')
        const iv = Buffer.alloc(16, 0x20)
        const actualValue = 'test-session-id-value-for-hash-stripping'
        const prefix = Buffer.alloc(32, 0x01) // 32 bytes of non-printable (0x01 < 0x20)
        const plaintext = Buffer.concat([prefix, Buffer.from(actualValue)])

        const cipher = createCipheriv('aes-128-cbc', key, iv)
        const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()])
        const encrypted = Buffer.concat([Buffer.from('v10'), ciphertext])

        // when
        const result = (extractor as any).decryptAESCBC(encrypted, key)

        // then
        expect(result).toBe(actualValue)
      })

      test('returns plaintext as-is when no non-printable prefix detected', () => {
        // given — AES-128-CBC encrypted buffer without integrity hash prefix
        const { createCipheriv, pbkdf2Sync } = require('node:crypto')
        const key = pbkdf2Sync('peanuts', 'saltysalt', 1, 16, 'sha1')
        const iv = Buffer.alloc(16, 0x20)
        const plainValue = 'normal-cookie-value-no-prefix'

        const cipher = createCipheriv('aes-128-cbc', key, iv)
        const ciphertext = Buffer.concat([cipher.update(plainValue, 'utf8'), cipher.final()])
        const encrypted = Buffer.concat([Buffer.from('v10'), ciphertext])

        // when
        const result = (extractor as any).decryptAESCBC(encrypted, key)

        // then
        expect(result).toBe(plainValue)
      })
    })

    describe('getKeychainPassword on macOS', () => {
      test('tries multiple keychain variants until one succeeds', () => {
        const darwinExtractor = new InstagramTokenExtractor('darwin')
        const execSyncSpy = spyOn(darwinExtractor as any, 'execSecurityCommand')
          .mockReturnValueOnce(null)
          .mockReturnValueOnce('test_password')

        const result = (darwinExtractor as any).getKeychainPassword()

        expect(execSyncSpy).toHaveBeenCalledTimes(2)
        expect(result).toBe('test_password')

        execSyncSpy.mockRestore()
      })

      test('returns null when all keychain variants fail', () => {
        const darwinExtractor = new InstagramTokenExtractor('darwin')
        const execSyncSpy = spyOn(darwinExtractor as any, 'execSecurityCommand').mockReturnValue(null)

        const result = (darwinExtractor as any).getKeychainPassword()

        expect(result).toBeNull()

        execSyncSpy.mockRestore()
      })
    })
  })

  describe('SQLite extraction', () => {
    test('returns null when database path does not exist', async () => {
      const result = await (extractor as any).extractFromSQLite('/nonexistent/path', '/nonexistent/path')
      expect(result).toBeNull()
    })

    test('returns null when extraction throws', async () => {
      const result = await (extractor as any).extractFromSQLite('/dev/null', '/dev/null')
      expect(result).toBeNull()
    })
  })
})
