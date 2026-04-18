import { Database } from 'bun:sqlite'
import { afterEach, describe, expect, spyOn, it } from 'bun:test'
import { createCipheriv, randomBytes } from 'node:crypto'
import * as fs from 'node:fs'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ExtractedWorkspace, TokenExtractor } from './token-extractor'

const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true })
  }
  tempDirs.length = 0
})

function createCookiesDb(
  dbPath: string,
  cookies: { name: string; value: string; encrypted_value: Uint8Array; host_key: string; last_access_utc: number }[],
) {
  const db = new Database(dbPath)
  db.exec('CREATE TABLE cookies (name TEXT, value TEXT, encrypted_value BLOB, host_key TEXT, last_access_utc INTEGER)')
  const stmt = db.prepare(
    'INSERT INTO cookies (name, value, encrypted_value, host_key, last_access_utc) VALUES (?, ?, ?, ?, ?)',
  )
  for (const cookie of cookies) {
    stmt.run(cookie.name, cookie.value, cookie.encrypted_value, cookie.host_key, cookie.last_access_utc)
  }
  db.close()
}

describe('TokenExtractor token deduplication', () => {
  it('keeps first token per team and upgrades unknown team name', async () => {
    // given — two .log entries for the same team: first has unknown name, second has a name
    const slackDir = mkdtempSync(join(tmpdir(), 'slack-dedup-'))
    tempDirs.push(slackDir)

    const hex64a = 'a'.repeat(64)
    const hex64b = 'b'.repeat(64)
    const tokenA = `xoxc-1111111111-2222222222-3333333333-${hex64a}`
    const tokenB = `xoxc-4444444444-5555555555-6666666666-${hex64b}`

    const leveldbDir = join(slackDir, 'Local Storage', 'leveldb')
    mkdirSync(leveldbDir, { recursive: true })
    // First entry: tokenA with team ID but no name
    // Second entry: tokenB with same team ID and a name
    writeFileSync(join(leveldbDir, '000001.log'), `"${tokenA}"T12345678xxx"${tokenB}"T12345678"name":"workspace-name"`)

    // when
    const extractor = new TokenExtractor('darwin', slackDir)
    const result = await extractor.extract()

    // then — first token wins, but team name is upgraded
    expect(result.length).toBe(1)
    expect(result[0].token).toBe(tokenA)
    expect(result[0].workspace_name).toBe('workspace-name')
  })

  it('prefers Local Storage token over IndexedDB token for same team', async () => {
    // given — same team in Local Storage (valid) and IndexedDB (stale)
    const slackDir = mkdtempSync(join(tmpdir(), 'slack-dedup-tier-'))
    tempDirs.push(slackDir)

    const hex64valid = 'aa'.repeat(32)
    const hex64stale = 'bb'.repeat(32)
    const validToken = `xoxc-1111111111-2222222222-3333333333-${hex64valid}`
    const staleToken = `xoxc-9999999999-8888888888-7777777777-${hex64stale}`

    const localStorageDir = join(slackDir, 'Local Storage', 'leveldb')
    mkdirSync(localStorageDir, { recursive: true })
    writeFileSync(join(localStorageDir, '000001.log'), `"${validToken}"T12345678"name":"valid-workspace"`)

    const indexedDbDir = join(slackDir, 'IndexedDB', 'https_app.slack.com_0.indexeddb.leveldb')
    mkdirSync(indexedDbDir, { recursive: true })
    writeFileSync(join(indexedDbDir, '000001.log'), `"${staleToken}"T12345678"name":"stale-workspace"`)

    // when
    const extractor = new TokenExtractor('darwin', slackDir)
    const result = await extractor.extract()

    // then — Local Storage token wins regardless of scan order
    expect(result.length).toBe(1)
    expect(result[0].token).toBe(validToken)
    expect(result[0].workspace_name).toBe('valid-workspace')
  })

  it('prefers IndexedDB token when Local Storage has no token for team', async () => {
    // given — token only in IndexedDB
    const slackDir = mkdtempSync(join(tmpdir(), 'slack-dedup-idb-only-'))
    tempDirs.push(slackDir)

    const hex64 = 'a'.repeat(64)
    const token = `xoxc-1111111111-2222222222-3333333333-${hex64}`

    const indexedDbDir = join(slackDir, 'IndexedDB', 'https_app.slack.com_0.indexeddb.leveldb')
    mkdirSync(indexedDbDir, { recursive: true })
    writeFileSync(join(indexedDbDir, '000001.log'), `"${token}"T12345678"name":"only-workspace"`)

    // when
    const extractor = new TokenExtractor('darwin', slackDir)
    const result = await extractor.extract()

    // then — IndexedDB token is used since there's no better source
    expect(result.length).toBe(1)
    expect(result[0].token).toBe(token)
  })

  it('prefers storage dir token over IndexedDB token for same team', async () => {
    // given — structured JSON in storage dir vs raw token in IndexedDB
    const slackDir = mkdtempSync(join(tmpdir(), 'slack-dedup-storage-'))
    tempDirs.push(slackDir)

    const hex64storage = 'cc'.repeat(32)
    const hex64idb = 'dd'.repeat(32)
    const storageToken = `xoxc-1111111111-2222222222-3333333333-${hex64storage}`
    const idbToken = `xoxc-9999999999-8888888888-7777777777-${hex64idb}`

    const storageDir = join(slackDir, 'storage')
    mkdirSync(storageDir, { recursive: true })
    writeFileSync(join(storageDir, '000001.log'), `"${storageToken}"T12345678"name":"storage-workspace"`)

    const indexedDbDir = join(slackDir, 'IndexedDB', 'https_app.slack.com_0.indexeddb.leveldb')
    mkdirSync(indexedDbDir, { recursive: true })
    writeFileSync(join(indexedDbDir, '000001.log'), `"${idbToken}"T12345678"name":"idb-workspace"`)

    // when
    const extractor = new TokenExtractor('darwin', slackDir)
    const result = await extractor.extract()

    // then — storage dir token wins
    expect(result.length).toBe(1)
    expect(result[0].token).toBe(storageToken)
    expect(result[0].workspace_name).toBe('storage-workspace')
  })

  it('prefers .log tokens over .ldb tokens for same team', async () => {
    // given — same team ID in both .log (fresh) and .ldb (stale)
    const slackDir = mkdtempSync(join(tmpdir(), 'slack-dedup-order-'))
    tempDirs.push(slackDir)

    const hex64fresh = 'f'.repeat(64)
    const hex64stale = 's'.repeat(64)
    const freshToken = `xoxc-1111111111-2222222222-3333333333-${hex64fresh}`
    const staleToken = `xoxc-9999999999-8888888888-7777777777-${hex64stale}`

    const leveldbDir = join(slackDir, 'Local Storage', 'leveldb')
    mkdirSync(leveldbDir, { recursive: true })
    writeFileSync(join(leveldbDir, '000001.log'), `"${freshToken}"T12345678"name":"fresh-workspace"`)
    writeFileSync(join(leveldbDir, '000002.ldb'), `"${staleToken}"T12345678"team_name":"stale-workspace"`)

    // when
    const extractor = new TokenExtractor('darwin', slackDir)
    const result = await extractor.extract()

    // then — .log token wins
    expect(result.length).toBe(1)
    expect(result[0].token).toBe(freshToken)
  })

  it('keeps all tokens with unknown teamId instead of merging them', async () => {
    // given — two different tokens without team ID context (no T[A-Z0-9] nearby)
    const slackDir = mkdtempSync(join(tmpdir(), 'slack-dedup-unknown-'))
    tempDirs.push(slackDir)

    const hex64a = 'a'.repeat(64)
    const hex64b = 'b'.repeat(64)
    const tokenA = `xoxc-1111111111-2222222222-3333333333-${hex64a}`
    const tokenB = `xoxc-4444444444-5555555555-6666666666-${hex64b}`

    const leveldbDir = join(slackDir, 'Local Storage', 'leveldb')
    mkdirSync(leveldbDir, { recursive: true })
    // No team ID pattern (T[A-Z0-9]{8,11}) near either token
    writeFileSync(join(leveldbDir, '000001.log'), `"${tokenA}"some-data"${tokenB}"other-data`)

    // when
    const extractor = new TokenExtractor('darwin', slackDir)
    const result = await extractor.extract()

    // then — both tokens preserved (they may be different workspaces)
    expect(result.length).toBe(2)
    const tokens = result.map((r) => r.token).sort()
    expect(tokens).toEqual([tokenA, tokenB].sort())
  })
})

