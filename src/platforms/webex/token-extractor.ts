import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export interface ExtractedWebexToken {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
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

const SUPERTOKEN_MARKER = '"supertoken"'
const CREDENTIALS_MARKER = '"Credentials"'

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
        return join(
          process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'),
          relative,
        )
      default:
        return null
    }
  }

  private discoverProfileDirs(browserBase: string): string[] {
    const dirs: string[] = []

    if (!existsSync(browserBase)) return dirs

    // Check Default profile
    const defaultLeveldb = join(browserBase, 'Default', 'Local Storage', 'leveldb')
    if (existsSync(defaultLeveldb)) {
      dirs.push(defaultLeveldb)
    }

    // Discover Profile N directories
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

    for (const leveldbDir of profileDirs) {
      this.debug(`Scanning: ${leveldbDir}`)
      const token = this.extractFromLevelDBDir(leveldbDir)
      if (token) {
        this.debug(`Found token in: ${leveldbDir}`)
        return token
      }
    }

    this.debug('No Webex tokens found in any browser profile')
    return null
  }

  private extractFromLevelDBDir(leveldbDir: string): ExtractedWebexToken | null {
    try {
      const files = readdirSync(leveldbDir)

      // Scan .log files first (cleaner data, not compacted)
      const logFiles = files
        .filter((f) => f.endsWith('.log'))
        .sort((a, b) => {
          try {
            return statSync(join(leveldbDir, b)).mtimeMs - statSync(join(leveldbDir, a)).mtimeMs
          } catch {
            return 0
          }
        })

      for (const file of logFiles) {
        const token = this.extractFromFile(join(leveldbDir, file))
        if (token) return token
      }

      // Then .ldb files (compacted, may have fragmented data)
      const ldbFiles = files
        .filter((f) => f.endsWith('.ldb'))
        .sort((a, b) => {
          try {
            return statSync(join(leveldbDir, b)).mtimeMs - statSync(join(leveldbDir, a)).mtimeMs
          } catch {
            return 0
          }
        })

      for (const file of ldbFiles) {
        const token = this.extractFromFile(join(leveldbDir, file))
        if (token) return token
      }
    } catch {
      this.debug(`Failed to read directory: ${leveldbDir}`)
    }

    return null
  }

  private extractFromFile(filePath: string): ExtractedWebexToken | null {
    try {
      const stat = statSync(filePath)
      // Skip files larger than 50MB
      if (stat.size > 50 * 1024 * 1024) return null

      const buffer = readFileSync(filePath)
      return this.extractTokenFromBuffer(buffer)
    } catch {
      return null
    }
  }

  private extractTokenFromBuffer(buffer: Buffer): ExtractedWebexToken | null {
    const content = buffer.toString('utf8')

    // Look for the supertoken marker — most specific indicator of Webex SDK storage
    let markerIdx = content.indexOf(SUPERTOKEN_MARKER)
    if (markerIdx === -1) {
      // Fallback: look for Credentials marker
      markerIdx = content.indexOf(CREDENTIALS_MARKER)
      if (markerIdx === -1) return null
    }

    // Try to extract JSON containing the marker
    const json = this.extractJsonAroundIndex(content, markerIdx)
    if (!json) return null

    return this.parseWebexStorage(json)
  }

  private extractJsonAroundIndex(content: string, markerIdx: number): string | null {
    // Walk backward to find the opening brace of the outermost JSON object
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

    // Walk forward to find the matching closing brace
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

  private parseWebexStorage(jsonStr: string): ExtractedWebexToken | null {
    try {
      const data = JSON.parse(jsonStr)

      // Navigate: Credentials.@.supertoken or direct supertoken
      const supertoken =
        data?.Credentials?.['@']?.supertoken ??
        data?.['@']?.supertoken ??
        data?.supertoken ??
        null

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

      return result
    } catch {
      return null
    }
  }
}
