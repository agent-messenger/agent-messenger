import { execSync } from 'node:child_process'
import { copyFileSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

import type { ExtractedKakaoToken } from './types'

const require = createRequire(import.meta.url)

export class KakaoTokenExtractor {
  private platform: NodeJS.Platform
  private debugLog: ((message: string) => void) | null

  constructor(platform?: NodeJS.Platform, debugLog?: (message: string) => void) {
    this.platform = platform ?? process.platform
    this.debugLog = debugLog ?? null
  }

  private debug(message: string): void {
    this.debugLog?.(message)
  }

  async extract(): Promise<ExtractedKakaoToken | null> {
    switch (this.platform) {
      case 'darwin':
        return this.extractMacOS()
      case 'win32':
        return this.extractWindows()
      default:
        this.debug(`No extraction available for platform: ${this.platform}`)
        return null
    }
  }

  // macOS Cache.db path: NSURLCache SQLite in KakaoTalk's app container.
  // Cached HTTP requests contain Authorization header (oauth_token) in plist BLOBs.
  private getCacheDbPath(): string | null {
    const containerPath = join(
      homedir(),
      'Library',
      'Containers',
      'com.kakao.KakaoTalkMac',
      'Data',
      'Library',
      'Caches',
      'Cache.db',
    )

    if (existsSync(containerPath)) {
      this.debug(`Found Cache.db at: ${containerPath}`)
      return containerPath
    }

    this.debug(`Cache.db not found at: ${containerPath}`)
    return null
  }

  private async extractMacOS(): Promise<ExtractedKakaoToken | null> {
    const cacheDbPath = this.getCacheDbPath()
    if (!cacheDbPath) {
      this.debug('KakaoTalk desktop app not found on macOS')
      return null
    }

    const tempPath = join(tmpdir(), `kakao-cache-${Date.now()}-${Math.random().toString(36).slice(2)}.db`)

    try {
      copyFileSync(cacheDbPath, tempPath)
      // SQLite WAL mode: must also copy -wal and -shm journal files
      for (const suffix of ['-wal', '-shm']) {
        const journalPath = `${cacheDbPath}${suffix}`
        if (existsSync(journalPath)) {
          copyFileSync(journalPath, `${tempPath}${suffix}`)
        }
      }
    } catch (error) {
      this.debug(`Failed to copy Cache.db: ${(error as Error).message}`)
      return null
    }

    try {
      return this.readCacheDb(tempPath)
    } finally {
      try {
        rmSync(tempPath, { force: true })
        rmSync(`${tempPath}-wal`, { force: true })
        rmSync(`${tempPath}-shm`, { force: true })
      } catch {}
    }
  }

  private readCacheDb(dbPath: string): ExtractedKakaoToken | null {
    // request_object contains a binary plist with HTTP headers.
    // Prioritize endpoints most likely to have fresh tokens:
    //   more_settings.json > chats > profile3/me.json > others
    const sql = `
      SELECT b.request_object, r.request_key, r.time_stamp
      FROM cfurl_cache_blob_data b
      JOIN cfurl_cache_response r ON b.entry_ID = r.entry_ID
      WHERE r.request_key LIKE '%kakao.com%'
      ORDER BY r.time_stamp DESC
      LIMIT 50
    `

    type CacheRow = {
      request_object: Uint8Array | Buffer | null
      request_key: string
      time_stamp: number
    }

    let rows: CacheRow[]
    if (typeof globalThis.Bun !== 'undefined') {
      const { Database } = require('bun:sqlite')
      const db = new Database(dbPath, { readonly: true })
      rows = db.query(sql).all() as CacheRow[]
      db.close()
    } else {
      const Database = require('better-sqlite3')
      const db = new Database(dbPath, { readonly: true })
      rows = db.prepare(sql).all() as CacheRow[]
      db.close()
    }

    this.debug(`Found ${rows.length} cached request(s) to kakao.com`)

    // talk-pilsner.kakao.com has the real messaging oauth tokens.
    // Other subdomains (bzm-capi, etc.) use different token types.
    rows.sort((a, b) => {
      const domainPriority = (url: string): number =>
        url.includes('talk-pilsner.kakao.com') ? 10 : 0
      const endpointPriority = (url: string): number => {
        if (url.includes('more_settings.json')) return 4
        if (url.includes('/chats')) return 3
        if (url.includes('profile3/me.json')) return 2
        return 1
      }
      const aScore = domainPriority(a.request_key) + endpointPriority(a.request_key)
      const bScore = domainPriority(b.request_key) + endpointPriority(b.request_key)
      return bScore !== aScore ? bScore - aScore : b.time_stamp - a.time_stamp
    })

    for (const row of rows) {
      if (!row.request_object) continue

      const blob = Buffer.from(row.request_object)
      const token = this.parseAuthFromPlist(blob)
      if (token) {
        this.debug(`Extracted token from: ${row.request_key}`)
        return token
      }
    }

    this.debug('No valid tokens found in Cache.db')
    return null
  }

  // Binary plist: keys and values are stored in separate regions, so we can't
  // rely on "find key → read next string". Instead, extract all printable
  // strings and match known patterns: the oauth token is a long hex+base64
  // string (~65-138 chars), the user ID is an 8+ digit number.
  private parseAuthFromPlist(blob: Buffer): ExtractedKakaoToken | null {
    const data = blob.toString('latin1')
    if (!data.includes('Authorization')) return null

    // KakaoTalk REST oauth token: 32 hex chars + digits + base64, ending with ==
    // e.g. "7c826a16c1434c3b9253c03e80cffcc800000017739740969540020sbztPzgoNH-...sg=="
    const tokenMatch = data.match(/[0-9a-f]{32}[0-9A-Za-z+/=-]{60,}==/)
    if (!tokenMatch) return null

    // User ID is a digit string preceded by a plist length-prefix byte (e.g. X = 0x58)
    // and followed by a null byte or other non-digit byte
    const userId = data.match(/[^0-9](\d{6,12})\x00/)
    const agentMatch = data.match(/mac\/\d+\.\d+\.\d+\/\w+/)
    const uaMatch = data.match(/KakaoTalk\/[^)]+\)/)

    return {
      oauth_token: tokenMatch[0],
      user_id: userId?.[1] ?? '',
      agent_header: agentMatch?.[0] ?? undefined,
      user_agent: uaMatch?.[0] ?? undefined,
    }
  }

  // Windows: registry HKCU\Software\Kakao\KakaoTalk\DeviceInfo for device UUID,
  // and %LocalAppData%\Kakao\login_list.dat for login credentials.
  private extractWindows(): ExtractedKakaoToken | null {
    const deviceInfo = this.readWindowsRegistry()
    const loginData = this.readWindowsLoginList()

    if (!deviceInfo && !loginData) {
      this.debug('No KakaoTalk credentials found on Windows')
      return null
    }

    return {
      oauth_token: loginData?.token ?? '',
      user_id: loginData?.userId ?? '',
      device_uuid: deviceInfo?.deviceUuid ?? undefined,
    }
  }

  private readWindowsRegistry(): { deviceUuid: string; deviceId: string } | null {
    try {
      const regOutput = execSync(
        'reg query "HKCU\\Software\\Kakao\\KakaoTalk\\DeviceInfo" /s 2>nul',
        { encoding: 'utf8', timeout: 5000 },
      )

      const uuidMatch = regOutput.match(/sys_uuid\s+REG_SZ\s+(.+)/i)
      const deviceIdMatch = regOutput.match(/dev_id\s+REG_SZ\s+(.+)/i)

      if (!uuidMatch) {
        this.debug('No sys_uuid found in registry')
        return null
      }

      this.debug(`Found device UUID in registry: ${uuidMatch[1].trim().substring(0, 8)}...`)
      return {
        deviceUuid: uuidMatch[1].trim(),
        deviceId: deviceIdMatch?.[1].trim() ?? '',
      }
    } catch {
      this.debug('Failed to read KakaoTalk registry')
      return null
    }
  }

  private readWindowsLoginList(): { token: string; userId: string } | null {
    const localAppData = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local')
    const loginListPath = join(localAppData, 'Kakao', 'login_list.dat')

    if (!existsSync(loginListPath)) {
      this.debug(`login_list.dat not found at: ${loginListPath}`)
      return null
    }

    try {
      const content = readFileSync(loginListPath, 'utf-8')
      this.debug('Found login_list.dat')

      const tokenMatch = content.match(/[A-Za-z0-9_-]{20,}/)
      const userIdMatch = content.match(/\d{10,}/)

      if (!tokenMatch) {
        this.debug('No token found in login_list.dat')
        return null
      }

      return {
        token: tokenMatch[0],
        userId: userIdMatch?.[0] ?? '',
      }
    } catch (error) {
      this.debug(`Failed to read login_list.dat: ${(error as Error).message}`)
      return null
    }
  }
}