describe('TokenExtractor LevelDB fragmentation markers', () => {
  function buildFragmentedLdbContent(tokenParts: string[], marker: number[]): Buffer {
    // given — build binary content simulating LevelDB fragmentation:
    // token segments joined by 4-byte marker instead of hyphens
    const segments: Buffer[] = []
    for (let i = 0; i < tokenParts.length; i++) {
      segments.push(Buffer.from(tokenParts[i]))
      if (i < tokenParts.length - 1) {
        segments.push(Buffer.from(marker))
      }
    }
    // Surround with team ID context and a terminator
    const prefix = Buffer.from('"team_name":"test-workspace"T12345678')
    const suffix = Buffer.from('"')
    return Buffer.concat([prefix, segments[0] ? Buffer.concat(segments) : Buffer.alloc(0), suffix])
  }

  it('extracts token with old fragmentation marker [19 0d f0 NN]', async () => {
    // given
    const slackDir = mkdtempSync(join(tmpdir(), 'slack-marker-old-'))
    tempDirs.push(slackDir)

    const hex64 = 'a'.repeat(64)
    const tokenParts = ['xoxc-1111111111', '2222222222', '3333333333', hex64]
    const content = buildFragmentedLdbContent(tokenParts, [0x19, 0x0d, 0xf0, 0x5e])

    const leveldbDir = join(slackDir, 'Local Storage', 'leveldb')
    mkdirSync(leveldbDir, { recursive: true })
    writeFileSync(join(leveldbDir, '000001.ldb'), content)

    // when
    const extractor = new TokenExtractor('darwin', slackDir)
    const result = await extractor.extract()

    // then
    expect(result.length).toBe(1)
    expect(result[0].token).toBe(`xoxc-1111111111-2222222222-3333333333-${hex64}`)
  })

  it('extracts token with new fragmentation marker [15 0b f0 43]', async () => {
    // given — marker whose 4th byte (0x43 = "C") is a valid hex char
    const slackDir = mkdtempSync(join(tmpdir(), 'slack-marker-new-'))
    tempDirs.push(slackDir)

    const hex64 = 'b'.repeat(64)
    const tokenParts = ['xoxc-4063338523', '4063338531', '8150876260673', hex64]
    const content = buildFragmentedLdbContent(tokenParts, [0x15, 0x0b, 0xf0, 0x43])

    const leveldbDir = join(slackDir, 'Local Storage', 'leveldb')
    mkdirSync(leveldbDir, { recursive: true })
    writeFileSync(join(leveldbDir, '000001.ldb'), content)

    // when
    const extractor = new TokenExtractor('darwin', slackDir)
    const result = await extractor.extract()

    // then — 0x43 ("C") must NOT leak into the token
    expect(result.length).toBe(1)
    expect(result[0].token).toBe(`xoxc-4063338523-4063338531-8150876260673-${hex64}`)
    expect(result[0].token).not.toContain('C')
  })

  it('extracts token with new fragmentation marker [15 0b f0 58]', async () => {
    // given — marker whose 4th byte (0x58 = "X") is not a valid hex char
    const slackDir = mkdtempSync(join(tmpdir(), 'slack-marker-58-'))
    tempDirs.push(slackDir)

    const hex64 = 'c'.repeat(64)
    const tokenParts = ['xoxc-5555555555', '6666666666', '7777777777', hex64]
    const content = buildFragmentedLdbContent(tokenParts, [0x15, 0x0b, 0xf0, 0x58])

    const leveldbDir = join(slackDir, 'Local Storage', 'leveldb')
    mkdirSync(leveldbDir, { recursive: true })
    writeFileSync(join(leveldbDir, '000001.ldb'), content)

    // when
    const extractor = new TokenExtractor('darwin', slackDir)
    const result = await extractor.extract()

    // then
    expect(result.length).toBe(1)
    expect(result[0].token).toBe(`xoxc-5555555555-6666666666-7777777777-${hex64}`)
  })
})

