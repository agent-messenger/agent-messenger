import { execSync } from 'node:child_process'
import { createDecipheriv, pbkdf2Sync } from 'node:crypto'
import { copyFileSync, existsSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { ClassicLevel } from 'classic-level'

const require = createRequire(import.meta.url)

export interface ExtractedWorkspace {
  workspace_id: string
  workspace_name: string
  token: string
  cookie: string
}

interface TokenInfo {
  token: string
  teamId: string
  teamName: string
}

export class TokenExtractor {
  private platform: NodeJS.Platform
  private slackDir: string

  constructor(platform?: NodeJS.Platform, slackDir?: string) {
    this.platform = platform ?? process.platform

    if (!['darwin', 'linux', 'win32'].includes(this.platform)) {
      throw new Error(`Unsupported platform: ${this.platform}`)
    }

    this.slackDir = slackDir ?? this.getSlackDir()
  }

  getSlackDir(): string {
    switch (this.platform) {
      case 'darwin': {
        // Check direct download version first
        const directPath = join(homedir(), 'Library', 'Application Support', 'Slack')
        if (existsSync(directPath)) {
          return directPath
        }
        // Check App Store (sandboxed) version
        const sandboxedPath = join(
          homedir(),
          'Library',
          'Containers',
          'com.tinyspeck.slackmacgap',
          'Data',
          'Library',
          'Application Support',
          'Slack'
        )
        if (existsSync(sandboxedPath)) {
          return sandboxedPath
        }
        // Default to direct path for error message
        return directPath
      }
      case 'linux':
        return join(homedir(), '.config', 'Slack')
      case 'win32':
        return join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'Slack')
      default:
        throw new Error(`Unsupported platform: ${this.platform}`)
    }
  }

  async extract(): Promise<ExtractedWorkspace[]> {
    if (!existsSync(this.slackDir)) {
      throw new Error(`Slack directory not found: ${this.slackDir}`)
    }

    const tokens = await this.extractTokensFromLevelDB()
    if (tokens.length === 0) {
      return []
    }

    const cookie = await this.extractCookieFromSQLite()

    return tokens.map((t) => ({
      workspace_id: t.teamId,
      workspace_name: t.teamName,
      token: t.token,
      cookie: cookie,
    }))
  }

  private async extractTokensFromLevelDB(): Promise<TokenInfo[]> {
    const possibleDirs = [
      join(this.slackDir, 'storage'),
      join(this.slackDir, 'Local Storage', 'leveldb'),
      join(this.slackDir, 'IndexedDB'),
    ]

    const tokens: TokenInfo[] = []

    for (const baseDir of possibleDirs) {
      if (!existsSync(baseDir)) {
        continue
      }

      const levelDbDirs = this.findLevelDBDirs(baseDir)
      if (baseDir.endsWith('leveldb') && this.isLevelDBDir(baseDir)) {
        levelDbDirs.push(baseDir)
      }

      for (const dbDir of levelDbDirs) {
        try {
          const extracted = await this.extractFromLevelDB(dbDir)
          tokens.push(...extracted)
        } catch {}
      }
    }

    return this.deduplicateTokens(tokens)
  }

  private deduplicateTokens(tokens: TokenInfo[]): TokenInfo[] {
    const seen = new Map<string, TokenInfo>()
    for (const token of tokens) {
      if (!seen.has(token.teamId) || token.teamName !== 'unknown') {
        seen.set(token.teamId, token)
      }
    }
    return Array.from(seen.values())
  }

  private findLevelDBDirs(baseDir: string): string[] {
    const dirs: string[] = []

    try {
      const entries = readdirSync(baseDir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const fullPath = join(baseDir, entry.name)
          if (this.isLevelDBDir(fullPath)) {
            dirs.push(fullPath)
          }
          dirs.push(...this.findLevelDBDirs(fullPath))
        }
      }
    } catch {
      return dirs
    }

    return dirs
  }

  private isLevelDBDir(dir: string): boolean {
    try {
      const files = readdirSync(dir)
      return files.some((f) => f.endsWith('.ldb') || f.endsWith('.log') || f === 'CURRENT')
    } catch {
      return false
    }
  }

  private async extractFromLevelDB(dbPath: string): Promise<TokenInfo[]> {
    const tokens: TokenInfo[] = []

    // First try reading LDB files directly (more reliable for sandboxed apps)
    const directTokens = this.extractTokensFromLDBFiles(dbPath)
    if (directTokens.length > 0) {
      return directTokens
    }

    // Fallback to ClassicLevel for standard installations
    let db: ClassicLevel<string, string> | null = null
    try {
      db = new ClassicLevel(dbPath, { valueEncoding: 'utf8' })

      for await (const [key, value] of db.iterator()) {
        if (typeof value === 'string' && value.includes('xoxc-')) {
          const extracted = this.parseTokenData(key, value)
          if (extracted) {
            tokens.push(extracted)
          }
        }
      }
    } catch {
    } finally {
      if (db) {
        try {
          await db.close()
        } catch {}
      }
    }

    return tokens
  }

  private extractTokensFromLDBFiles(dbPath: string): TokenInfo[] {
    const tokens: TokenInfo[] = []
    try {
      // Prioritize .log files (not compacted, have clean data)
      // Then fall back to .ldb files
      const logFiles = readdirSync(dbPath).filter((f) => f.endsWith('.log'))
      const ldbFiles = readdirSync(dbPath).filter((f) => f.endsWith('.ldb'))
      const files = [...logFiles, ...ldbFiles]

      for (const file of files) {
        const filePath = join(dbPath, file)
        const content = readFileSync(filePath)
        const isLogFile = file.endsWith('.log')

        const xoxcMarker = Buffer.from('xoxc-')
        let idx = content.indexOf(xoxcMarker, 0)
        while (idx !== -1) {
          const tokenData = isLogFile
            ? this.extractTokenFromLogFile(content, idx)
            : this.extractTokenFromBuffer(content, idx)
          if (tokenData) {
            tokens.push(tokenData)
          }
          idx = content.indexOf(xoxcMarker, idx + 5)
        }
      }
    } catch {}
    return tokens
  }

  private extractTokenFromLogFile(buffer: Buffer, startIdx: number): TokenInfo | null {
    // LOG files have clean (non-fragmented) JSON data
    const chunk = buffer.subarray(startIdx, startIdx + 300)
    const str = chunk.toString('utf8')

    // Token ends at quote
    const endQuote = str.indexOf('"')
    if (endQuote === -1) return null

    const token = str.substring(0, endQuote)

    // Validate token format
    if (!/^xoxc-\d+-\d+-\d+-[0-9a-f]{64}$/i.test(token)) {
      return null
    }

    let teamId = 'unknown'
    let teamName = 'unknown'

    const surroundingChunk = buffer.subarray(Math.max(0, startIdx - 500), startIdx + 500)
    const surroundingStr = surroundingChunk.toString('utf8')

    const teamIdMatch = surroundingStr.match(/T[A-Z0-9]{8,11}/)
    if (teamIdMatch) {
      teamId = teamIdMatch[0]
    }

    const teamNameMatch = surroundingStr.match(/"name"\s*:\s*"([^"]+)"/)
    if (teamNameMatch) {
      teamName = teamNameMatch[1]
    }

    return { token, teamId, teamName }
  }

  private extractTokenFromBuffer(buffer: Buffer, startIdx: number): TokenInfo | null {
    const chunk = buffer.subarray(startIdx, startIdx + 200)

    // LevelDB fragmentation pattern observed:
    // Token bytes: xoxc-455709840052 [19 0d f0 5e] 228-6209589301201-9f47...
    // The 4 garbage bytes (0x19 0x0d 0xf0 0xNN) replace a hyphen between numeric segments
    //
    // Strategy: scan for valid token chars, when we hit a non-valid sequence,
    // check if it's a 4-byte fragmentation marker and insert a hyphen

    const result: number[] = []
    const validChars = new Set('0123456789abcdefABCDEF-xoc'.split('').map((c) => c.charCodeAt(0)))
    const terminators = new Set([0x22, 0x00, 0x7d, 0x2c]) // " null } ,

    let i = 0
    while (i < chunk.length) {
      const byte = chunk[i]

      if (terminators.has(byte)) {
        break
      }

      if (validChars.has(byte)) {
        result.push(byte)
        i++
      } else {
        // Check for 4-byte fragmentation marker pattern
        // Pattern: 0x19 0x0d 0xf0 0xNN (where NN varies)
        if (
          i + 3 < chunk.length &&
          chunk[i] === 0x19 &&
          chunk[i + 1] === 0x0d &&
          chunk[i + 2] === 0xf0
        ) {
          // Skip the 4 garbage bytes and insert a hyphen
          result.push(0x2d) // hyphen
          i += 4
        } else {
          // Unknown garbage - insert hyphen and skip this byte
          if (result.length > 0 && result[result.length - 1] !== 0x2d) {
            result.push(0x2d) // hyphen
          }
          i++
        }
      }
    }

    const reconstructed = Buffer.from(result).toString('utf8')

    // Clean up any double hyphens
    const cleaned = reconstructed.replace(/--+/g, '-').replace(/-$/, '')

    // xoxc tokens: xoxc-NUM-NUM-NUM-64HEX (4 parts after xoxc)
    const tokenPatterns = [/xoxc-\d+-\d+-\d+-[0-9a-f]{64}/i, /xoxc-\d+-\d+-[0-9a-f]{64}/i]

    let token: string | null = null
    for (const pattern of tokenPatterns) {
      const match = cleaned.match(pattern)
      if (match) {
        token = match[0]
        break
      }
    }

    if (!token) {
      return null
    }

    const parts = token.split('-')
    if (parts.length < 4) {
      return null
    }

    const lastPart = parts[parts.length - 1]
    if (!/^[0-9a-f]{64}$/i.test(lastPart)) {
      return null
    }

    let teamId = 'unknown'
    let teamName = 'unknown'

    const surroundingChunk = buffer.subarray(Math.max(0, startIdx - 500), startIdx + 500)
    const surroundingStr = surroundingChunk.toString('utf8')

    const teamIdMatch = surroundingStr.match(/T[A-Z0-9]{8,11}/)
    if (teamIdMatch) {
      teamId = teamIdMatch[0]
    }

    const teamNameMatch = surroundingStr.match(/"team_name"\s*:\s*"([^"]+)"/)
    if (teamNameMatch) {
      teamName = teamNameMatch[1]
    }

    return { token, teamId, teamName }
  }

  private parseTokenData(_key: string, value: string): TokenInfo | null {
    const tokenMatch = value.match(/xoxc-[a-zA-Z0-9-]+/)
    if (!tokenMatch) {
      return null
    }

    const token = tokenMatch[0]

    let teamId = 'unknown'
    let teamName = 'unknown'

    const teamIdMatch = value.match(/"team_id"\s*:\s*"(T[A-Z0-9]+)"/)
    if (teamIdMatch) {
      teamId = teamIdMatch[1]
    }

    const teamNameMatch = value.match(/"team_name"\s*:\s*"([^"]+)"/)
    if (teamNameMatch) {
      teamName = teamNameMatch[1]
    } else {
      const domainMatch = value.match(/"domain"\s*:\s*"([^"]+)"/)
      if (domainMatch) {
        teamName = domainMatch[1]
      }
    }

    return { token, teamId, teamName }
  }

  private async extractCookieFromSQLite(): Promise<string> {
    const cookiesPath = join(this.slackDir, 'Cookies')
    if (!existsSync(cookiesPath)) {
      const networkCookiesPath = join(this.slackDir, 'Network', 'Cookies')
      if (!existsSync(networkCookiesPath)) {
        return ''
      }
      return this.readCookieFromDB(networkCookiesPath)
    }
    return this.readCookieFromDB(cookiesPath)
  }

  private readCookieFromDB(dbPath: string): string {
    // Copy the database to a temp file to avoid SQLite lock contention
    // when Slack is running and has a write lock on the Cookies database
    const tempDbPath = join(
      tmpdir(),
      `slack-cookies-${Date.now()}-${Math.random().toString(36).slice(2)}.db`
    )

    try {
      copyFileSync(dbPath, tempDbPath)
    } catch {
      return ''
    }

    try {
      const sql = `SELECT value, encrypted_value 
           FROM cookies 
           WHERE name = 'd' AND host_key LIKE '%slack.com%'
           ORDER BY last_access_utc DESC
           LIMIT 1`

      type CookieRow = { value?: string; encrypted_value?: Uint8Array | Buffer } | null

      let row: CookieRow
      if (typeof globalThis.Bun !== 'undefined') {
        const { Database } = require('bun:sqlite')
        const db = new Database(tempDbPath, { readonly: true })
        row = db.query(sql).get() as CookieRow
        db.close()
      } else {
        const Database = require('better-sqlite3')
        const db = new Database(tempDbPath, { readonly: true })
        row = db.prepare(sql).get() as CookieRow
        db.close()
      }

      if (!row) {
        return ''
      }

      if (row.value?.startsWith('xoxd-')) {
        return row.value
      }

      if (row.encrypted_value && row.encrypted_value.length > 0) {
        const decrypted = this.tryDecryptCookie(Buffer.from(row.encrypted_value))
        if (decrypted) {
          return decrypted
        }
      }

      return ''
    } catch {
      return ''
    } finally {
      try {
        rmSync(tempDbPath, { force: true })
      } catch {}
    }
  }

  private tryDecryptCookie(encrypted: Buffer): string | null {
    const str = encrypted.toString('utf8')
    if (str.startsWith('xoxd-')) {
      return str
    }

    // Check for v10 encryption (macOS Keychain)
    if (encrypted.length > 3 && encrypted.subarray(0, 3).toString() === 'v10') {
      return this.decryptV10Cookie(encrypted)
    }

    return null
  }

  private decryptV10Cookie(encrypted: Buffer): string | null {
    try {
      const key = this.getDerivedKey()
      if (!key) {
        return null
      }

      // v10 uses AES-128-CBC with 16-space IV (Chrome/Electron pattern)
      const iv = Buffer.alloc(16, ' ')
      const ciphertext = encrypted.subarray(3)

      const decipher = createDecipheriv('aes-128-cbc', key, iv)
      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
      const result = decrypted.toString('utf8')

      // Extract xoxd- token from decrypted data (may have padding/garbage before it)
      const match = result.match(/xoxd-[A-Za-z0-9%]+/)
      return match ? match[0] : null
    } catch {
      return null
    }
  }

  private getDerivedKey(): Buffer | null {
    if (this.platform !== 'darwin') {
      return null
    }

    try {
      let password: string
      try {
        password = execSync(
          'security find-generic-password -ga "Slack App Store Key" -s "Slack Safe Storage" -w 2>/dev/null',
          { encoding: 'utf8' }
        ).trim()
      } catch {
        password = execSync(
          'security find-generic-password -ga "Slack Key" -s "Slack Safe Storage" -w 2>/dev/null',
          { encoding: 'utf8' }
        ).trim()
      }

      // Chrome/Electron uses PBKDF2 with these parameters
      return pbkdf2Sync(password, 'saltysalt', 1003, 16, 'sha1')
    } catch {
      return null
    }
  }
}
