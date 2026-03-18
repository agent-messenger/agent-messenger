import { copyFileSync, existsSync, unlinkSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

import type { ExtractedChannelToken } from './types'

const require = createRequire(import.meta.url)

export class ChannelTokenExtractor {
  private platform: NodeJS.Platform

  constructor(platform?: NodeJS.Platform) {
    this.platform = platform ?? process.platform
  }

  getCookiesPath(): string | null {
    if (this.platform !== 'darwin') {
      return null
    }

    const sandboxedPath = join(
      homedir(),
      'Library',
      'Containers',
      'com.zoyi.channel.desk.osx',
      'Data',
      'Library',
      'Application Support',
      'Channel Talk',
      'Cookies',
    )
    if (existsSync(sandboxedPath)) {
      return sandboxedPath
    }

    const directPath = join(homedir(), 'Library', 'Application Support', 'Channel Talk', 'Cookies')
    return existsSync(directPath) ? directPath : null
  }

  async extract(): Promise<ExtractedChannelToken | null> {
    const cookiesPath = this.getCookiesPath()
    if (!cookiesPath) {
      return null
    }

    const tempPath = join(tmpdir(), `channel-cookies-${Date.now()}`)

    try {
      copyFileSync(cookiesPath, tempPath)
      const sql = `
        SELECT name, value FROM cookies
        WHERE name IN ('x-account', 'ch-session-1')
        AND host_key LIKE '%.channel.io%'
      `
      type CookieRow = { name: string; value: string }
      const rows: CookieRow[] = typeof globalThis.Bun !== 'undefined'
        ? (() => {
            const { Database } = require('bun:sqlite')
            const db = new Database(tempPath, { readonly: true })
            const result = db.query(sql).all() as CookieRow[]
            db.close()
            return result
          })()
        : (() => {
            const Database = require('better-sqlite3')
            const db = new Database(tempPath, { readonly: true })
            const result = db.prepare(sql).all() as CookieRow[]
            db.close()
            return result
          })()

      const accountCookie = rows.find((row) => row.name === 'x-account')?.value
      const sessionCookie = rows.find((row) => row.name === 'ch-session-1')?.value

      return accountCookie && sessionCookie ? { accountCookie, sessionCookie } : null
    } catch {
      /* extraction failed (e.g. SQLite error); return null */
      return null
    } finally {
      try {
        if (existsSync(tempPath)) {
          unlinkSync(tempPath)
        }
      } catch {
        /* temp file cleanup failure is non-critical */
      }
    }
  }
}
