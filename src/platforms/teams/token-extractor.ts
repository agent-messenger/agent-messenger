import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import {
  BROWSER_KEYCHAIN_VARIANTS,
  CHROMIUM_BROWSERS,
  ChromiumCookieDecryptor,
  ChromiumCookieReader,
  discoverBrowserProfileDirs,
  findLocalStatePath,
  getBrowserBasePath,
} from '@/shared/chromium'
import type { KeychainVariant } from '@/shared/chromium'
import { DerivedKeyCache } from '@/shared/utils/derived-key-cache'

import type { TeamsAccountType } from './types'

export interface ExtractedTeamsToken {
  token: string
  accountType: TeamsAccountType
  // False when the account type was guessed from the cookie path and needs to be
  // confirmed against the Teams API (e.g. browser profiles, which don't encode
  // work vs personal in the path). True for desktop paths that reliably encode
  // the account type (WV2Profile_tfw vs WV2Profile_tfl).
  accountTypeKnown: boolean
}

interface TeamsCookiePath {
  path: string
  accountType: TeamsAccountType
  accountTypeKnown: boolean
}

const TEAMS_PROCESS_NAMES: Record<string, string> = {
  darwin: 'Microsoft Teams',
  win32: 'Teams.exe',
  linux: 'teams',
}

const SKYPETOKEN_COOKIE_NAME = 'skypetoken_asm'
const TEAMS_HOST_PATTERNS = [
  '.asyncgw.teams.microsoft.com',
  '.asm.skype.com',
  'teams.microsoft.com',
  'teams.live.com',
  '.microsoft.com',
]

const TEAMS_KEYCHAIN_VARIANTS: KeychainVariant[] = [
  { service: 'Microsoft Teams Safe Storage', account: 'Microsoft Teams' },
  {
    service: 'Microsoft Teams (work or school) Safe Storage',
    account: 'Microsoft Teams (work or school)',
  },
  { service: 'Teams Safe Storage', account: 'Teams' },
]

export class TeamsTokenExtractor {
  private platform: NodeJS.Platform
  private decryptor: ChromiumCookieDecryptor
  private cookieReader: ChromiumCookieReader
  private debugLog: ((message: string) => void) | null

  constructor(platform?: NodeJS.Platform, keyCache?: DerivedKeyCache, debugLog?: (message: string) => void) {
    this.platform = platform ?? process.platform
    this.debugLog = debugLog ?? null

    const resolvedKeyCache = keyCache ?? new DerivedKeyCache()
    this.decryptor = new ChromiumCookieDecryptor({
      platform: this.platform,
      appKeychainVariants: TEAMS_KEYCHAIN_VARIANTS,
      keyCache: resolvedKeyCache,
      keyCachePlatform: 'teams',
    })
    this.cookieReader = new ChromiumCookieReader()
  }

  private debug(message: string): void {
    this.debugLog?.(message)
  }

