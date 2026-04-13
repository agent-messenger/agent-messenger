import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { createCipheriv, randomBytes } from 'node:crypto'
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ChannelTokenExtractor } from './token-extractor'

describe('ChannelTokenExtractor', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      if (existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true, force: true })
      }
    }
  })

  describe('getAppDataDir', () => {
    test('returns null for unsupported platform', () => {
      const extractor = new ChannelTokenExtractor('freebsd' as NodeJS.Platform)
      expect(extractor.getAppDataDir()).toBeNull()
    })
  })

  describe('getCookiesPath', () => {
    test('returns null for unsupported platform', () => {
      const extractor = new ChannelTokenExtractor('freebsd' as NodeJS.Platform)
      expect(extractor.getCookiesPath()).toBeNull()
    })

    test('returns win32 path under AppData/Roaming/Channel Talk/Network', () => {
      // given
      const tempDir = mkdtempSync(join(tmpdir(), 'channel-win-'))
      tempDirs.push(tempDir)
      const networkDir = join(tempDir, 'Channel Talk', 'Network')
      mkdirSync(networkDir, { recursive: true })
      writeFileSync(join(networkDir, 'Cookies'), '')

      class WinExtractor extends ChannelTokenExtractor {
        constructor() {
          super('win32')
        }

        override getAppDataDir(): string | null {
          return join(tempDir, 'Channel Talk')
        }
      }

      // when
      const extractor = new WinExtractor()
      const path = extractor.getCookiesPath()

      // then
      expect(path).toBe(join(networkDir, 'Cookies'))
    })
  })

  describe('getBrowserCookiesPaths', () => {
    test('returns browser cookie paths on macOS including Default profile', () => {
      const extractor = new ChannelTokenExtractor('darwin')
      const paths = extractor.getBrowserCookiesPaths()

      const chromeBase = join(process.env.HOME || '/tmp', 'Library', 'Application Support', 'Google', 'Chrome')
      expect(paths).toContain(join(chromeBase, 'Default', 'Cookies'))
      expect(paths).toContain(join(chromeBase, 'Default', 'Network', 'Cookies'))
    })

    test('returns browser cookie paths on Linux', () => {
      const extractor = new ChannelTokenExtractor('linux')
      const paths = extractor.getBrowserCookiesPaths()

      const chromeBase = join(process.env.HOME || '/tmp', '.config', 'google-chrome')
      expect(paths).toContain(join(chromeBase, 'Default', 'Cookies'))
    })

    test('returns browser cookie paths on Windows', () => {
      const extractor = new ChannelTokenExtractor('win32')
      const paths = extractor.getBrowserCookiesPaths()

      const localAppData = process.env.LOCALAPPDATA || join(process.env.HOME || '/tmp', 'AppData', 'Local')
      const chromeBase = join(localAppData, 'Google', 'Chrome', 'User Data')
      expect(paths).toContain(join(chromeBase, 'Default', 'Cookies'))
    })

    test('returns empty array for unsupported platform', () => {
      const extractor = new ChannelTokenExtractor('freebsd' as NodeJS.Platform)
      expect(extractor.getBrowserCookiesPaths()).toEqual([])
    })
  })

  describe('extract', () => {
    test('returns empty array when desktop cookies path does not exist', async () => {
      class MissingPathExtractor extends ChannelTokenExtractor {
        override getCookiesPath(): string | null {
          return null
        }
      }

      const extractor = new MissingPathExtractor('darwin')

      expect(await extractor.extract()).toEqual([])
    })

    test('tries desktop app before browser profiles and collects both', async () => {
      const extractor = new ChannelTokenExtractor('darwin')

      const desktopSpy = spyOn(extractor as any, 'extractFromDesktopApp').mockResolvedValue({
        accountCookie: 'desktop-account',
        sessionCookie: 'desktop-session',
      })
      const browserSpy = spyOn(extractor as any, 'extractAllFromBrowserPaths').mockResolvedValue([])

      const result = await extractor.extract()

      expect(desktopSpy).toHaveBeenCalled()
      expect(browserSpy).toHaveBeenCalled()
      expect(result[0]?.accountCookie).toBe('desktop-account')

      desktopSpy.mockRestore()
      browserSpy.mockRestore()
    })

    test('includes browser profiles even when desktop extraction returns null', async () => {
      const extractor = new ChannelTokenExtractor('darwin')

      const desktopSpy = spyOn(extractor as any, 'extractFromDesktopApp').mockResolvedValue(null)
      const browserSpy = spyOn(extractor as any, 'extractAllFromBrowserPaths').mockResolvedValue([
        {
          accountCookie: 'browser-account',
          sessionCookie: undefined,
        },
      ])

      const result = await extractor.extract()

      expect(desktopSpy).toHaveBeenCalled()
      expect(browserSpy).toHaveBeenCalled()
      expect(result[0]?.accountCookie).toBe('browser-account')

      desktopSpy.mockRestore()
      browserSpy.mockRestore()
    })

    test('extracts plaintext cookies from a real sqlite database', async () => {
      const tempDir = mkdtempSync(join(tmpdir(), 'channel-cookie-db-'))
      tempDirs.push(tempDir)
      const dbPath = join(tempDir, 'Cookies')
      await createCookieDatabase(dbPath, [
        { name: 'x-account', value: 'account-jwt', encrypted_value: Buffer.alloc(0), host_key: '.desk.channel.io' },
        { name: 'ch-session-1', value: 'session-jwt', encrypted_value: Buffer.alloc(0), host_key: '.desk.channel.io' },
        { name: 'other', value: 'ignore-me', encrypted_value: Buffer.alloc(0), host_key: '.channel.io' },
      ])

      class TestExtractor extends ChannelTokenExtractor {
        constructor(private dbPath: string) {
          super('darwin')
        }

        override getCookiesPath(): string | null {
          return this.dbPath
        }
      }

      const extractor = new TestExtractor(dbPath)

      expect(await extractor.extract()).toEqual([
        {
          accountCookie: 'account-jwt',
          sessionCookie: 'session-jwt',
        },
      ])
    })

    test('returns token with undefined sessionCookie when only x-account is present', async () => {
      const tempDir = mkdtempSync(join(tmpdir(), 'channel-cookie-db-'))
      tempDirs.push(tempDir)
      const dbPath = join(tempDir, 'Cookies')
      await createCookieDatabase(dbPath, [
        { name: 'x-account', value: 'account-jwt', encrypted_value: Buffer.alloc(0), host_key: '.channel.io' },
      ])

      class TestExtractor extends ChannelTokenExtractor {
        constructor(private dbPath: string) {
          super('darwin')
        }

        override getCookiesPath(): string | null {
          return this.dbPath
        }
      }

      const extractor = new TestExtractor(dbPath)
      const result = await extractor.extract()

      expect(result).not.toEqual([])
      expect(result[0]?.accountCookie).toBe('account-jwt')
      expect(result[0]?.sessionCookie).toBeUndefined()
    })

    test('returns empty array when x-account is missing', async () => {
      const tempDir = mkdtempSync(join(tmpdir(), 'channel-cookie-db-'))
      tempDirs.push(tempDir)
      const dbPath = join(tempDir, 'Cookies')
      await createCookieDatabase(dbPath, [
        { name: 'ch-session-1', value: 'session-jwt', encrypted_value: Buffer.alloc(0), host_key: '.channel.io' },
      ])

      class TestExtractor extends ChannelTokenExtractor {
        constructor(private dbPath: string) {
          super('darwin')
        }

        override getCookiesPath(): string | null {
          return this.dbPath
        }
      }

      const extractor = new TestExtractor(dbPath)

      expect(await extractor.extract()).toEqual([])
    })

    test('decrypts AES-256-GCM encrypted cookies using master key', async () => {
      // given — known master key and AES-256-GCM encrypted cookie
      const masterKey = randomBytes(32)
      const accountValue = 'encrypted-account-jwt'
      const sessionValue = 'encrypted-session-jwt'

      const encryptAccount = encryptAESGCM(accountValue, masterKey)
      const encryptSession = encryptAESGCM(sessionValue, masterKey)

      const tempDir = mkdtempSync(join(tmpdir(), 'channel-cookie-db-'))
      tempDirs.push(tempDir)
      const dbPath = join(tempDir, 'Cookies')
      await createCookieDatabase(dbPath, [
        { name: 'x-account', value: '', encrypted_value: encryptAccount, host_key: '.channel.io' },
        { name: 'ch-session-1', value: '', encrypted_value: encryptSession, host_key: '.channel.io' },
      ])

      // when — extractor uses the master key (bypassing DPAPI)
      class TestWinExtractor extends ChannelTokenExtractor {
        constructor(
          private dbPath: string,
          private masterKey: Buffer,
        ) {
          super('win32')
        }

        override getCookiesPath(): string | null {
          return this.dbPath
        }

        override decryptDPAPI(_encryptedBlob: Buffer): Buffer | null {
          return this.masterKey
        }

        override getAppDataDir(): string | null {
          return tempDir
        }
      }

      const localStatePath = join(tempDir, 'Local State')
      const fakeEncryptedKey = Buffer.concat([Buffer.from('DPAPI'), randomBytes(32)])
      writeFileSync(
        localStatePath,
        JSON.stringify({ os_crypt: { encrypted_key: fakeEncryptedKey.toString('base64') } }),
      )

      const extractor = new TestWinExtractor(dbPath, masterKey)
      const result = await extractor.extract()

      // then
      expect(result).not.toEqual([])
      expect(result[0]?.accountCookie).toBe('encrypted-account-jwt')
      expect(result[0]?.sessionCookie).toBe('encrypted-session-jwt')
    })

    test('deduplicates entries with the same accountCookie from desktop and browser', async () => {
      const extractor = new ChannelTokenExtractor('darwin')

      const desktopSpy = spyOn(extractor as any, 'extractFromDesktopApp').mockResolvedValue({
        accountCookie: 'same-account-cookie',
        sessionCookie: 'desktop-session',
      })
      const browserSpy = spyOn(extractor as any, 'extractAllFromBrowserPaths').mockResolvedValue([
        {
          accountCookie: 'same-account-cookie',
          sessionCookie: 'browser-session',
        },
      ])

      const result = await extractor.extract()
      expect(result).toHaveLength(1)
      expect(result[0]?.accountCookie).toBe('same-account-cookie')

      desktopSpy.mockRestore()
      browserSpy.mockRestore()
    })

    test('returns multiple distinct accounts from desktop and browser sources', async () => {
      const extractor = new ChannelTokenExtractor('darwin')

      const desktopSpy = spyOn(extractor as any, 'extractFromDesktopApp').mockResolvedValue({
        accountCookie: 'desktop-account-cookie',
        sessionCookie: 'desktop-session',
      })
      const browserSpy = spyOn(extractor as any, 'extractAllFromBrowserPaths').mockResolvedValue([
        {
          accountCookie: 'browser-account-cookie',
          sessionCookie: 'browser-session',
        },
      ])

      const result = await extractor.extract()
      expect(result).toHaveLength(2)
      expect(result.map((r) => r.accountCookie)).toContain('desktop-account-cookie')
      expect(result.map((r) => r.accountCookie)).toContain('browser-account-cookie')

      desktopSpy.mockRestore()
      browserSpy.mockRestore()
    })

    test('returns empty array when DPAPI decryption fails', async () => {
      // given
      const masterKey = randomBytes(32)
      const encryptAccount = encryptAESGCM('account-jwt', masterKey)

      const tempDir = mkdtempSync(join(tmpdir(), 'channel-cookie-db-'))
      tempDirs.push(tempDir)
      const dbPath = join(tempDir, 'Cookies')
      await createCookieDatabase(dbPath, [
        { name: 'x-account', value: '', encrypted_value: encryptAccount, host_key: '.channel.io' },
      ])

      // when — DPAPI fails
      class FailingDPAPIExtractor extends ChannelTokenExtractor {
        constructor(private dbPath: string) {
          super('win32')
        }

        override getCookiesPath(): string | null {
          return this.dbPath
        }

        override decryptDPAPI(_encryptedBlob: Buffer): Buffer | null {
          return null
        }

        override getAppDataDir(): string | null {
          return tempDir
        }
      }

      const localStatePath = join(tempDir, 'Local State')
      const fakeEncryptedKey = Buffer.concat([Buffer.from('DPAPI'), randomBytes(32)])
      writeFileSync(
        localStatePath,
        JSON.stringify({ os_crypt: { encrypted_key: fakeEncryptedKey.toString('base64') } }),
      )

      const extractor = new FailingDPAPIExtractor(dbPath)
      const result = await extractor.extract()

      // then
      expect(result).toEqual([])
    })
  })

  describe('decryptDPAPI', () => {
    test('returns null on non-win32 platform', () => {
      const extractor = new ChannelTokenExtractor('darwin')
      expect(extractor.decryptDPAPI(Buffer.from('test'))).toBeNull()
    })
  })

  describe('decryptBrowserCookie', () => {
    test('decrypts v10-prefixed browser cookie using macOS keychain password (AES-128-CBC)', () => {
      // given — AES-128-CBC encrypted cookie with macOS keychain-derived key
      const { createCipheriv, pbkdf2Sync } = require('node:crypto')
      const password = 'test-keychain-password'
      const key = pbkdf2Sync(password, 'saltysalt', 1003, 16, 'sha1')
      const iv = Buffer.alloc(16, 0x20)
      const plainValue = 'test-channel-account-value'

      const cipher = createCipheriv('aes-128-cbc', key, iv)
      const ciphertext = Buffer.concat([cipher.update(plainValue, 'utf8'), cipher.final()])
      const encrypted = Buffer.concat([Buffer.from('v10'), ciphertext])

      const darwinExtractor = new ChannelTokenExtractor('darwin')
      const execSecuritySpy = spyOn(darwinExtractor as any, 'execSecurityCommand').mockReturnValue(password)

      // when
      const result = (darwinExtractor as any).decryptBrowserCookie(encrypted, '/fake/path/Cookies')

      // then
      expect(result).toBe(plainValue)

      execSecuritySpy.mockRestore()
    })

    test('decrypts v10-prefixed browser cookie using Linux peanuts key (AES-128-CBC)', () => {
      // given — AES-128-CBC encrypted cookie with Linux Chromium peanuts key
      const { createCipheriv, pbkdf2Sync } = require('node:crypto')
      const key = pbkdf2Sync('peanuts', 'saltysalt', 1, 16, 'sha1')
      const iv = Buffer.alloc(16, 0x20)
      const plainValue = 'test-channel-account-linux'

      const cipher = createCipheriv('aes-128-cbc', key, iv)
      const ciphertext = Buffer.concat([cipher.update(plainValue, 'utf8'), cipher.final()])
      const encrypted = Buffer.concat([Buffer.from('v10'), ciphertext])

      const linuxExtractor = new ChannelTokenExtractor('linux')

      // when
      const result = (linuxExtractor as any).decryptBrowserCookie(
        encrypted,
        '/home/user/.config/google-chrome/Default/Cookies',
      )

      // then
      expect(result).toBe(plainValue)
    })
  })
})

