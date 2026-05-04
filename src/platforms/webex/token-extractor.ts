import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

import { ClassicLevel } from 'classic-level'

import { getAgentBrowserProfileDirs } from '@/shared/chromium'

export interface ExtractedWebexToken {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  deviceUrl?: string
  userId?: string
  encryptionKeys?: Map<string, string>
}

interface BrowserConfig {
  name: string
  darwin: string
  linux: string
  win32: string
}

const BROWSERS: BrowserConfig[] = [
  {
    name: 'Chrome',
    darwin: join('Google', 'Chrome'),
    linux: 'google-chrome',
    win32: join('Google', 'Chrome', 'User Data'),
  },
  {
    name: 'Chrome Canary',
    darwin: join('Google', 'Chrome Canary'),
    linux: 'google-chrome-unstable',
    win32: join('Google', 'Chrome SxS', 'User Data'),
  },
  {
    name: 'Edge',
    darwin: join('Microsoft Edge'),
    linux: 'microsoft-edge',
    win32: join('Microsoft', 'Edge', 'User Data'),
  },
  {
    name: 'Arc',
    darwin: join('Arc', 'User Data'),
    linux: '',
    win32: join('Arc', 'User Data'),
  },
  {
    name: 'Brave',
    darwin: join('BraveSoftware', 'Brave-Browser'),
    linux: join('BraveSoftware', 'Brave-Browser'),
    win32: join('BraveSoftware', 'Brave-Browser', 'User Data'),
  },
  {
    name: 'Vivaldi',
    darwin: 'Vivaldi',
    linux: 'vivaldi',
    win32: join('Vivaldi', 'User Data'),
  },
  {
    name: 'Chromium',
    darwin: 'Chromium',
    linux: 'chromium',
    win32: join('Chromium', 'User Data'),
  },
]

interface ScanResult {
  token: ExtractedWebexToken | null
  encryptionKeys: Map<string, string>
}

export class WebexTokenExtractor {
  private platform: NodeJS.Platform
  private baseDir: string | null
  private debugLog: ((message: string) => void) | null

  constructor(platform?: NodeJS.Platform, debugLog?: (message: string) => void, baseDir?: string) {
    this.platform = platform ?? process.platform
    this.debugLog = debugLog ?? null
    this.baseDir = baseDir ?? null
  }

  private debug(message: string): void {
    this.debugLog?.(message)
  }

  getBrowserProfileDirs(): string[] {
    if (this.baseDir) {
      return this.discoverProfileDirs(this.baseDir)
    }

    const dirs: string[] = []

    for (const browser of BROWSERS) {
      const browserBase = this.getBrowserBasePath(browser)
      if (!browserBase) continue

      const profileDirs = this.discoverProfileDirs(browserBase)
      dirs.push(...profileDirs)
    }

    for (const profileDir of getAgentBrowserProfileDirs()) {
      const leveldb = join(profileDir, 'Local Storage', 'leveldb')
      if (existsSync(leveldb)) {
        dirs.push(leveldb)
      }
    }

    return dirs
  }