  getDesktopCookiesPaths(): TeamsCookiePath[] {
    switch (this.platform) {
      case 'darwin': {
        const ebWebViewBase = join(
          homedir(),
          'Library',
          'Containers',
          'com.microsoft.teams2',
          'Data',
          'Library',
          'Application Support',
          'Microsoft',
          'MSTeams',
          'EBWebView',
        )
        return [
          { path: join(ebWebViewBase, 'WV2Profile_tfw', 'Cookies'), accountType: 'work', accountTypeKnown: true },
          {
            path: join(ebWebViewBase, 'WV2Profile_tfw', 'Network', 'Cookies'),
            accountType: 'work',
            accountTypeKnown: true,
          },
          {
            path: join(ebWebViewBase, 'WV2Profile_tfl', 'Cookies'),
            accountType: 'personal',
            accountTypeKnown: true,
          },
          {
            path: join(ebWebViewBase, 'WV2Profile_tfl', 'Network', 'Cookies'),
            accountType: 'personal',
            accountTypeKnown: true,
          },
          { path: join(ebWebViewBase, 'Default', 'Cookies'), accountType: 'work', accountTypeKnown: false },
          { path: join(ebWebViewBase, 'Default', 'Network', 'Cookies'), accountType: 'work', accountTypeKnown: false },
          {
            path: join(homedir(), 'Library', 'Application Support', 'Microsoft', 'Teams', 'Cookies'),
            accountType: 'work',
            accountTypeKnown: false,
          },
        ]
      }
      case 'linux':
        return [
          {
            path: join(homedir(), '.config', 'Microsoft', 'Microsoft Teams', 'Cookies'),
            accountType: 'work',
            accountTypeKnown: false,
          },
        ]
      case 'win32': {
        const localAppData = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local')
        const appdata = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming')
        const ebWebViewBase = join(
          localAppData,
          'Packages',
          'MSTeams_8wekyb3d8bbwe',
          'LocalCache',
          'Microsoft',
          'MSTeams',
          'EBWebView',
        )
        return [
          { path: join(ebWebViewBase, 'WV2Profile_tfw', 'Cookies'), accountType: 'work', accountTypeKnown: true },
          {
            path: join(ebWebViewBase, 'WV2Profile_tfw', 'Network', 'Cookies'),
            accountType: 'work',
            accountTypeKnown: true,
          },
          {
            path: join(ebWebViewBase, 'WV2Profile_tfl', 'Cookies'),
            accountType: 'personal',
            accountTypeKnown: true,
          },
          {
            path: join(ebWebViewBase, 'WV2Profile_tfl', 'Network', 'Cookies'),
            accountType: 'personal',
            accountTypeKnown: true,
          },
          { path: join(ebWebViewBase, 'Default', 'Cookies'), accountType: 'work', accountTypeKnown: false },
          { path: join(ebWebViewBase, 'Default', 'Network', 'Cookies'), accountType: 'work', accountTypeKnown: false },
          { path: join(appdata, 'Microsoft', 'Teams', 'Cookies'), accountType: 'work', accountTypeKnown: false },
        ]
      }
      default:
        return []
    }
  }

  getBrowserCookiesPaths(): TeamsCookiePath[] {
    const paths: TeamsCookiePath[] = []

    for (const browser of CHROMIUM_BROWSERS) {
      const browserBase = getBrowserBasePath(browser, this.platform)
      if (!browserBase) continue

      for (const profileDir of discoverBrowserProfileDirs(browserBase)) {
        paths.push({ path: join(profileDir, 'Cookies'), accountType: 'work', accountTypeKnown: false })
        paths.push({ path: join(profileDir, 'Network', 'Cookies'), accountType: 'work', accountTypeKnown: false })
      }
    }

    return paths
  }

  getTeamsCookiesPaths(): TeamsCookiePath[] {
    return [...this.getDesktopCookiesPaths(), ...this.getBrowserCookiesPaths()]
  }

  getLocalStatePath(): string {
    switch (this.platform) {
      case 'darwin':
        return join(homedir(), 'Library', 'Application Support', 'Microsoft', 'Teams', 'Local State')
      case 'linux':
        return join(homedir(), '.config', 'Microsoft', 'Microsoft Teams', 'Local State')
      case 'win32': {
        const localAppData = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local')
        const appdata = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming')
        const newTeamsPath = join(
          localAppData,
          'Packages',
          'MSTeams_8wekyb3d8bbwe',
          'LocalCache',
          'Microsoft',
          'MSTeams',
          'EBWebView',
          'Local State',
        )
        if (existsSync(newTeamsPath)) return newTeamsPath
        return join(appdata, 'Microsoft', 'Teams', 'Local State')
      }
      default:
        return ''
    }
  }

  getKeychainVariants(): KeychainVariant[] {
    return [...TEAMS_KEYCHAIN_VARIANTS, ...BROWSER_KEYCHAIN_VARIANTS]
  }