describe('TokenExtractor Linux cookie decryption', () => {
  it('decrypts v10 cookie using peanuts password on Linux', async () => {
    // given — LevelDB with valid token + v10-encrypted cookie using Linux key
    const slackDir = mkdtempSync(join(tmpdir(), 'slack-linux-'))
    tempDirs.push(slackDir)

    const cookiePlaintext = 'xoxd-linuxTestCookie%2Bvalue'
    const key = require('node:crypto').pbkdf2Sync('peanuts', 'saltysalt', 1, 16, 'sha1')
    const iv = Buffer.alloc(16, ' ')
    const cipher = createCipheriv('aes-128-cbc', key, iv)
    const ciphertext = Buffer.concat([cipher.update(cookiePlaintext, 'utf8'), cipher.final()])
    const encryptedCookie = Buffer.concat([Buffer.from('v10'), ciphertext])

    createCookiesDb(join(slackDir, 'Cookies'), [
      {
        name: 'd',
        value: '',
        encrypted_value: new Uint8Array(encryptedCookie),
        host_key: '.slack.com',
        last_access_utc: 1,
      },
    ])

    const token = `xoxc-1111111111-2222222222-3333333333-${'a'.repeat(64)}`
    const leveldbDir = join(slackDir, 'Local Storage', 'leveldb')
    mkdirSync(leveldbDir, { recursive: true })
    writeFileSync(join(leveldbDir, '000001.log'), `"${token}"T12345678"name":"test-workspace"`)

    // when
    const extractor = new TokenExtractor('linux', slackDir)
    const result = await extractor.extract()

    // then
    expect(result.length).toBe(1)
    expect(result[0].cookie).toBe(cookiePlaintext)
    expect(result[0].token).toBe(token)
  })
})

