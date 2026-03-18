import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
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

  test('returns null when cookies path does not exist', async () => {
    class MissingPathExtractor extends ChannelTokenExtractor {
      override getCookiesPath(): string | null {
        return null
      }
    }

    const extractor = new MissingPathExtractor('darwin')

    expect(await extractor.extract()).toBeNull()
  })

  test('extracts plaintext cookies from a real sqlite database', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'channel-cookie-db-'))
    tempDirs.push(tempDir)
    const dbPath = join(tempDir, 'Cookies')
    await createCookieDatabase(dbPath, [
      { name: 'x-account', value: 'account-jwt', host_key: '.desk.channel.io' },
      { name: 'ch-session-1', value: 'session-jwt', host_key: '.desk.channel.io' },
      { name: 'other', value: 'ignore-me', host_key: '.channel.io' },
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

    expect(await extractor.extract()).toEqual({
      accountCookie: 'account-jwt',
      sessionCookie: 'session-jwt',
    })
  })

  test('returns token with undefined sessionCookie when only x-account is present', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'channel-cookie-db-'))
    tempDirs.push(tempDir)
    const dbPath = join(tempDir, 'Cookies')
    await createCookieDatabase(dbPath, [{ name: 'x-account', value: 'account-jwt', host_key: '.channel.io' }])

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

    expect(result).not.toBeNull()
    expect(result?.accountCookie).toBe('account-jwt')
    expect(result?.sessionCookie).toBeUndefined()
  })

  test('returns null when x-account is missing', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'channel-cookie-db-'))
    tempDirs.push(tempDir)
    const dbPath = join(tempDir, 'Cookies')
    await createCookieDatabase(dbPath, [{ name: 'ch-session-1', value: 'session-jwt', host_key: '.channel.io' }])

    class TestExtractor extends ChannelTokenExtractor {
      constructor(private dbPath: string) {
        super('darwin')
      }

      override getCookiesPath(): string | null {
        return this.dbPath
      }
    }

    const extractor = new TestExtractor(dbPath)

    expect(await extractor.extract()).toBeNull()
  })
})

async function createCookieDatabase(
  dbPath: string,
  rows: Array<{ name: string; value: string; host_key: string }>,
): Promise<void> {
  if (typeof globalThis.Bun !== 'undefined') {
    const { Database } = await import('bun:sqlite')
    const db = new Database(dbPath)
    db.run('PRAGMA journal_mode = DELETE')
    db.run('CREATE TABLE cookies (name TEXT, value TEXT, host_key TEXT)')
    for (const row of rows) {
      db.run('INSERT INTO cookies (name, value, host_key) VALUES (?, ?, ?)', [row.name, row.value, row.host_key])
    }
    db.close()
    return
  }

  const { createRequire } = await import('node:module')
  const req = createRequire(import.meta.url)
  const Database = req('better-sqlite3')
  const db = new Database(dbPath)
  db.exec('CREATE TABLE cookies (name TEXT, value TEXT, host_key TEXT)')
  const statement = db.prepare('INSERT INTO cookies (name, value, host_key) VALUES (?, ?, ?)')
  for (const row of rows) {
    statement.run(row.name, row.value, row.host_key)
  }
  db.close()
}
