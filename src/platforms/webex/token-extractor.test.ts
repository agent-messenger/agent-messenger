import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { WebexTokenExtractor } from './token-extractor'

function makeWebexStorageJson(overrides?: {
  accessToken?: string
  refreshToken?: string
  expires?: number
  deviceUrl?: string
}): string {
  return JSON.stringify({
    Credentials: {
      '@': {
        supertoken: {
          access_token: overrides?.accessToken ?? 'ZDI3MGEyYzQtNmFlNS00NDNh_PF84_1eb65fdf-userId_orgId',
          token_type: 'Bearer',
          expires: overrides?.expires ?? Date.now() + 3600000,
          refresh_token: overrides?.refreshToken ?? 'MDEyMzQ1Njc4OTAxMjM0NTY3_refresh',
          scope: 'spark:all',
        },
      },
    },
    Device: {
      '@': {
        url: overrides?.deviceUrl ?? 'https://wdm-r.wbx2.com/wdm/api/v1/devices/test-device-id',
      },
    },
  })
}

function createLevelDBDir(base: string, profileName: string = 'Default'): string {
  const leveldbDir = join(base, profileName, 'Local Storage', 'leveldb')
  mkdirSync(leveldbDir, { recursive: true })
  return leveldbDir
}

describe('WebexTokenExtractor', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'webex-extract-test-'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  describe('getBrowserProfileDirs', () => {
    test('returns correct paths for darwin', () => {
      const extractor = new WebexTokenExtractor('darwin')
      const dirs = extractor.getBrowserProfileDirs()

      if (dirs.length > 0) {
        for (const dir of dirs) {
          expect(dir).toContain('Local Storage/leveldb')
        }
      }
    })

    test('returns empty array for unsupported platform', () => {
      const extractor = new WebexTokenExtractor('freebsd' as NodeJS.Platform)
      expect(extractor.getBrowserProfileDirs()).toEqual([])
    })

    test('discovers Default and Profile N directories', () => {
      const defaultDir = createLevelDBDir(tempDir, 'Default')
      const profile1Dir = createLevelDBDir(tempDir, 'Profile 1')
      const profile2Dir = createLevelDBDir(tempDir, 'Profile 2')

      const extractor = new WebexTokenExtractor('darwin', undefined, tempDir)
      const dirs = extractor.getBrowserProfileDirs()

      expect(dirs).toContain(defaultDir)
      expect(dirs).toContain(profile1Dir)
      expect(dirs).toContain(profile2Dir)
    })

    test('skips non-profile directories', () => {
      createLevelDBDir(tempDir, 'Default')
      mkdirSync(join(tempDir, 'Extensions', 'Local Storage', 'leveldb'), { recursive: true })
      mkdirSync(join(tempDir, 'Crashpad'), { recursive: true })

      const extractor = new WebexTokenExtractor('darwin', undefined, tempDir)
      const dirs = extractor.getBrowserProfileDirs()

      expect(dirs).toHaveLength(1)
      expect(dirs[0]).toContain('Default')
    })

    test('returns empty when base dir does not exist', () => {
      const extractor = new WebexTokenExtractor('darwin', undefined, join(tempDir, 'nonexistent'))
      expect(extractor.getBrowserProfileDirs()).toEqual([])
    })
  })

  describe('extract', () => {
    test('finds token from .log file', async () => {
      const leveldbDir = createLevelDBDir(tempDir)
      const webexJson = makeWebexStorageJson()
      const entry = `_https://web.webex.com\x00webex-storage${webexJson}`
      writeFileSync(join(leveldbDir, '000003.log'), entry)

      const extractor = new WebexTokenExtractor('darwin', undefined, tempDir)
      const result = await extractor.extract()

      expect(result).not.toBeNull()
      expect(result!.accessToken).toBe('ZDI3MGEyYzQtNmFlNS00NDNh_PF84_1eb65fdf-userId_orgId')
      expect(result!.refreshToken).toBe('MDEyMzQ1Njc4OTAxMjM0NTY3_refresh')
      expect(result!.expiresAt).toBeGreaterThan(Date.now())
      expect(result!.deviceUrl).toBe('https://wdm-r.wbx2.com/wdm/api/v1/devices/test-device-id')
    })

    test('finds token from .ldb file', async () => {
      const leveldbDir = createLevelDBDir(tempDir)
      const webexJson = makeWebexStorageJson()
      writeFileSync(join(leveldbDir, '000005.ldb'), `\x00\x00${webexJson}\x00\x00`)

      const extractor = new WebexTokenExtractor('darwin', undefined, tempDir)
      const result = await extractor.extract()

      expect(result).not.toBeNull()
      expect(result!.accessToken).toBe('ZDI3MGEyYzQtNmFlNS00NDNh_PF84_1eb65fdf-userId_orgId')
    })

    test('returns null when no browser dirs exist', async () => {
      const extractor = new WebexTokenExtractor('darwin', undefined, join(tempDir, 'nonexistent'))
      expect(await extractor.extract()).toBeNull()
    })

    test('returns null when LevelDB has no webex-storage data', async () => {
      const leveldbDir = createLevelDBDir(tempDir)
      writeFileSync(join(leveldbDir, '000003.log'), 'some random data without webex tokens')

      const extractor = new WebexTokenExtractor('darwin', undefined, tempDir)
      expect(await extractor.extract()).toBeNull()
    })

    test('handles malformed JSON gracefully', async () => {
      const leveldbDir = createLevelDBDir(tempDir)
      writeFileSync(join(leveldbDir, '000003.log'), '{"Credentials": {"@": {"supertoken": {broken json')

      const extractor = new WebexTokenExtractor('darwin', undefined, tempDir)
      expect(await extractor.extract()).toBeNull()
    })

    test('extracts all fields from nested Credentials structure', async () => {
      const expires = Date.now() + 7200000
      const leveldbDir = createLevelDBDir(tempDir)
      const webexJson = makeWebexStorageJson({
        accessToken: 'my-long-access-token-that-is-at-least-20-chars',
        refreshToken: 'my-refresh-token-value',
        expires,
        deviceUrl: 'https://wdm-a.wbx2.com/wdm/api/v1/devices/abc-123',
      })
      writeFileSync(join(leveldbDir, '000003.log'), webexJson)

      const extractor = new WebexTokenExtractor('darwin', undefined, tempDir)
      const result = await extractor.extract()

      expect(result).not.toBeNull()
      expect(result!.accessToken).toBe('my-long-access-token-that-is-at-least-20-chars')
      expect(result!.refreshToken).toBe('my-refresh-token-value')
      expect(result!.expiresAt).toBe(expires)
      expect(result!.deviceUrl).toBe('https://wdm-a.wbx2.com/wdm/api/v1/devices/abc-123')
    })

    test('extracts deviceUrl when Device field is present', async () => {
      const leveldbDir = createLevelDBDir(tempDir)
      const webexJson = makeWebexStorageJson({
        deviceUrl: 'https://wdm-eu.wbx2.com/wdm/api/v1/devices/eu-device-id',
      })
      writeFileSync(join(leveldbDir, '000003.log'), webexJson)

      const extractor = new WebexTokenExtractor('darwin', undefined, tempDir)
      const result = await extractor.extract()

      expect(result).not.toBeNull()
      expect(result!.deviceUrl).toBe('https://wdm-eu.wbx2.com/wdm/api/v1/devices/eu-device-id')
    })

    test('returns token without deviceUrl when Device field is absent', async () => {
      const leveldbDir = createLevelDBDir(tempDir)
      const webexJson = JSON.stringify({
        Credentials: {
          '@': {
            supertoken: {
              access_token: 'token-without-device-url-at-least-twenty',
              token_type: 'Bearer',
              expires: Date.now() + 3600000,
            },
          },
        },
      })
      writeFileSync(join(leveldbDir, '000003.log'), webexJson)

      const extractor = new WebexTokenExtractor('darwin', undefined, tempDir)
      const result = await extractor.extract()

      expect(result).not.toBeNull()
      expect(result!.accessToken).toBe('token-without-device-url-at-least-twenty')
      expect(result!.deviceUrl).toBeUndefined()
    })

    test('skips profiles without leveldb directory', async () => {
      mkdirSync(join(tempDir, 'Default', 'Local Storage'), { recursive: true })
      const profile1Dir = createLevelDBDir(tempDir, 'Profile 1')
      const webexJson = makeWebexStorageJson()
      writeFileSync(join(profile1Dir, '000003.log'), webexJson)

      const extractor = new WebexTokenExtractor('darwin', undefined, tempDir)
      const result = await extractor.extract()

      expect(result).not.toBeNull()
    })

    test('prefers token with latest expiry across profiles', async () => {
      const dir1 = createLevelDBDir(tempDir, 'Default')
      const dir2 = createLevelDBDir(tempDir, 'Profile 1')

      const expiredToken = makeWebexStorageJson({
        accessToken: 'expired-token-longer-than-twenty-chars-xx',
        expires: Date.now() - 3600000,
      })
      const freshToken = makeWebexStorageJson({
        accessToken: 'fresh-token-longer-than-twenty-chars-xxx',
        expires: Date.now() + 3600000,
      })

      writeFileSync(join(dir1, '000003.log'), expiredToken)
      writeFileSync(join(dir2, '000003.log'), freshToken)

      const extractor = new WebexTokenExtractor('darwin', undefined, tempDir)
      const result = await extractor.extract()

      expect(result!.accessToken).toBe('fresh-token-longer-than-twenty-chars-xxx')
    })

    test('returns first token when all have same expiry', async () => {
      const dir1 = createLevelDBDir(tempDir, 'Default')
      const dir2 = createLevelDBDir(tempDir, 'Profile 1')

      const expires = Date.now() + 3600000
      const token1 = makeWebexStorageJson({
        accessToken: 'first-valid-token-longer-than-twenty-chars',
        expires,
      })
      const token2 = makeWebexStorageJson({
        accessToken: 'second-valid-token-longer-than-twenty-chars',
        expires,
      })

      writeFileSync(join(dir1, '000003.log'), token1)
      writeFileSync(join(dir2, '000003.log'), token2)

      const extractor = new WebexTokenExtractor('darwin', undefined, tempDir)
      const result = await extractor.extract()

      expect(result!.accessToken).toBe('first-valid-token-longer-than-twenty-chars')
    })

    test('prefers .log files over .ldb files in same directory', async () => {
      const leveldbDir = createLevelDBDir(tempDir)

      const logToken = makeWebexStorageJson({ accessToken: 'from-log-file-token-at-least-twenty-chars' })
      const ldbToken = makeWebexStorageJson({ accessToken: 'from-ldb-file-token-at-least-twenty-chars' })

      writeFileSync(join(leveldbDir, '000003.log'), logToken)
      writeFileSync(join(leveldbDir, '000005.ldb'), ldbToken)

      const extractor = new WebexTokenExtractor('darwin', undefined, tempDir)
      const result = await extractor.extract()

      expect(result!.accessToken).toBe('from-log-file-token-at-least-twenty-chars')
    })

    test('rejects tokens shorter than 20 characters', async () => {
      const leveldbDir = createLevelDBDir(tempDir)
      const webexJson = makeWebexStorageJson({ accessToken: 'short' })
      writeFileSync(join(leveldbDir, '000003.log'), webexJson)

      const extractor = new WebexTokenExtractor('darwin', undefined, tempDir)
      expect(await extractor.extract()).toBeNull()
    })

    test('handles binary framing around JSON', async () => {
      const leveldbDir = createLevelDBDir(tempDir)
      const webexJson = makeWebexStorageJson()
      const binaryFrame = Buffer.concat([
        Buffer.from([0x01, 0x02, 0x03, 0xff, 0xfe]),
        Buffer.from(`_https://web.webex.com\x00webex-storage`),
        Buffer.from(webexJson),
        Buffer.from([0x00, 0x00, 0x01]),
      ])
      writeFileSync(join(leveldbDir, '000003.log'), binaryFrame)

      const extractor = new WebexTokenExtractor('darwin', undefined, tempDir)
      const result = await extractor.extract()

      expect(result).not.toBeNull()
      expect(result!.accessToken).toBe('ZDI3MGEyYzQtNmFlNS00NDNh_PF84_1eb65fdf-userId_orgId')
    })

    test('handles supertoken at top level', async () => {
      const leveldbDir = createLevelDBDir(tempDir)
      const directJson = JSON.stringify({
        supertoken: {
          access_token: 'direct-supertoken-access-value-at-least-twenty',
          token_type: 'Bearer',
          expires: Date.now() + 3600000,
        },
      })
      writeFileSync(join(leveldbDir, '000003.log'), directJson)

      const extractor = new WebexTokenExtractor('darwin', undefined, tempDir)
      const result = await extractor.extract()

      expect(result).not.toBeNull()
      expect(result!.accessToken).toBe('direct-supertoken-access-value-at-least-twenty')
    })

    test('handles expires_in instead of expires', async () => {
      const leveldbDir = createLevelDBDir(tempDir)
      const now = Date.now()
      const webexJson = JSON.stringify({
        Credentials: {
          '@': {
            supertoken: {
              access_token: 'token-with-expires-in-field-at-least-twenty',
              token_type: 'Bearer',
              expires_in: 3600,
            },
          },
        },
      })
      writeFileSync(join(leveldbDir, '000003.log'), webexJson)

      const extractor = new WebexTokenExtractor('darwin', undefined, tempDir)
      const result = await extractor.extract()

      expect(result).not.toBeNull()
      expect(result!.expiresAt).toBeGreaterThanOrEqual(now + 3500000)
      expect(result!.expiresAt).toBeLessThanOrEqual(now + 3700000)
    })

    test('calls debug log when provided', async () => {
      const logs: string[] = []
      const extractor = new WebexTokenExtractor('darwin', (msg) => logs.push(msg), join(tempDir, 'nonexistent'))
      await extractor.extract()

      expect(logs.some((l) => l.includes('No browser profile directories found'))).toBe(true)
    })
  })
})