describe('TokenExtractor Linux v11 cookie decryption', () => {
  it('decrypts v11 cookie using gnome-keyring password on Linux', () => {
    // given — v11-prefixed cookie encrypted with a known keyring password
    const { createCipheriv, pbkdf2Sync } = require('node:crypto')
    const testPassword = 'test-gnome-keyring-password'
    const plainCookie = 'xoxd-v11LinuxTestCookie%2BValue'
    const key = pbkdf2Sync(testPassword, 'saltysalt', 1, 16, 'sha1')
    const iv = Buffer.alloc(16, ' ')
    const cipher = createCipheriv('aes-128-cbc', key, iv)
    const ciphertext = Buffer.concat([cipher.update(plainCookie, 'utf8'), cipher.final()])
    const encrypted = Buffer.concat([Buffer.from('v11'), ciphertext])

    const extractor = new TokenExtractor('linux', '/tmp/test')
    const keyringPasswordSpy = spyOn(extractor as any, 'getLinuxKeyringPassword').mockImplementation(
      (appName: string) => {
        if (appName === 'Slack') return testPassword
        throw new Error('not found')
      },
    )

    // when
    const result = extractor.tryDecryptCookie(encrypted)

    // then
    expect(result).toBe(plainCookie)
    keyringPasswordSpy.mockRestore()
  })

  it('falls back to peanuts key when keyring is unavailable for v11 cookie', () => {
    // given — v11-prefixed cookie encrypted with peanuts (tests fallback code path)
    const { createCipheriv, pbkdf2Sync } = require('node:crypto')
    const key = pbkdf2Sync('peanuts', 'saltysalt', 1, 16, 'sha1')
    const iv = Buffer.alloc(16, ' ')
    const plainCookie = 'xoxd-peanutsFallback%2B'
    const cipher = createCipheriv('aes-128-cbc', key, iv)
    const ciphertext = Buffer.concat([cipher.update(plainCookie, 'utf8'), cipher.final()])
    const encrypted = Buffer.concat([Buffer.from('v11'), ciphertext])

    const extractor = new TokenExtractor('linux', '/tmp/test')
    const keyringPasswordSpy = spyOn(extractor as any, 'getLinuxKeyringPassword').mockImplementation(() => {
      throw new Error('gnome-keyring unavailable')
    })

    // when — keyring fails for all app names, falls back to peanuts
    const result = extractor.tryDecryptCookie(encrypted)

    // then — fallback to peanuts decrypts the peanuts-encrypted data
    expect(result).toBe(plainCookie)
    keyringPasswordSpy.mockRestore()
  })
})

describe('TokenExtractor debug logging', () => {
  it('calls debugLog callback during extraction', async () => {
    // given
    const slackDir = mkdtempSync(join(tmpdir(), 'slack-debug-'))
    tempDirs.push(slackDir)
    mkdirSync(join(slackDir, 'storage'), { recursive: true })

    const messages: string[] = []
    const debugLog = (msg: string) => messages.push(msg)

    // when
    const extractor = new TokenExtractor('darwin', slackDir, undefined, debugLog)
    await extractor.extract()

    // then — should have emitted debug messages
    expect(messages.length).toBeGreaterThan(0)
  })

  it('does not throw when debugLog is not provided', async () => {
    // given
    const slackDir = mkdtempSync(join(tmpdir(), 'slack-no-debug-'))
    tempDirs.push(slackDir)
    mkdirSync(join(slackDir, 'storage'), { recursive: true })

    // when — then — should not throw
    const extractor = new TokenExtractor('darwin', slackDir)
    const result = await extractor.extract()
    expect(result).toEqual([])
  })
})

