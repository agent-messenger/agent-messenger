import { copyFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { openReadonlyDatabase } from '@/shared/sqlite'

/**
 * Reads Chromium SQLite cookie databases with Bun/Node dual-runtime support.
 * Copies the database to a temp file to avoid lock contention when the app is running.
 */
export class ChromiumCookieReader {
  /**
   * Copy SQLite DB to temp, run query, return all matching rows, cleanup.
   * Returns empty array if db doesn't exist or query fails.
   */
  async queryAll<T>(dbPath: string, sql: string, params?: unknown[]): Promise<T[]> {
    if (!existsSync(dbPath)) return []

    const tempPath = this.createTempPath()

    try {
      this.copySnapshot(dbPath, tempPath)
    } catch {
      return []
    }

    try {
      return this.executeQuery<T>(tempPath, sql, params, 'all')
    } catch {
      return []
    } finally {
      this.cleanupTemp(tempPath)
    }
  }

  /**
   * Copy SQLite DB to temp, run query, return first matching row, cleanup.
   * Returns null if db doesn't exist, no rows match, or query fails.
   */
  async queryFirst<T>(dbPath: string, sql: string, params?: unknown[]): Promise<T | null> {
    if (!existsSync(dbPath)) return null

    const tempPath = this.createTempPath()

    try {
      this.copySnapshot(dbPath, tempPath)
    } catch {
      return null
    }

    try {
      return this.executeQuery<T>(tempPath, sql, params, 'first')
    } catch {
      return null
    } finally {
      this.cleanupTemp(tempPath)
    }
  }

  private createTempPath(): string {
    return join(tmpdir(), `chromium-cookies-${Date.now()}-${Math.random().toString(36).slice(2)}.db`)
  }

  private copySnapshot(sourcePath: string, destinationPath: string): void {
    copyFileSync(sourcePath, destinationPath)
    for (const suffix of ['-wal', '-shm']) {
      const sourceSidecar = `${sourcePath}${suffix}`
      if (existsSync(sourceSidecar)) copyFileSync(sourceSidecar, `${destinationPath}${suffix}`)
    }
  }

  private executeQuery<T>(tempPath: string, sql: string, params: unknown[] | undefined, mode: 'all'): T[]
  private executeQuery<T>(tempPath: string, sql: string, params: unknown[] | undefined, mode: 'first'): T | null
  private executeQuery<T>(
    tempPath: string,
    sql: string,
    params: unknown[] | undefined,
    mode: 'all' | 'first',
  ): T[] | T | null {
    const db = openReadonlyDatabase(tempPath)

    try {
      const stmt = db.prepare(sql)
      if (mode === 'all') {
        return (params ? stmt.all(...params) : stmt.all()) as T[]
      }

      const row = params ? stmt.get(...params) : stmt.get()
      return (row ?? null) as T | null
    } finally {
      db.close()
    }
  }

  private cleanupTemp(tempPath: string): void {
    try {
      rmSync(tempPath, { force: true })
      rmSync(`${tempPath}-wal`, { force: true })
      rmSync(`${tempPath}-shm`, { force: true })
    } catch {
      // Temp file cleanup failure is non-critical
    }
  }
}