function encryptAESGCM(plaintext: string, key: Buffer): Buffer {
  const nonce = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, nonce)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  // v10 prefix (3 bytes) + IV (12 bytes) + ciphertext + auth tag (16 bytes)
  return Buffer.concat([Buffer.from('v10'), nonce, encrypted, authTag])
}

async function createCookieDatabase(
  dbPath: string,
  rows: Array<{ name: string; value: string; encrypted_value: Buffer; host_key: string }>,
): Promise<void> {
  if (typeof globalThis.Bun !== 'undefined') {
    const { Database } = await import('bun:sqlite')
    const db = new Database(dbPath)
    db.run('PRAGMA journal_mode = DELETE')
    db.run('CREATE TABLE cookies (name TEXT, value TEXT, encrypted_value BLOB, host_key TEXT)')
    for (const row of rows) {
      db.run('INSERT INTO cookies (name, value, encrypted_value, host_key) VALUES (?, ?, ?, ?)', [
        row.name,
        row.value,
        row.encrypted_value,
        row.host_key,
      ])
    }
    db.close()
    return
  }

  const { createRequire } = await import('node:module')
  const req = createRequire(import.meta.url)
  const Database = req('better-sqlite3')
  const db = new Database(dbPath)
  db.exec('CREATE TABLE cookies (name TEXT, value TEXT, encrypted_value BLOB, host_key TEXT)')
  const statement = db.prepare('INSERT INTO cookies (name, value, encrypted_value, host_key) VALUES (?, ?, ?, ?)')
  for (const row of rows) {
    statement.run(row.name, row.value, row.encrypted_value, row.host_key)
  }
  db.close()
}
