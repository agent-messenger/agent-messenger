import { Database } from 'bun:sqlite'
import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { createCipheriv, randomBytes } from 'node:crypto'
import * as fs from 'node:fs'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { TokenExtractor } from './token-extractor'

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

describe('TokenExtractor Windows DPAPI', () => {
  test('decryptDPAPI returns null on non-win32 platform', () => {
    const extractor = new TokenExtractor('darwin', '/tmp/slack-test')
    expect(extractor.decryptDPAPI(Buffer.from('test'))).toBeNull()
  })

  test('decryptV10CookieWindows decrypts AES-256-GCM with master key from Local State', () => {
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

  test('decryptV10CookieWindows falls back to direct DPAPI when no Local State', () => {
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

  test('tryDecryptCookie handles Windows pre-v80 cookies without version prefix', () => {
    class TestTokenExtractor extends TokenExtractor {
      override decryptDPAPI(_encrypted: Buffer): Buffer | null {
        return Buffer.from('xoxd-preV80Cookie%2B')
      }
    }

    const extractor = new TestTokenExtractor('win32', '/tmp/slack-test')
    const encrypted = Buffer.from([0x01, 0x00, 0x00, 0x00, 0xaa, 0xbb, 0xcc])

    expect(extractor.tryDecryptCookie(encrypted)).toBe('xoxd-preV80Cookie%2B')
  })

  test('getWindowsMasterKey reads and decrypts key from Local State file', () => {
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

  test('getWindowsMasterKey returns null when Local State is missing', () => {
    const slackDir = mkdtempSync(join(tmpdir(), 'slack-no-ls-'))
    tempDirs.push(slackDir)

    const extractor = new TokenExtractor('win32', slackDir)
    expect(extractor.getWindowsMasterKey()).toBeNull()
  })

  test('getWindowsMasterKey returns null when encrypted_key has no DPAPI prefix', () => {
    const slackDir = mkdtempSync(join(tmpdir(), 'slack-bad-ls-'))
    tempDirs.push(slackDir)

    const localState = { os_crypt: { encrypted_key: Buffer.from('NOTDPAPIdata').toString('base64') } }
    writeFileSync(join(slackDir, 'Local State'), JSON.stringify(localState))

    const extractor = new TokenExtractor('win32', slackDir)
    expect(extractor.getWindowsMasterKey()).toBeNull()
  })

  test('extract throws descriptive error when cookie file is locked (EBUSY)', async () => {
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
    const extractor = new TokenExtractor('darwin', slackDir)
    await expect(extractor.extract()).rejects.toThrow('Quit the Slack app completely and try again')

    copyFileSyncSpy.mockRestore()
  })

  test('extract decrypts Windows v10 cookies end-to-end with mocked DPAPI', async () => {
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
