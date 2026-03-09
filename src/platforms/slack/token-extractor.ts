import { execSync } from 'node:child_process'
import { createDecipheriv, pbkdf2Sync } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

import { ClassicLevel } from 'classic-level'

import { DerivedKeyCache } from '@/shared/utils/derived-key-cache'

const require = createRequire(import.meta.url)

export interface ExtractedWorkspace {
  workspace_id: string
  workspace_name: string
  token: string
  cookie: string
}

type TokenSource = 'json-teams' | 'json-single' | 'log-file' | 'ldb-file' | 'classic-level' | 'blob-file'
type TokenDirTier = 'storage' | 'local-storage' | 'indexeddb'

interface RawTokenInfo {
  token: string
  teamId: string
  teamName: string
  source: TokenSource
}

interface TokenInfo extends RawTokenInfo {
  dirTier: TokenDirTier
}

// Higher = better. Structured JSON from the teams object is the most reliable source.
const SOURCE_PRIORITY: Record<TokenSource, number> = {
  'json-teams': 5,
  'json-single': 4,
  'log-file': 3,
  'classic-level': 2,
  'blob-file': 1,
  'ldb-file': 1,
}

const DIR_TIER_PRIORITY: Record<TokenDirTier, number> = {
  storage: 3,
  'local-storage': 2,
  indexeddb: 1,
}

export class TokenExtractor {
  private platform: NodeJS.Platform
  private slackDir: string
  private keyCache: DerivedKeyCache
  private debugLog: ((message: string) => void) | null

  constructor(
    platform?: NodeJS.Platform,
    slackDir?: string,
    keyCache?: DerivedKeyCache,
    debugLog?: (message: string) => void,
  ) {
    this.platform = platform ?? process.platform

    if (!['darwin', 'linux', 'win32'].includes(this.platform)) {
      throw new Error(`Unsupported platform: ${this.platform}`)
    }

    this.slackDir = slackDir ?? this.getSlackDir()
    this.keyCache = keyCache ?? new DerivedKeyCache()
    this.debugLog = debugLog ?? null
  }

