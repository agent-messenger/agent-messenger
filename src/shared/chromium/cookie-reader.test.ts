import { Database } from 'bun:sqlite'
import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ChromiumCookieReader } from './cookie-reader'

function createTestCookieDb(
  dbPath: string,
  rows: Array<{ name: string; value: string; encrypted_value: Buffer | null }>,
): void {
  const db = new Database(dbPath)
  db.run('CREATE TABLE cookies (name TEXT, value TEXT, encrypted_value BLOB)')
  const stmt = db.prepare('INSERT INTO cookies (name, value, encrypted_value) VALUES (?, ?, ?)')
  for (const row of rows) {
    stmt.run(row.name, row.value, row.encrypted_value)
  }
  db.close()
}

describe('ChromiumCookieReader', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const tempDir of tempDirs.splice(0)) {
      if (existsSync(tempDir)) {
        rmSync(tempDir, { recursive: true, force: true })
      }
    }
  })

  describe('queryAll', () => {
    it('returns all matching rows from a real SQLite database', async () => {
      // given
      const tempDir = mkdtempSync(join(tmpdir(), 'chromium-cookie-reader-'))
      tempDirs.push(tempDir)
      const dbPath = join(tempDir, 'Cookies')
      createTestCookieDb(dbPath, [
        { name: 'session', value: 'abc123', encrypted_value: null },
        { name: 'token', value: 'xyz789', encrypted_value: null },
      ])
      const reader = new ChromiumCookieReader()

      // when
      const result = await reader.queryAll<{ name: string; value: string }>(
        dbPath,
        'SELECT name, value FROM cookies ORDER BY name ASC',
      )

      // then
      expect(result).toEqual([
        { name: 'session', value: 'abc123' },
        { name: 'token', value: 'xyz789' },
      ])
    })

    it('returns empty array when database file does not exist', async () => {
      // given
      const tempDir = mkdtempSync(join(tmpdir(), 'chromium-cookie-reader-'))
      tempDirs.push(tempDir)
      const dbPath = join(tempDir, 'missing.db')
      const reader = new ChromiumCookieReader()

      // when
      const result = await reader.queryAll<{ name: string }>(dbPath, 'SELECT name FROM cookies')

      // then
      expect(result).toEqual([])
    })

    it('returns empty array when query matches no rows', async () => {
      // given
      const tempDir = mkdtempSync(join(tmpdir(), 'chromium-cookie-reader-'))
      tempDirs.push(tempDir)
      const dbPath = join(tempDir, 'Cookies')
      createTestCookieDb(dbPath, [{ name: 'session', value: 'abc123', encrypted_value: null }])
      const reader = new ChromiumCookieReader()

      // when
      const result = await reader.queryAll<{ name: string }>(dbPath, 'SELECT name FROM cookies WHERE name = ?', [
        'missing',
      ])

      // then
      expect(result).toEqual([])
    })

    it('supports parameterized queries with params', async () => {
      // given
      const tempDir = mkdtempSync(join(tmpdir(), 'chromium-cookie-reader-'))
      tempDirs.push(tempDir)
      const dbPath = join(tempDir, 'Cookies')
      createTestCookieDb(dbPath, [
        { name: 'session', value: 'abc123', encrypted_value: null },
        { name: 'token', value: 'xyz789', encrypted_value: null },
      ])
      const reader = new ChromiumCookieReader()

      // when
      const result = await reader.queryAll<{ name: string; value: string }>(
        dbPath,
        'SELECT name, value FROM cookies WHERE name = ?',
        ['token'],
      )

      // then
      expect(result).toEqual([{ name: 'token', value: 'xyz789' }])
    })

    it('cleans up temp file after query', async () => {
      // given
      const tempDir = mkdtempSync(join(tmpdir(), 'chromium-cookie-reader-'))
      tempDirs.push(tempDir)
      const dbPath = join(tempDir, 'Cookies')
      createTestCookieDb(dbPath, [{ name: 'session', value: 'abc123', encrypted_value: null }])
      const reader = new ChromiumCookieReader()
      const originalDateNow = Date.now
      const originalMathRandom = Math.random
      Date.now = () => 1234567890
      Math.random = () => 0
      const expectedTempPath = join(tmpdir(), 'chromium-cookies-1234567890-.db')

      try {
        // when
        await reader.queryAll<{ name: string }>(dbPath, 'SELECT name FROM cookies')

        // then
        expect(existsSync(expectedTempPath)).toBe(false)
      } finally {
        Date.now = originalDateNow
        Math.random = originalMathRandom
      }
    })
  })

  describe('queryFirst', () => {
    it('returns first matching row from a real SQLite database', async () => {
      // given
      const tempDir = mkdtempSync(join(tmpdir(), 'chromium-cookie-reader-'))
      tempDirs.push(tempDir)
      const dbPath = join(tempDir, 'Cookies')
      createTestCookieDb(dbPath, [
        { name: 'session', value: 'abc123', encrypted_value: null },
        { name: 'token', value: 'xyz789', encrypted_value: null },
      ])
      const reader = new ChromiumCookieReader()

      // when
      const result = await reader.queryFirst<{ name: string; value: string }>(
        dbPath,
        'SELECT name, value FROM cookies ORDER BY name ASC',
      )

      // then
      expect(result).toEqual({ name: 'session', value: 'abc123' })
    })

    it('returns null when database file does not exist', async () => {
      // given
      const tempDir = mkdtempSync(join(tmpdir(), 'chromium-cookie-reader-'))
      tempDirs.push(tempDir)
      const dbPath = join(tempDir, 'missing.db')
      const reader = new ChromiumCookieReader()

      // when
      const result = await reader.queryFirst<{ name: string }>(dbPath, 'SELECT name FROM cookies')

      // then
      expect(result).toBeNull()
    })

    it('returns null when query matches no rows', async () => {
      // given
      const tempDir = mkdtempSync(join(tmpdir(), 'chromium-cookie-reader-'))
      tempDirs.push(tempDir)
      const dbPath = join(tempDir, 'Cookies')
      createTestCookieDb(dbPath, [{ name: 'session', value: 'abc123', encrypted_value: null }])
      const reader = new ChromiumCookieReader()

      // when
      const result = await reader.queryFirst<{ name: string }>(dbPath, 'SELECT name FROM cookies WHERE name = ?', [
        'missing',
      ])

      // then
      expect(result).toBeNull()
    })

    it('supports parameterized queries with params', async () => {
      // given
      const tempDir = mkdtempSync(join(tmpdir(), 'chromium-cookie-reader-'))
      tempDirs.push(tempDir)
      const dbPath = join(tempDir, 'Cookies')
      createTestCookieDb(dbPath, [
        { name: 'session', value: 'abc123', encrypted_value: null },
        { name: 'token', value: 'xyz789', encrypted_value: null },
      ])
      const reader = new ChromiumCookieReader()

      // when
      const result = await reader.queryFirst<{ name: string; value: string }>(
        dbPath,
        'SELECT name, value FROM cookies WHERE name = ?',
        ['token'],
      )

      // then
      expect(result).toEqual({ name: 'token', value: 'xyz789' })
    })
  })

  describe('edge cases', () => {
    it('handles multiple calls to same reader instance', async () => {
      // given
      const tempDir = mkdtempSync(join(tmpdir(), 'chromium-cookie-reader-'))
      tempDirs.push(tempDir)
      const dbPath = join(tempDir, 'Cookies')
      createTestCookieDb(dbPath, [
        { name: 'session', value: 'abc123', encrypted_value: null },
        { name: 'token', value: 'xyz789', encrypted_value: null },
      ])
      const reader = new ChromiumCookieReader()

      // when
      const allRows = await reader.queryAll<{ name: string; value: string }>(
        dbPath,
        'SELECT name, value FROM cookies ORDER BY name ASC',
      )
      const firstRow = await reader.queryFirst<{ name: string; value: string }>(
        dbPath,
        'SELECT name, value FROM cookies WHERE name = ?',
        ['token'],
      )

      // then
      expect(allRows).toEqual([
        { name: 'session', value: 'abc123' },
        { name: 'token', value: 'xyz789' },
      ])
      expect(firstRow).toEqual({ name: 'token', value: 'xyz789' })
    })

    it('returns empty array for malformed SQL without throwing', async () => {
      // given
      const tempDir = mkdtempSync(join(tmpdir(), 'chromium-cookie-reader-'))
      tempDirs.push(tempDir)
      const dbPath = join(tempDir, 'Cookies')
      createTestCookieDb(dbPath, [{ name: 'session', value: 'abc123', encrypted_value: null }])
      const reader = new ChromiumCookieReader()

      // when
      const result = await reader.queryAll<{ name: string }>(dbPath, 'SELECT FROM cookies')

      // then
      expect(result).toEqual([])
    })

    it('returns null for malformed SQL without throwing', async () => {
      // given
      const tempDir = mkdtempSync(join(tmpdir(), 'chromium-cookie-reader-'))
      tempDirs.push(tempDir)
      const dbPath = join(tempDir, 'Cookies')
      createTestCookieDb(dbPath, [{ name: 'session', value: 'abc123', encrypted_value: null }])
      const reader = new ChromiumCookieReader()

      // when
      const result = await reader.queryFirst<{ name: string }>(dbPath, 'SELECT FROM cookies')

      // then
      expect(result).toBeNull()
    })
  })
})