  isValidSkypeToken(token: string): boolean {
    if (!token || token.length < 50) return false
    // Real skype tokens are JWT-shaped or long base64url-ish strings. Reject anything
    // containing XML/CLIXML artifacts (e.g. leaked PowerShell progress stream) or
    // other non-token characters up front to stop garbage from being reported as valid.
    if (/[<>{}\s"'`]/.test(token)) return false
    if (token.startsWith('eyJ')) return /^[A-Za-z0-9._-]+$/.test(token)
    return /^[A-Za-z0-9._~+/=-]+$/.test(token)
  }

  isEncryptedValue(value: Buffer): boolean {
    return this.decryptor.isEncryptedValue(value)
  }

  async extract(): Promise<ExtractedTeamsToken[]> {
    await this.decryptor.loadCachedKey()
    return this.extractFromCookiesDB()
  }

  async clearKeyCache(): Promise<void> {
    await this.decryptor.clearKeyCache()
  }

  private async extractFromCookiesDB(): Promise<ExtractedTeamsToken[]> {
    const results: ExtractedTeamsToken[] = []
    const seenKnownAccountTypes = new Set<TeamsAccountType>()
    const seenTokens = new Set<string>()
    const allPaths = this.getTeamsCookiesPaths()

    this.debug(`Scanning ${allPaths.length} candidate cookie path(s)`)

    for (const { path: dbPath, accountType, accountTypeKnown } of allPaths) {
      if (!dbPath) continue

      if (!existsSync(dbPath)) {
        this.debug(`  [skip] ${dbPath} (not found)`)
        continue
      }

      if (accountTypeKnown && seenKnownAccountTypes.has(accountType)) {
        this.debug(`  [skip] ${dbPath} (already have ${accountType} account)`)
        continue
      }

      const typeLabel = accountTypeKnown ? accountType : `${accountType}?`
      this.debug(`  [try]  ${dbPath} (${typeLabel})`)

      const token = await this.copyAndExtract(dbPath)
      if (!token || !this.isValidSkypeToken(token)) {
        if (token) {
          this.debug(`  [fail] Token too short (${token.length} chars, need >=50)`)
        } else {
          this.debug(`  [fail] No token extracted`)
        }
        continue
      }

      if (seenTokens.has(token)) {
        this.debug(`  [skip] Duplicate token (already extracted from another path)`)
        continue
      }

      this.debug(`  [ok]   Extracted valid token (${token.length} chars)`)
      results.push({ token, accountType, accountTypeKnown })
      seenTokens.add(token)
      if (accountTypeKnown) {
        seenKnownAccountTypes.add(accountType)
      }
    }

    this.debug(`Extraction complete: ${results.length} token(s) found`)
    return results
  }

  private async copyAndExtract(dbPath: string): Promise<string | null> {
    let tempPath = dbPath

    try {
      tempPath = this.copyDatabaseToTemp(dbPath, dbPath)

      let localStatePath: string | undefined
      if (this.platform === 'win32') {
        localStatePath = findLocalStatePath(dbPath) ?? undefined
        if (localStatePath) {
          this.debug(`    Local State (from cookie path): ${localStatePath}`)
        } else {
          localStatePath = this.getLocalStatePath()
          if (existsSync(localStatePath)) {
            this.debug(`    Local State (fallback): ${localStatePath}`)
          } else {
            this.debug(`    Local State not found (tried fallback: ${localStatePath})`)
            localStatePath = undefined
          }
        }
      }

      return await this.extractFromSQLite(tempPath, localStatePath)
    } catch (error) {
      this.debug(`    Copy/extract error: ${(error as Error).message}`)
      return null
    } finally {
      this.cleanupTempFile(tempPath)
    }
  }

  private async extractFromSQLite(dbPath: string, localStatePath?: string): Promise<string | null> {
    try {
      for (const hostPattern of TEAMS_HOST_PATTERNS) {
        const sql = `
          SELECT value, encrypted_value 
          FROM cookies 
          WHERE name = '${SKYPETOKEN_COOKIE_NAME}' 
          AND host_key LIKE '%${hostPattern}%'
          LIMIT 1
        `

        type CookieRow = { value?: string; encrypted_value?: Uint8Array | Buffer } | null

        const row = await this.cookieReader.queryFirst<CookieRow>(dbPath, sql)
        if (!row) continue

        if (row.value && row.value.length >= 50) {
          this.debug(`    Found plaintext cookie for ${hostPattern} (${row.value.length} chars)`)
          return row.value
        }

        if (!row.encrypted_value || row.encrypted_value.length === 0) {
          this.debug(`    No cookie data for ${hostPattern}`)
          continue
        }

        const encBuf = Buffer.from(row.encrypted_value)
        const isEncrypted = this.isEncryptedValue(encBuf)
        this.debug(
          `    Found cookie for ${hostPattern}: ${encBuf.length} bytes, encrypted=${isEncrypted}, prefix=${encBuf.subarray(0, 3).toString('utf8')}`,
        )

        const decryptedBuf = this.decryptor.decryptCookieRaw(encBuf, localStatePath)
        if (!decryptedBuf) {
          this.debug(`    Decryption failed`)
          continue
        }

        this.debug(`    Decrypted: ${decryptedBuf.length} bytes`)
        const token = this.postProcessDecrypted(decryptedBuf)
        if (this.isValidSkypeToken(token)) return token

        this.debug(`    Post-process result not a valid token (${token.length} chars)`)
      }

      return null
    } catch (error) {
      this.debug(`    SQLite query error: ${(error as Error).message}`)
      return null
    }
  }

  private postProcessDecrypted(raw: Buffer): string {
    const stripped = ChromiumCookieDecryptor.stripIntegrityHash(raw)
    if (stripped !== raw) return stripped.toString('utf8')

    const str = raw.toString('utf8')

    const jwtStart = str.indexOf('eyJ')
    if (jwtStart > 0 && jwtStart <= 32) return str.substring(jwtStart)

    if (str.length > 32) {
      const possibleToken = str.substring(32)
      if (possibleToken.length > 50 && /^[A-Za-z0-9._-]+$/.test(possibleToken.substring(0, 50))) {
        return possibleToken
      }
    }

    return str
  }

  private copyDatabaseToTemp(sourcePath: string, _destPath: string): string {
    return sourcePath
  }

  private cleanupTempFile(_tempPath: string): void {}

  private decryptAESGCM(encryptedData: Buffer, key: Buffer): string | null {
    return this.decryptor.decryptAESGCM(encryptedData, key)
  }

  private getKeychainPassword(): string | null {
    for (const variant of this.getKeychainVariants()) {
      const password = this.execSecurityCommand(variant.service, variant.account)
      if (password) return password
    }

    return null
  }

  private execSecurityCommand(service: string, account: string): string | null {
    try {
      const safeService = service.replace(/"/g, '\\"')
      const safeAccount = account.replace(/"/g, '\\"')
      const result = execSync(`security find-generic-password -s "${safeService}" -a "${safeAccount}" -w 2>/dev/null`, {
        encoding: 'utf8',
      })
      return result.trim() || null
    } catch {
      return null
    }
  }

  async isTeamsRunning(): Promise<boolean> {
    return this.checkProcessRunning(this.getProcessName())
  }

  private getProcessName(): string {
    return TEAMS_PROCESS_NAMES[this.platform] || TEAMS_PROCESS_NAMES.linux
  }

  private checkProcessRunning(processName: string): boolean {
    try {
      if (this.platform === 'win32') {
        const result = execSync(`tasklist /FI "IMAGENAME eq ${processName}" 2>nul`, {
          encoding: 'utf8',
        })
        return result.toLowerCase().includes(processName.toLowerCase())
      }

      const result = execSync(`pgrep -f "${processName}" 2>/dev/null || true`, {
        encoding: 'utf8',
      })
      return result.trim().length > 0
    } catch {
      return false
    }
  }
}