  private getBrowserBasePath(browser: BrowserConfig): string | null {
    let relative: string

    switch (this.platform) {
      case 'darwin':
        relative = browser.darwin
        if (!relative) return null
        return join(homedir(), 'Library', 'Application Support', relative)
      case 'linux':
        relative = browser.linux
        if (!relative) return null
        return join(homedir(), '.config', relative)
      case 'win32':
        relative = browser.win32
        if (!relative) return null
        return join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), relative)
      default:
        return null
    }
  }

  private discoverProfileDirs(browserBase: string): string[] {
    const dirs: string[] = []

    if (!existsSync(browserBase)) return dirs

    const defaultLeveldb = join(browserBase, 'Default', 'Local Storage', 'leveldb')
    if (existsSync(defaultLeveldb)) {
      dirs.push(defaultLeveldb)
    }

    try {
      const entries = readdirSync(browserBase, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        if (!/^Profile \d+$/i.test(entry.name)) continue

        const leveldb = join(browserBase, entry.name, 'Local Storage', 'leveldb')
        if (existsSync(leveldb)) {
          dirs.push(leveldb)
        }
      }
    } catch {
      // Ignore read errors
    }

    return dirs
  }

  async extract(): Promise<ExtractedWebexToken | null> {
    const profileDirs = this.getBrowserProfileDirs()

    if (profileDirs.length === 0) {
      this.debug('No browser profile directories found')
      return null
    }

    let best: { token: ExtractedWebexToken; source: string } | null = null

    for (const leveldbDir of profileDirs) {
      this.debug(`Scanning: ${leveldbDir}`)

      const result = (await this.scanViaClassicLevelCopy(leveldbDir)) ?? this.scanRawFiles(leveldbDir)

      if (result?.token) {
        const token = result.token
        if (result.encryptionKeys.size > 0) {
          token.encryptionKeys = result.encryptionKeys
        }

        this.debug(
          `Found token in: ${leveldbDir} (expires: ${token.expiresAt ? new Date(token.expiresAt).toISOString() : 'unknown'}, length: ${token.accessToken.length})`,
        )

        if (!best || this.isTokenFresher(token, best.token)) {
          best = { token, source: leveldbDir }
        }
      }
    }

    if (!best) {
      this.debug('No Webex tokens found in any browser profile')
      return null
    }

    this.debug(`Selected token from: ${best.source}`)
    return best.token
  }

  private isTokenFresher(candidate: ExtractedWebexToken, current: ExtractedWebexToken): boolean {
    const candidateExpiry = candidate.expiresAt ?? 0
    const currentExpiry = current.expiresAt ?? 0
    if (candidateExpiry > 0 && currentExpiry > 0) {
      return candidateExpiry > currentExpiry
    }
    if (candidateExpiry > 0 && currentExpiry === 0) return true
    return false
  }

  private async scanViaClassicLevelCopy(dbPath: string): Promise<ScanResult | null> {
    const tempDir = join(tmpdir(), `webex-leveldb-${Date.now()}-${Math.random().toString(36).slice(2)}`)

    try {
      mkdirSync(tempDir, { recursive: true })

      const files = readdirSync(dbPath)
      for (const file of files) {
        if (file === 'LOCK') continue
        const src = join(dbPath, file)
        try {
          if (statSync(src).isFile()) {
            copyFileSync(src, join(tempDir, file))
          }
        } catch {}
      }

      return await this.copyAndScanLevelDB(tempDir)
    } catch {
      return null
    } finally {
      try {
        rmSync(tempDir, { recursive: true, force: true })
      } catch {}
    }
  }

  private async copyAndScanLevelDB(dbPath: string): Promise<ScanResult | null> {
    let db: ClassicLevel<string, Buffer> | null = null
    let token: ExtractedWebexToken | null = null
    const encryptionKeys = new Map<string, string>()

    try {
      db = new ClassicLevel(dbPath, { keyEncoding: 'utf8', valueEncoding: 'buffer' })

      for await (const [key, value] of db.iterator()) {
        if (!key.includes('web.webex.com')) continue

        const decoded = this.decodeLevelDBValue(value)

        if (!token && (decoded.includes('"supertoken"') || decoded.includes('"Credentials"'))) {
          token = this.extractTokenFromString(decoded)
        }

        if (decoded.includes('"Encryption"') && decoded.includes('kms://')) {
          const found = this.extractEncryptionKeysFromString(decoded)
          for (const [uri, keyStr] of found) {
            encryptionKeys.set(uri, keyStr)
          }
        }
      }
    } catch (e) {
      this.debug(`ClassicLevel failed: ${e instanceof Error ? e.message : String(e)}`)
      return null
    } finally {
      if (db) {
        try {
          await db.close()
        } catch {}
      }
    }

    if (!token) return null
    return { token, encryptionKeys }
  }

  private scanRawFiles(leveldbDir: string): ScanResult | null {
    let token: ExtractedWebexToken | null = null
    const encryptionKeys = new Map<string, string>()

    try {
      const files = readdirSync(leveldbDir)

      const sorted = [...files]
        .filter((f) => f.endsWith('.log') || f.endsWith('.ldb'))
        .sort((a, b) => {
          const aIsLog = a.endsWith('.log') ? 0 : 1
          const bIsLog = b.endsWith('.log') ? 0 : 1
          if (aIsLog !== bIsLog) return aIsLog - bIsLog
          try {
            return statSync(join(leveldbDir, b)).mtimeMs - statSync(join(leveldbDir, a)).mtimeMs
          } catch {
            return 0
          }
        })

      for (const file of sorted) {
        const filePath = join(leveldbDir, file)
        try {
          const stat = statSync(filePath)
          if (stat.size > 50 * 1024 * 1024) continue

          const buffer = readFileSync(filePath)
          const candidates = [buffer.toString('utf8'), this.stripNullBytes(buffer)]

          for (const content of candidates) {
            if (!token && (content.includes('"supertoken"') || content.includes('"Credentials"'))) {
              token = this.extractTokenFromString(content)
            }

            if (content.includes('"Encryption"') && content.includes('kms://')) {
              const found = this.extractEncryptionKeysFromString(content)
              for (const [uri, keyStr] of found) {
                encryptionKeys.set(uri, keyStr)
              }
            }
          }
        } catch {
          // Skip unreadable files
        }
      }
    } catch {
      this.debug(`Failed to read directory: ${leveldbDir}`)
    }

    if (!token) return null
    return { token, encryptionKeys }
  }

  private decodeLevelDBValue(buf: Buffer): string {
    if (buf.length < 2) return buf.toString('utf8')
    // Chromium localStorage: 0x00 prefix = UTF-16LE, 0x01 prefix = Latin1/UTF-8
    if (buf[0] === 0x00 && (buf.length - 1) % 2 === 0) {
      return buf.subarray(1).toString('utf16le')
    }
    if (buf[0] === 0x01) {
      return buf.subarray(1).toString('utf8')
    }
    return buf.toString('utf8')
  }

  private stripNullBytes(buffer: Buffer): string {
    const bytes: number[] = []
    for (let i = 0; i < buffer.length; i++) {
      if (buffer[i] !== 0) bytes.push(buffer[i]!)
    }
    return Buffer.from(bytes).toString('utf8')
  }

  private extractTokenFromString(content: string): ExtractedWebexToken | null {
    const outerObjectMarkerIdx = content.indexOf('"Credentials"')
    const innermostMarkerIdx = content.indexOf('"supertoken"')

    const markerIdx =
      outerObjectMarkerIdx !== -1 ? outerObjectMarkerIdx : innermostMarkerIdx !== -1 ? innermostMarkerIdx : -1

    if (markerIdx === -1) return null

    const json = this.extractJsonAroundIndex(content, markerIdx)
    if (!json) return null

    return this.parseWebexStorage(json)
  }

  private extractJsonAroundIndex(content: string, markerIdx: number): string | null {
    let depth = 0
    let start = -1
    for (let i = markerIdx; i >= 0; i--) {
      if (content[i] === '}') depth++
      if (content[i] === '{') {
        if (depth === 0) {
          start = i
          break
        }
        depth--
      }
    }
    if (start === -1) return null

    depth = 0
    let end = -1
    for (let i = start; i < content.length; i++) {
      if (content[i] === '{') depth++
      if (content[i] === '}') {
        depth--
        if (depth === 0) {
          end = i + 1
          break
        }
      }
    }
    if (end === -1) return null

    return content.substring(start, end)
  }

  parseWebexStorage(jsonStr: string): ExtractedWebexToken | null {
    try {
      const data = JSON.parse(jsonStr)

      const supertoken = data?.Credentials?.['@']?.supertoken ?? data?.['@']?.supertoken ?? data?.supertoken ?? null

      if (!supertoken?.access_token) return null

      const accessToken = String(supertoken.access_token)
      if (accessToken.length < 20) return null

      const result: ExtractedWebexToken = { accessToken }

      if (supertoken.refresh_token) {
        result.refreshToken = String(supertoken.refresh_token)
      }

      if (typeof supertoken.expires === 'number') {
        result.expiresAt = supertoken.expires
      } else if (typeof supertoken.expires_in === 'number') {
        result.expiresAt = Date.now() + supertoken.expires_in * 1000
      }

      const deviceUrl = data?.Device?.['@']?.url ?? data?.['@']?.deviceUrl ?? null
      if (deviceUrl && typeof deviceUrl === 'string') {
        result.deviceUrl = deviceUrl
      }

      const userId = data?.Device?.['@']?.userId ?? null
      if (userId && typeof userId === 'string') {
        result.userId = userId
      }

      return result
    } catch {
      return null
    }
  }

  private extractEncryptionKeysFromString(content: string): Map<string, string> {
    const keys = new Map<string, string>()

    if (!content.includes('"Encryption"') || !content.includes('kms://')) {
      return keys
    }

    // Values in the Encryption map are double-encoded: a kms:// URI key maps to a
    // JSON string whose content is the serialized key object {"uri":..., "jwk":{...}}.
    // Pattern: "kms://..." : "{\"uri\":...,\"jwk\":{...}}"
    const kmsPattern = /"(kms:\/\/[^"]+)"\s*:\s*("(?:[^"\\]|\\.)*")/g
    let match: RegExpExecArray | null

    while ((match = kmsPattern.exec(content)) !== null) {
      const uri = match[1]!
      const rawValue = match[2]!
      try {
        const innerStr = JSON.parse(rawValue) as unknown
        if (typeof innerStr !== 'string') continue
        const keyObj = JSON.parse(innerStr) as Record<string, unknown>
        if (keyObj?.jwk) {
          keys.set(uri, innerStr)
        }
      } catch {}
    }

    return keys
  }
}
