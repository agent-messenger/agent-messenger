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
}

interface TeamsCookiePath {
  path: string
  accountType: TeamsAccountType
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

  constructor(platform?: NodeJS.Platform, keyCache?: DerivedKeyCache) {
    this.platform = platform ?? process.platform

    const resolvedKeyCache = keyCache ?? new DerivedKeyCache()
    this.decryptor = new ChromiumCookieDecryptor({
      platform: this.platform,
      appKeychainVariants: TEAMS_KEYCHAIN_VARIANTS,
      keyCache: resolvedKeyCache,
      keyCachePlatform: 'teams',
    })
    this.cookieReader = new ChromiumCookieReader()
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
          { path: join(ebWebViewBase, 'WV2Profile_tfw', 'Cookies'), accountType: 'work' },
          { path: join(ebWebViewBase, 'WV2Profile_tfl', 'Cookies'), accountType: 'personal' },
          { path: join(ebWebViewBase, 'Default', 'Cookies'), accountType: 'work' },
          {
            path: join(homedir(), 'Library', 'Application Support', 'Microsoft', 'Teams', 'Cookies'),
            accountType: 'work',
          },
        ]
      }
      case 'linux':
        return [
          {
            path: join(homedir(), '.config', 'Microsoft', 'Microsoft Teams', 'Cookies'),
            accountType: 'work',
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
          { path: join(ebWebViewBase, 'WV2Profile_tfw', 'Cookies'), accountType: 'work' },
          { path: join(ebWebViewBase, 'WV2Profile_tfl', 'Cookies'), accountType: 'personal' },
          { path: join(ebWebViewBase, 'Default', 'Cookies'), accountType: 'work' },
          { path: join(appdata, 'Microsoft', 'Teams', 'Cookies'), accountType: 'work' },
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
        paths.push({ path: join(profileDir, 'Cookies'), accountType: 'work' })
        paths.push({ path: join(profileDir, 'Network', 'Cookies'), accountType: 'work' })
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
    if (!token || token.length === 0) return false
    return token.length >= 50
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
    const seenAccountTypes = new Set<TeamsAccountType>()

    for (const { path: dbPath, accountType } of this.getTeamsCookiesPaths()) {
      if (!dbPath || !existsSync(dbPath) || seenAccountTypes.has(accountType)) continue

      const token = await this.copyAndExtract(dbPath)
      if (token && this.isValidSkypeToken(token)) {
        results.push({ token, accountType })
        seenAccountTypes.add(accountType)
      }
    }

    return results
  }

  private async copyAndExtract(dbPath: string): Promise<string | null> {
    let tempPath = dbPath

    try {
      tempPath = this.copyDatabaseToTemp(dbPath, dbPath)
      const localStatePath =
        this.platform === 'win32' ? (findLocalStatePath(dbPath) ?? this.getLocalStatePath()) : undefined

      return await this.extractFromSQLite(tempPath, localStatePath)
    } catch {
      return null
    } finally {
      this.cleanupTempFile(tempPath)
    }
  }

  private async extractFromSQLite(dbPath: string, localStatePath?: string): Promise<string | null> {
    try {
      for (const hostPattern of TEAMS_HOST_PATTERNS) {
        const sql = `
          SELECT encrypted_value 
          FROM cookies 
          WHERE name = '${SKYPETOKEN_COOKIE_NAME}' 
          AND host_key LIKE '%${hostPattern}%'
          LIMIT 1
        `

        type CookieRow = { encrypted_value?: Uint8Array | Buffer } | null

        const row = await this.cookieReader.queryFirst<CookieRow>(dbPath, sql)
        if (!row?.encrypted_value) continue

        const decryptedBuf = this.decryptor.decryptCookieRaw(Buffer.from(row.encrypted_value), localStatePath)
        if (!decryptedBuf) continue

        const token = this.postProcessDecrypted(decryptedBuf)
        if (this.isValidSkypeToken(token)) return token
      }

      return null
    } catch {
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