describe('TokenExtractor Windows DPAPI', () => {
  it('decryptDPAPI returns null on non-win32 platform', () => {
    const extractor = new TokenExtractor('darwin', '/tmp/slack-test')
    expect(extractor.decryptDPAPI(Buffer.from('test'))).toBeNull()
  })

  it('decryptV10CookieWindows decrypts AES-256-GCM with master key from Local State', () => {
    // given — known master key and AES-256-GCM encrypted cookie
    const masterKey = randomBytes(32)

    class TestTokenExtractor extends TokenExtractor {
      override getWindowsMasterKey(): Buffer {
        return masterKey
      }
    }

    const extractor = new TestTokenExtractor('win32', '/tmp/slack-test')
    const plaintext = 'xoxd-windowsCookieValue%2Btest'
    const nonce = randomBytes(12)

    const cipher = createCipheriv('aes-256-gcm', masterKey, nonce)
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()

    const encrypted = Buffer.concat([Buffer.from('v10'), nonce, ciphertext, tag])

    // when — then
    expect(extractor.tryDecryptCookie(encrypted)).toBe(plaintext)
  })

  it('decryptV10CookieWindows falls back to direct DPAPI when no Local State', () => {
    class TestTokenExtractor extends TokenExtractor {
      override getWindowsMasterKey(): null {
        return null
      }
      override decryptDPAPI(_encrypted: Buffer): Buffer | null {
        return Buffer.from('xoxd-dpapiDirectCookie%2B')
      }
    }

    const extractor = new TestTokenExtractor('win32', '/tmp/slack-test')
    const encrypted = Buffer.concat([Buffer.from('v10'), Buffer.from('encrypted-data')])

    expect(extractor.tryDecryptCookie(encrypted)).toBe('xoxd-dpapiDirectCookie%2B')
  })

  it('tryDecryptCookie handles Windows pre-v80 cookies without version prefix', () => {
    class TestTokenExtractor extends TokenExtractor {
      override decryptDPAPI(_encrypted: Buffer): Buffer | null {
        return Buffer.from('xoxd-preV80Cookie%2B')
      }
    }

    const extractor = new TestTokenExtractor('win32', '/tmp/slack-test')
    const encrypted = Buffer.from([0x01, 0x00, 0x00, 0x00, 0xaa, 0xbb, 0xcc])

    expect(extractor.tryDecryptCookie(encrypted)).toBe('xoxd-preV80Cookie%2B')
  })

  it('getWindowsMasterKey reads and decrypts key from Local State file', () => {
    // given
    const slackDir = mkdtempSync(join(tmpdir(), 'slack-win-'))
    tempDirs.push(slackDir)

    const fakeDecryptedKey = randomBytes(32)
    const dpapiPayload = Buffer.from('fake-dpapi-encrypted-key')
    const encryptedKeyWithPrefix = Buffer.concat([Buffer.from('DPAPI'), dpapiPayload])
    const localState = { os_crypt: { encrypted_key: encryptedKeyWithPrefix.toString('base64') } }
    writeFileSync(join(slackDir, 'Local State'), JSON.stringify(localState))

    class TestTokenExtractor extends TokenExtractor {
      override decryptDPAPI(encrypted: Buffer): Buffer | null {
        if (encrypted.equals(dpapiPayload)) {
          return fakeDecryptedKey
        }
        return null
      }
    }

    // when — then
    const extractor = new TestTokenExtractor('win32', slackDir)
    expect(extractor.getWindowsMasterKey()).toEqual(fakeDecryptedKey)
  })

  it('getWindowsMasterKey returns null when Local State is missing', () => {
    const slackDir = mkdtempSync(join(tmpdir(), 'slack-no-ls-'))
    tempDirs.push(slackDir)

    const extractor = new TokenExtractor('win32', slackDir)
    expect(extractor.getWindowsMasterKey()).toBeNull()
  })

  it('getWindowsMasterKey returns null when encrypted_key has no DPAPI prefix', () => {
    const slackDir = mkdtempSync(join(tmpdir(), 'slack-bad-ls-'))
    tempDirs.push(slackDir)

    const localState = { os_crypt: { encrypted_key: Buffer.from('NOTDPAPIdata').toString('base64') } }
    writeFileSync(join(slackDir, 'Local State'), JSON.stringify(localState))

    const extractor = new TokenExtractor('win32', slackDir)
    expect(extractor.getWindowsMasterKey()).toBeNull()
  })

  it('extract throws descriptive error when cookie file is locked (EBUSY)', async () => {
    // given — LevelDB with a valid token but Cookies file locked by Slack
    const slackDir = mkdtempSync(join(tmpdir(), 'slack-ebusy-'))
    tempDirs.push(slackDir)

    const token = `xoxc-1111111111-2222222222-3333333333-${'a'.repeat(64)}`
    const leveldbDir = join(slackDir, 'Local Storage', 'leveldb')
    mkdirSync(leveldbDir, { recursive: true })
    writeFileSync(join(leveldbDir, '000001.log'), `"${token}"T12345678"name":"test-workspace"`)

    writeFileSync(join(slackDir, 'Cookies'), 'placeholder')

    const copyFileSyncSpy = spyOn(fs, 'copyFileSync').mockImplementation(() => {
      const err = new Error('resource busy or locked') as NodeJS.ErrnoException
      err.code = 'EBUSY'
      throw err
    })

    // when — then
    try {
      const extractor = new TokenExtractor('darwin', slackDir)
      await expect(extractor.extract()).rejects.toThrow('Quit the Slack app completely and try again')
    } finally {
      copyFileSyncSpy.mockRestore()
    }
  })

  it('extract decrypts Windows v10 cookies end-to-end with mocked DPAPI', async () => {
    // given — SQLite DB with v10-encrypted cookie, Local State with master key, LevelDB with token
    const slackDir = mkdtempSync(join(tmpdir(), 'slack-win-e2e-'))
    tempDirs.push(slackDir)

    const masterKey = randomBytes(32)
    const dpapiPayload = Buffer.from('dpapi-encrypted-master-key')
    const encryptedKeyWithPrefix = Buffer.concat([Buffer.from('DPAPI'), dpapiPayload])
    const localState = { os_crypt: { encrypted_key: encryptedKeyWithPrefix.toString('base64') } }
    writeFileSync(join(slackDir, 'Local State'), JSON.stringify(localState))

    const cookiePlaintext = 'xoxd-winExtractedCookie%2B'
    const nonce = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', masterKey, nonce)
    const ciphertext = Buffer.concat([cipher.update(cookiePlaintext, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    const encryptedCookie = Buffer.concat([Buffer.from('v10'), nonce, ciphertext, tag])

    createCookiesDb(join(slackDir, 'Cookies'), [
      {
        name: 'd',
        value: '',
        encrypted_value: new Uint8Array(encryptedCookie),
        host_key: '.slack.com',
        last_access_utc: 1,
      },
    ])

    const token = `xoxc-1111111111-2222222222-3333333333-${'a'.repeat(64)}`
    const leveldbDir = join(slackDir, 'Local Storage', 'leveldb')
    mkdirSync(leveldbDir, { recursive: true })
    writeFileSync(join(leveldbDir, '000001.log'), `"${token}"T12345678"name":"test-workspace"`)

    class TestTokenExtractor extends TokenExtractor {
      override decryptDPAPI(encrypted: Buffer): Buffer | null {
        if (encrypted.equals(dpapiPayload)) {
          return masterKey
        }
        return null
      }
    }

    // when
    const extractor = new TestTokenExtractor('win32', slackDir)
    const result = await extractor.extract()

    // then
    expect(result).toEqual([
      {
        workspace_id: 'T12345678',
        workspace_name: 'test-workspace',
        token,
        cookie: 'xoxd-winExtractedCookie%2B',
      },
    ])
  })
})

describe('TokenExtractor IndexedDB blob files', () => {
  it('extracts token from blob file when not in LevelDB', async () => {
    // given — token only exists in an IndexedDB blob file, not in LevelDB
    const slackDir = mkdtempSync(join(tmpdir(), 'slack-blob-'))
    tempDirs.push(slackDir)

    const hex64 = 'a'.repeat(64)
    const token = `xoxc-1111111111-2222222222-3333333333-${hex64}`

    const blobDir = join(slackDir, 'IndexedDB', 'https_app.slack.com_0.indexeddb.blob', '2', '05')
    mkdirSync(blobDir, { recursive: true })
    writeFileSync(join(blobDir, '584'), `"team_name":"blob-workspace"T12345678"token":"${token}"`)

    // when
    const extractor = new TokenExtractor('darwin', slackDir)
    const result = await extractor.extract()

    // then
    expect(result.length).toBe(1)
    expect(result[0].token).toBe(token)
    expect(result[0].workspace_id).toBe('T12345678')
  })

  it('extracts tokens from both LevelDB and blob files for different teams', async () => {
    // given — one workspace token in LevelDB, another in blob file
    const slackDir = mkdtempSync(join(tmpdir(), 'slack-blob-multi-'))
    tempDirs.push(slackDir)

    const hex64a = 'a'.repeat(64)
    const hex64b = 'b'.repeat(64)
    const tokenA = `xoxc-1111111111-2222222222-3333333333-${hex64a}`
    const tokenB = `xoxc-4444444444-5555555555-6666666666-${hex64b}`

    const leveldbDir = join(slackDir, 'IndexedDB', 'https_app.slack.com_0.indexeddb.leveldb')
    mkdirSync(leveldbDir, { recursive: true })
    writeFileSync(join(leveldbDir, '000001.log'), `"${tokenA}"TAAAAAAAA"name":"leveldb-ws"`)

    const blobDir = join(slackDir, 'IndexedDB', 'https_app.slack.com_0.indexeddb.blob', '2', '05')
    mkdirSync(blobDir, { recursive: true })
    writeFileSync(join(blobDir, '584'), `"team_name":"blob-ws"TBBBBBBBBB"token":"${tokenB}"`)

    // when
    const extractor = new TokenExtractor('darwin', slackDir)
    const result = await extractor.extract()

    // then — both workspaces are extracted
    expect(result.length).toBe(2)
    const teamIds = result.map((r) => r.workspace_id).sort()
    expect(teamIds).toEqual(['TAAAAAAAA', 'TBBBBBBBBB'])
  })

  it('LevelDB token wins over blob file token for same team', async () => {
    // given — same team in both LevelDB (.log = highest raw priority) and blob file
    const slackDir = mkdtempSync(join(tmpdir(), 'slack-blob-dedup-'))
    tempDirs.push(slackDir)

    const hex64ldb = 'a'.repeat(64)
    const hex64blob = 'b'.repeat(64)
    const ldbToken = `xoxc-1111111111-2222222222-3333333333-${hex64ldb}`
    const blobToken = `xoxc-4444444444-5555555555-6666666666-${hex64blob}`

    const leveldbDir = join(slackDir, 'IndexedDB', 'https_app.slack.com_0.indexeddb.leveldb')
    mkdirSync(leveldbDir, { recursive: true })
    writeFileSync(join(leveldbDir, '000001.log'), `"${ldbToken}"T12345678"name":"ldb-workspace"`)

    const blobDir = join(slackDir, 'IndexedDB', 'https_app.slack.com_0.indexeddb.blob', '2', '05')
    mkdirSync(blobDir, { recursive: true })
    writeFileSync(join(blobDir, '584'), `"team_name":"blob-workspace"T12345678"token":"${blobToken}"`)

    // when
    const extractor = new TokenExtractor('darwin', slackDir)
    const result = await extractor.extract()

    // then — .log source (priority 3) beats blob-file (priority 1)
    expect(result.length).toBe(1)
    expect(result[0].token).toBe(ldbToken)
  })

  it('merges same token from LDB and blob with different teamIds', async () => {
    // given — same token in LevelDB (correct teamId) and blob file (false-positive teamId from binary)
    const slackDir = mkdtempSync(join(tmpdir(), 'slack-blob-dup-'))
    tempDirs.push(slackDir)

    const hex64 = 'a'.repeat(64)
    const token = `xoxc-1111111111-2222222222-3333333333-${hex64}`

    const leveldbDir = join(slackDir, 'IndexedDB', 'https_app.slack.com_0.indexeddb.leveldb')
    mkdirSync(leveldbDir, { recursive: true })
    writeFileSync(join(leveldbDir, '000001.log'), `"${token}"TREAL12345"name":"real-workspace"`)

    const blobDir = join(slackDir, 'IndexedDB', 'https_app.slack.com_0.indexeddb.blob', '2', '05')
    mkdirSync(blobDir, { recursive: true })
    writeFileSync(join(blobDir, '584'), `"team_name":"blob-name"TFAKEGARBG"token":"${token}"`)

    // when
    const extractor = new TokenExtractor('darwin', slackDir)
    const result = await extractor.extract()

    // then — single entry with the correct teamId from LDB (higher priority source)
    expect(result.length).toBe(1)
    expect(result[0].workspace_id).toBe('TREAL12345')
    expect(result[0].token).toBe(token)
  })

  it('skips blob files larger than 10MB', async () => {
    // given — blob file exceeds size limit
    const slackDir = mkdtempSync(join(tmpdir(), 'slack-blob-large-'))
    tempDirs.push(slackDir)

    const hex64 = 'a'.repeat(64)
    const token = `xoxc-1111111111-2222222222-3333333333-${hex64}`

    const blobDir = join(slackDir, 'IndexedDB', 'https_app.slack.com_0.indexeddb.blob', '1', '00')
    mkdirSync(blobDir, { recursive: true })

    const largeContent = Buffer.alloc(11 * 1024 * 1024)
    Buffer.from(`"team_name":"large"T12345678"${token}"`).copy(largeContent)
    writeFileSync(join(blobDir, '1'), largeContent)

    // when
    const extractor = new TokenExtractor('darwin', slackDir)
    const result = await extractor.extract()

    // then
    expect(result.length).toBe(0)
  })
})

describe('TokenExtractor getWorkspaceDomains', () => {
  it('reads workspace domains from root-state.json', () => {
    // given
    const slackDir = mkdtempSync(join(tmpdir(), 'slack-domains-'))
    tempDirs.push(slackDir)

    const storageDir = join(slackDir, 'storage')
    mkdirSync(storageDir, { recursive: true })
    writeFileSync(
      join(storageDir, 'root-state.json'),
      JSON.stringify({
        workspaces: {
          T111: { domain: 'acme-corp', name: 'Acme', url: 'https://acme-corp.slack.com/' },
          T222: { domain: 'devteam', name: 'Dev', url: 'https://devteam.slack.com/' },
        },
      }),
    )

    // when
    const extractor = new TokenExtractor('darwin', slackDir)
    const domains = extractor.getWorkspaceDomains()

    // then
    expect(domains).toEqual({ T111: 'acme-corp', T222: 'devteam' })
  })

  it('returns empty when root-state.json is missing', () => {
    // given
    const slackDir = mkdtempSync(join(tmpdir(), 'slack-no-rootstate-'))
    tempDirs.push(slackDir)

    // when
    const extractor = new TokenExtractor('darwin', slackDir)
    const domains = extractor.getWorkspaceDomains()

    // then
    expect(domains).toEqual({})
  })

  it('returns empty when root-state.json has no workspaces', () => {
    // given
    const slackDir = mkdtempSync(join(tmpdir(), 'slack-empty-rootstate-'))
    tempDirs.push(slackDir)

    const storageDir = join(slackDir, 'storage')
    mkdirSync(storageDir, { recursive: true })
    writeFileSync(join(storageDir, 'root-state.json'), JSON.stringify({ settings: {} }))

    // when
    const extractor = new TokenExtractor('darwin', slackDir)
    const domains = extractor.getWorkspaceDomains()

    // then
    expect(domains).toEqual({})
  })

  it('skips workspaces without domain field', () => {
    // given
    const slackDir = mkdtempSync(join(tmpdir(), 'slack-partial-rootstate-'))
    tempDirs.push(slackDir)

    const storageDir = join(slackDir, 'storage')
    mkdirSync(storageDir, { recursive: true })
    writeFileSync(
      join(storageDir, 'root-state.json'),
      JSON.stringify({
        workspaces: {
          T111: { domain: 'acme-corp', name: 'Acme' },
          T222: { name: 'NoDomain' },
        },
      }),
    )

    // when
    const extractor = new TokenExtractor('darwin', slackDir)
    const domains = extractor.getWorkspaceDomains()

    // then
    expect(domains).toEqual({ T111: 'acme-corp' })
  })
})

describe('TokenExtractor browser fallback', () => {
  it('extractFromBrowsers returns empty array when no browser profiles have tokens', async () => {
    const slackDir = mkdtempSync(join(tmpdir(), 'slack-nonexistent-'))
    tempDirs.push(slackDir)
    rmSync(slackDir, { recursive: true, force: true })

    const extractor = new TokenExtractor('darwin', slackDir)
    const result = await extractor.extractFromBrowsers()
    expect(result).toEqual([])
  })

  it('extract tries desktop before browser profiles', async () => {
    // given — slackDir with LevelDB token data
    const slackDir = mkdtempSync(join(tmpdir(), 'slack-fallback-desktop-'))
    tempDirs.push(slackDir)

    const hex64 = 'a'.repeat(64)
    const token = `xoxc-1111111111-2222222222-3333333333-${hex64}`
    const leveldbDir = join(slackDir, 'Local Storage', 'leveldb')
    mkdirSync(leveldbDir, { recursive: true })
    writeFileSync(join(leveldbDir, '000001.log'), `"${token}"T12345678"name":"desktop-workspace"`)

    const extractFromBrowsersSpy = spyOn(TokenExtractor.prototype as any, 'extractFromBrowsers').mockResolvedValue([])

    // when
    const extractor = new TokenExtractor('darwin', slackDir)
    const result = await extractor.extract()

    // then — desktop extraction succeeded, browser not called
    expect(result.length).toBeGreaterThan(0)
    expect(extractFromBrowsersSpy).not.toHaveBeenCalled()

    extractFromBrowsersSpy.mockRestore()
  })

  it('extract falls back to browser profiles when desktop has no tokens', async () => {
    // given — empty slackDir (no tokens)
    const slackDir = mkdtempSync(join(tmpdir(), 'slack-fallback-browser-'))
    tempDirs.push(slackDir)

    const hex64 = 'b'.repeat(64)
    const browserToken = `xoxc-9999999999-8888888888-7777777777-${hex64}`
    const browserWorkspace: ExtractedWorkspace = {
      workspace_id: 'T99999999',
      workspace_name: 'browser-workspace',
      token: browserToken,
      cookie: '',
    }

    const extractFromBrowsersSpy = spyOn(TokenExtractor.prototype as any, 'extractFromBrowsers').mockResolvedValue([
      browserWorkspace,
    ])

    // when
    const extractor = new TokenExtractor('darwin', slackDir)
    const result = await extractor.extract()

    // then — browser fallback used
    expect(extractFromBrowsersSpy).toHaveBeenCalled()
    expect(result).toEqual([browserWorkspace])

    extractFromBrowsersSpy.mockRestore()
  })

  it('extract falls back to browser when slackDir does not exist', async () => {
    // given — non-existent slackDir
    const slackDir = '/nonexistent/slack/dir'
    const hex64 = 'c'.repeat(64)
    const browserToken = `xoxc-1234567890-0987654321-1122334455-${hex64}`
    const browserWorkspace: ExtractedWorkspace = {
      workspace_id: 'T11111111',
      workspace_name: 'browser-ws',
      token: browserToken,
      cookie: 'xoxd-browser-cookie',
    }

    const extractFromBrowsersSpy = spyOn(TokenExtractor.prototype as any, 'extractFromBrowsers').mockResolvedValue([
      browserWorkspace,
    ])

    // when
    const extractor = new TokenExtractor('darwin', slackDir)
    const result = await extractor.extract()

    // then
    expect(extractFromBrowsersSpy).toHaveBeenCalled()
    expect(result).toEqual([browserWorkspace])

    extractFromBrowsersSpy.mockRestore()
  })
})