  private debug(message: string): void {
    this.debugLog?.(message)
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
          'Slack',
        )
        if (existsSync(sandboxedPath)) {
          return sandboxedPath
        }
        // Default to direct path for error message
        return directPath
      }
      case 'linux':
        return join(homedir(), '.config', 'Slack')
      case 'win32': {
        // Check MSIX (Microsoft Store / GPO) package path first
        const msixPath = this.findMsixSlackDir()
        if (msixPath) {
          return msixPath
        }
        // Direct download version
        return join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'Slack')
      }
      default:
        throw new Error(`Unsupported platform: ${this.platform}`)
    }
  }

  private findMsixSlackDir(): string | null {
    const packagesDir = join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'Packages')
    if (!existsSync(packagesDir)) {
      this.debug('MSIX Packages directory not found')
      return null
    }

    try {
      const entries = readdirSync(packagesDir, { withFileTypes: true })
      let best: { path: string; mtimeMs: number } | null = null

      for (const entry of entries) {
        if (!entry.isDirectory() || !entry.name.toLowerCase().includes('slack')) {
          continue
        }
        const slackData = join(packagesDir, entry.name, 'LocalCache', 'Roaming', 'Slack')
        this.debug(`Found MSIX candidate: ${entry.name}`)
        if (!existsSync(join(slackData, 'storage')) && !existsSync(join(slackData, 'Local Storage'))) {
          this.debug(`  No Slack data at ${slackData}`)
          continue
        }
        const mtime = statSync(slackData).mtimeMs
        this.debug(`  Valid Slack data found (mtime: ${new Date(mtime).toISOString()})`)
        if (!best || mtime > best.mtimeMs) {
          best = { path: slackData, mtimeMs: mtime }
        }
      }

      if (best) {
        this.debug(`Using MSIX Slack dir: ${best.path}`)
      } else {
        this.debug('No valid MSIX Slack data found, falling back to APPDATA')
      }
      return best?.path ?? null
    } catch {
      return null
    }
  }

  async extractCookie(): Promise<string> {
    if (!existsSync(this.slackDir)) {
      return ''
    }

    await this.getDerivedKeyAsync()

    const cookie = await this.extractCookieFromSQLite()
    if (!cookie && this.usedCachedKey) {
      await this.clearKeyCache()
      this.cachedKey = this.getDerivedKeyFromKeychain()
      if (this.cachedKey) {
        await this.keyCache.set('slack', this.cachedKey)
        return await this.extractCookieFromSQLite()
      }
    }

    return cookie
  }

  async extract(): Promise<ExtractedWorkspace[]> {
    if (!existsSync(this.slackDir)) {
      throw new Error(`Slack directory not found: ${this.slackDir}`)
    }

    await this.getDerivedKeyAsync()

    const tokens = await this.extractTokensFromLevelDB()
    if (tokens.length === 0) {
      return []
    }

    const cookie = await this.extractCookieFromSQLite()

    if (!cookie && this.usedCachedKey) {
      await this.clearKeyCache()
      this.cachedKey = this.getDerivedKeyFromKeychain()
      if (this.cachedKey) {
        await this.keyCache.set('slack', this.cachedKey)
        const retryCookie = await this.extractCookieFromSQLite()
        return tokens.map((t) => ({
          workspace_id: t.teamId,
          workspace_name: t.teamName,
          token: t.token,
          cookie: retryCookie,
        }))
      }
    }

    return tokens.map((t) => ({
      workspace_id: t.teamId,
      workspace_name: t.teamName,
      token: t.token,
      cookie: cookie,
    }))
  }

  private async extractTokensFromLevelDB(): Promise<TokenInfo[]> {
    const tieredDirs: { dir: string; tier: TokenDirTier }[] = [
      { dir: join(this.slackDir, 'storage'), tier: 'storage' },
      {
        dir: join(this.slackDir, 'Local Storage', 'leveldb'),
        tier: 'local-storage',
      },
      { dir: join(this.slackDir, 'IndexedDB'), tier: 'indexeddb' },
    ]

    const tokens: TokenInfo[] = []

    for (const { dir: baseDir, tier } of tieredDirs) {
      if (!existsSync(baseDir)) {
        continue
      }

      const levelDbDirs = this.findLevelDBDirs(baseDir)
      if (this.isLevelDBDir(baseDir)) {
        levelDbDirs.push(baseDir)
      }

      for (const dbDir of levelDbDirs) {
        try {
          const extracted = await this.extractFromLevelDB(dbDir, tier)
          tokens.push(...extracted)
        } catch {}
      }

      // Chromium offloads large IndexedDB values to external *.indexeddb.blob/ files
      const blobTokens = this.extractTokensFromBlobFiles(baseDir, tier)
      tokens.push(...blobTokens)
    }

    return this.deduplicateTokens(tokens)
  }

  private deduplicateTokens(tokens: TokenInfo[]): TokenInfo[] {
    // Phase 1: Merge entries with identical token values.
    // The same xoxc token found in LDB and blob files may carry different
    // teamId/teamName because extractTokenFromBuffer regex-matches on raw
    // binary bytes, which can produce false-positive team IDs in blob files.
    const byTokenValue = new Map<string, TokenInfo>()
    for (const t of tokens) {
      const existing = byTokenValue.get(t.token)
      if (!existing) {
        byTokenValue.set(t.token, t)
        continue
      }
      const existingScore = SOURCE_PRIORITY[existing.source] * 10 + DIR_TIER_PRIORITY[existing.dirTier]
      const candidateScore = SOURCE_PRIORITY[t.source] * 10 + DIR_TIER_PRIORITY[t.dirTier]
      const winner = candidateScore > existingScore ? t : existing
      const loser = candidateScore > existingScore ? existing : t
      byTokenValue.set(t.token, {
        ...winner,
        teamId: winner.teamId !== 'unknown' ? winner.teamId : loser.teamId,
        teamName: winner.teamName !== 'unknown' ? winner.teamName : loser.teamName,
      })
    }

    // Phase 2: Deduplicate by teamId — different tokens for the same team
    // keep the one from the highest-priority source.
    const seen = new Map<string, TokenInfo>()
    for (const token of byTokenValue.values()) {
      const existing = seen.get(token.teamId)
      if (!existing) {
        seen.set(token.teamId, token)
        continue
      }

      const existingScore = SOURCE_PRIORITY[existing.source] * 10 + DIR_TIER_PRIORITY[existing.dirTier]
      const candidateScore = SOURCE_PRIORITY[token.source] * 10 + DIR_TIER_PRIORITY[token.dirTier]

      if (candidateScore > existingScore) {
        const teamName = token.teamName !== 'unknown' ? token.teamName : existing.teamName
        seen.set(token.teamId, { ...token, teamName })
      } else if (existing.teamName === 'unknown' && token.teamName !== 'unknown') {
        seen.set(token.teamId, { ...existing, teamName: token.teamName })
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

  private async extractFromLevelDB(dbPath: string, dirTier: TokenDirTier): Promise<TokenInfo[]> {
    const classicLevelTokens = await this.extractViaClassicLevelCopy(dbPath, dirTier)
    if (classicLevelTokens.length > 0) {
      return classicLevelTokens
    }

    const directTokens = this.extractTokensFromLDBFiles(dbPath, dirTier)
    if (directTokens.length > 0) {
      return directTokens
    }

    return this.extractViaClassicLevel(dbPath, dirTier)
  }

  private async extractViaClassicLevelCopy(dbPath: string, dirTier: TokenDirTier): Promise<TokenInfo[]> {
    const tempDir = join(tmpdir(), `slack-leveldb-${Date.now()}-${Math.random().toString(36).slice(2)}`)

    try {
      mkdirSync(tempDir, { recursive: true })

      const files = readdirSync(dbPath)
      for (const file of files) {
        if (file === 'LOCK') continue // ClassicLevel creates its own
        const src = join(dbPath, file)
        try {
          if (statSync(src).isFile()) {
            copyFileSync(src, join(tempDir, file))
          }
        } catch {}
      }

      return await this.extractViaClassicLevel(tempDir, dirTier)
    } catch {
      return []
    } finally {
      try {
        rmSync(tempDir, { recursive: true, force: true })
      } catch {}
    }
  }

  private async extractViaClassicLevel(dbPath: string, dirTier: TokenDirTier): Promise<TokenInfo[]> {
    const tokens: TokenInfo[] = []
    let db: ClassicLevel<string, string> | null = null
    try {
      db = new ClassicLevel(dbPath, { valueEncoding: 'utf8' })

      for await (const [key, value] of db.iterator()) {
        if (typeof value === 'string' && value.includes('xoxc-')) {
          const parsed = this.parseTokenValue(key, value)
          for (const t of parsed) {
            tokens.push({ ...t, dirTier })
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

  private extractTokensFromBlobFiles(baseDir: string, dirTier: TokenDirTier): TokenInfo[] {
    const tokens: TokenInfo[] = []
    try {
      const entries = readdirSync(baseDir, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isDirectory() || !entry.name.endsWith('.indexeddb.blob')) continue

        const blobDir = join(baseDir, entry.name)
        this.debug(`Scanning blob directory: ${blobDir}`)
        const files = this.findFilesRecursive(blobDir)

        for (const filePath of files) {
          try {
            const stat = statSync(filePath)
            if (stat.size > 10 * 1024 * 1024) continue

            const content = readFileSync(filePath)
            const xoxcMarker = Buffer.from('xoxc-')
            let idx = content.indexOf(xoxcMarker, 0)
            while (idx !== -1) {
              const tokenData = this.extractTokenFromBuffer(content, idx)
              if (tokenData) {
                this.debug(`Found token in blob file: ${filePath}`)
                tokens.push({ ...tokenData, source: 'blob-file', dirTier })
              }
              idx = content.indexOf(xoxcMarker, idx + 5)
            }
          } catch {}
        }
      }
    } catch {}
    return tokens
  }

  private findFilesRecursive(dir: string): string[] {
    const files: string[] = []
    try {
      const entries = readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = join(dir, entry.name)
        if (entry.isDirectory()) {
          files.push(...this.findFilesRecursive(fullPath))
        } else if (entry.isFile()) {
          files.push(fullPath)
        }
      }
    } catch {}
    return files
  }

  private extractTokensFromLDBFiles(dbPath: string, dirTier: TokenDirTier): TokenInfo[] {
    const tokens: TokenInfo[] = []
    try {
      // Prioritize .log files (not compacted, have clean data)
      // Then fall back to .ldb files
      const logFiles = readdirSync(dbPath).filter((f) => f.endsWith('.log'))
      const ldbFiles = readdirSync(dbPath)
        .filter((f) => f.endsWith('.ldb'))
        .sort((a, b) => {
          const statA = statSync(join(dbPath, a))
          const statB = statSync(join(dbPath, b))
          return statB.mtimeMs - statA.mtimeMs
        })
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
            tokens.push({ ...tokenData, dirTier })
          }
          idx = content.indexOf(xoxcMarker, idx + 5)
        }
      }
    } catch {}
    return tokens
  }

  private extractTokenFromLogFile(buffer: Buffer, startIdx: number): RawTokenInfo | null {
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

    return { token, teamId, teamName, source: 'log-file' }
  }

  private extractTokenFromBuffer(buffer: Buffer, startIdx: number): RawTokenInfo | null {
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
        // LevelDB compaction inserts 4-byte markers where hyphens should be.
        // Known patterns: [19 0d f0 NN], [15 0b f0 NN] — the 3rd byte (0xf0) is consistent.
        // Match any 4-byte sequence where byte at offset +2 is 0xf0.
        if (i + 3 < chunk.length && chunk[i + 2] === 0xf0) {
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

    return { token, teamId, teamName, source: 'ldb-file' }
  }

  private parseTokenValue(_key: string, value: string): RawTokenInfo[] {
    // LevelDB values may have leading control characters (e.g. 0x01).
    // Built dynamically to avoid control characters in regex literal.
    const controlChars = new RegExp(
      `[${String.fromCharCode(0)}-${String.fromCharCode(8)}${String.fromCharCode(11)}${String.fromCharCode(12)}${String.fromCharCode(14)}-${String.fromCharCode(31)}]`,
      'g',
    )
    const cleaned = value.replace(controlChars, '')
    try {
      const parsed = JSON.parse(cleaned)
      if (parsed?.teams && typeof parsed.teams === 'object') {
        return this.parseTeamsObject(parsed.teams)
      }
    } catch {}

    const single = this.parseSingleToken(cleaned)
    return single ? [single] : []
  }

  private parseTeamsObject(teams: Record<string, any>): RawTokenInfo[] {
    const tokens: RawTokenInfo[] = []
    for (const [teamId, team] of Object.entries(teams)) {
      if (!team?.token || typeof team.token !== 'string' || !team.token.startsWith('xoxc-')) continue
      tokens.push({
        token: team.token,
        teamId: team.id || teamId,
        teamName: team.name || 'unknown',
        source: 'json-teams',
      })
    }
    return tokens
  }

  private parseSingleToken(value: string): RawTokenInfo | null {
    const tokenMatch = value.match(/xoxc-[a-zA-Z0-9-]+/)
    if (!tokenMatch) return null

    let teamId = 'unknown'
    let teamName = 'unknown'

    const teamIdMatch = value.match(/"team_id"\s*:\s*"(T[A-Z0-9]+)"/)
    if (teamIdMatch) teamId = teamIdMatch[1]

    const teamNameMatch = value.match(/"team_name"\s*:\s*"([^"]+)"/)
    if (teamNameMatch) {
      teamName = teamNameMatch[1]
    } else {
      const domainMatch = value.match(/"domain"\s*:\s*"([^"]+)"/)
      if (domainMatch) teamName = domainMatch[1]
    }

    return { token: tokenMatch[0], teamId, teamName, source: 'json-single' }
  }

  private async extractCookieFromSQLite(): Promise<string> {
    const cookiesPath = join(this.slackDir, 'Cookies')
    if (!existsSync(cookiesPath)) {
      const networkCookiesPath = join(this.slackDir, 'Network', 'Cookies')
      if (!existsSync(networkCookiesPath)) {
        this.debug(`Cookie file not found at ${cookiesPath} or ${networkCookiesPath}`)
        return ''
      }
      this.debug(`Using Network cookies path: ${networkCookiesPath}`)
      return this.readCookieFromDB(networkCookiesPath)
    }
    this.debug(`Using cookies path: ${cookiesPath}`)
    return this.readCookieFromDB(cookiesPath)
  }

  private readCookieFromDB(dbPath: string): string {
    // Copy the database to a temp file to avoid SQLite lock contention
    // when Slack is running and has a write lock on the Cookies database
    const tempDbPath = join(tmpdir(), `slack-cookies-${Date.now()}-${Math.random().toString(36).slice(2)}.db`)

    try {
      copyFileSync(dbPath, tempDbPath)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EBUSY') {
        throw new Error(
          'Failed to read Slack cookies. The Slack app is currently running and locking the cookie database. ' +
            'Quit the Slack app completely and try again.',
        )
      }
      this.debug(`Failed to copy cookie DB: ${(error as Error).message}`)
      return ''
    }

    try {
      const sql = `SELECT value, encrypted_value 
           FROM cookies 
           WHERE name = 'd' AND host_key LIKE '%slack.com%'
           ORDER BY last_access_utc DESC
           LIMIT 1`

      type CookieRow = {
        value?: string
        encrypted_value?: Uint8Array | Buffer
      } | null

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
        this.debug('No cookie row found in database')
        return ''
      }

      if (row.value?.startsWith('xoxd-')) {
        this.debug('Found plaintext cookie')
        return row.value
      }

      if (row.encrypted_value && row.encrypted_value.length > 0) {
        this.debug(`Found encrypted cookie (${row.encrypted_value.length} bytes)`)
        const decrypted = this.tryDecryptCookie(Buffer.from(row.encrypted_value))
        if (decrypted) {
          this.debug('Cookie decrypted successfully')
          return decrypted
        }
        this.debug('Cookie decryption failed')
      }

      this.debug('No usable cookie value in row')
      return ''
    } catch (error) {
      this.debug(`Cookie DB query failed: ${(error as Error).message}`)
      return ''
    } finally {
      try {
        rmSync(tempDbPath, { force: true })
      } catch {}
    }
  }

  tryDecryptCookie(encrypted: Buffer): string | null {
    const str = encrypted.toString('utf8')
    if (str.startsWith('xoxd-')) {
      return str
    }

    if (encrypted.length > 3 && encrypted.subarray(0, 3).toString() === 'v10') {
      if (this.platform === 'win32') {
        return this.decryptV10CookieWindows(encrypted)
      }
      if (this.platform === 'linux') {
        return this.decryptV10CookieLinux(encrypted)
      }
      return this.decryptV10Cookie(encrypted)
    }

    // Windows pre-v80: DPAPI applied directly (no version prefix)
    if (this.platform === 'win32' && encrypted.length > 0) {
      const decrypted = this.decryptDPAPI(encrypted)
      if (decrypted) {
        const text = decrypted.toString('utf8')
        const match = text.match(/xoxd-[A-Za-z0-9%]+/)
        return match ? match[0] : null
      }
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

  private decryptV10CookieLinux(encrypted: Buffer): string | null {
    try {
      const key = pbkdf2Sync('peanuts', 'saltysalt', 1, 16, 'sha1')
      const iv = Buffer.alloc(16, ' ')
      const ciphertext = encrypted.subarray(3)

      const decipher = createDecipheriv('aes-128-cbc', key, iv)
      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
      const result = decrypted.toString('utf8')

      const match = result.match(/xoxd-[A-Za-z0-9%]+/)
      return match ? match[0] : null
    } catch {
      return null
    }
  }

  decryptV10CookieWindows(encrypted: Buffer): string | null {
    try {
      const masterKey = this.getWindowsMasterKey()
      if (!masterKey) {
        const decrypted = this.decryptDPAPI(encrypted.subarray(3))
        if (!decrypted) return null
        const text = decrypted.toString('utf8')
        const match = text.match(/xoxd-[A-Za-z0-9%]+/)
        return match ? match[0] : null
      }

      const nonce = encrypted.subarray(3, 3 + 12)
      const ciphertextWithTag = encrypted.subarray(3 + 12)
      const tag = ciphertextWithTag.subarray(ciphertextWithTag.length - 16)
      const ciphertext = ciphertextWithTag.subarray(0, ciphertextWithTag.length - 16)

      const decipher = createDecipheriv('aes-256-gcm', masterKey, nonce)
      decipher.setAuthTag(tag)
      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')

      const match = decrypted.match(/xoxd-[A-Za-z0-9%]+/)
      return match ? match[0] : null
    } catch {
      return null
    }
  }

  getWindowsMasterKey(): Buffer | null {
    try {
      const localStatePath = join(this.slackDir, 'Local State')
      if (!existsSync(localStatePath)) {
        return null
      }

      const localState = JSON.parse(readFileSync(localStatePath, 'utf8')) as {
        os_crypt?: { encrypted_key?: string }
      }
      const encryptedKeyB64 = localState?.os_crypt?.encrypted_key
      if (!encryptedKeyB64) {
        return null
      }

      const encryptedKey = Buffer.from(encryptedKeyB64, 'base64')
      if (encryptedKey.subarray(0, 5).toString() !== 'DPAPI') {
        return null
      }

      return this.decryptDPAPI(encryptedKey.subarray(5))
    } catch {
      return null
    }
  }

  decryptDPAPI(encrypted: Buffer): Buffer | null {
    if (this.platform !== 'win32') {
      return null
    }

    try {
      const b64Input = encrypted.toString('base64')
      const script = [
        'Add-Type -AssemblyName System.Security',
        `$d=[System.Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String("${b64Input}"),$null,[System.Security.Cryptography.DataProtectionScope]::CurrentUser)`,
        '[Convert]::ToBase64String($d)',
      ].join(';')

      const encodedCommand = Buffer.from(script, 'utf16le').toString('base64')
      const result = execSync(`powershell -NoProfile -NonInteractive -EncodedCommand ${encodedCommand}`, {
        encoding: 'utf8',
        timeout: 10000,
      }).trim()

      return Buffer.from(result, 'base64')
    } catch {
      return null
    }
  }

  private cachedKey: Buffer | null = null
  private usedCachedKey = false

  private async getDerivedKeyAsync(): Promise<Buffer | null> {
    if (this.platform !== 'darwin') {
      this.debug(`Skipping Keychain key derivation (platform: ${this.platform})`)
      return null
    }

    const cached = await this.keyCache.get('slack')
    if (cached) {
      this.cachedKey = cached
      this.usedCachedKey = true
      this.debug('Using cached derived key')
      return cached
    }

    const key = this.getDerivedKeyFromKeychain()
    if (key) {
      this.cachedKey = key
      await this.keyCache.set('slack', key)
      this.usedCachedKey = false
      this.debug('Derived key from Keychain')
    } else {
      this.debug('Failed to derive key from Keychain')
    }
    return key
  }

  private getDerivedKey(): Buffer | null {
    if (this.cachedKey) {
      return this.cachedKey
    }
    return this.getDerivedKeyFromKeychain()
  }

  private getDerivedKeyFromKeychain(): Buffer | null {
    if (this.platform !== 'darwin') {
      return null
    }

    try {
      let password: string
      try {
        password = execSync(
          'security find-generic-password -ga "Slack App Store Key" -s "Slack Safe Storage" -w 2>/dev/null',
          { encoding: 'utf8' },
        ).trim()
      } catch {
        password = execSync('security find-generic-password -ga "Slack Key" -s "Slack Safe Storage" -w 2>/dev/null', {
          encoding: 'utf8',
        }).trim()
      }

      return pbkdf2Sync(password, 'saltysalt', 1003, 16, 'sha1')
    } catch {
      return null
    }
  }

  async clearKeyCache(): Promise<void> {
    await this.keyCache.clear('slack')
    this.cachedKey = null
  }

  getWorkspaceDomains(): Record<string, string> {
    const rootStatePath = join(this.slackDir, 'storage', 'root-state.json')
    if (!existsSync(rootStatePath)) {
      this.debug(`root-state.json not found at ${rootStatePath}`)
      return {}
    }

    try {
      const content = readFileSync(rootStatePath, 'utf8')
      const data = JSON.parse(content) as {
        workspaces?: Record<string, { domain?: string }>
      }
      const domains: Record<string, string> = {}
      for (const [teamId, ws] of Object.entries(data.workspaces ?? {})) {
        if (ws.domain) {
          domains[teamId] = ws.domain
        }
      }
      this.debug(`Found ${Object.keys(domains).length} workspace domain(s) in root-state.json`)
      return domains
    } catch {
      this.debug('Failed to parse root-state.json')
      return {}
    }
  }
}
