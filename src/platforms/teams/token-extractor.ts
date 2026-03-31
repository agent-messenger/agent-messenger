import { execSync } from 'node:child_process'
import { createDecipheriv, pbkdf2Sync } from 'node:crypto'
import { copyFileSync, existsSync, readFileSync, readdirSync, unlinkSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

import { DerivedKeyCache } from '@/shared/utils/derived-key-cache'

import type { TeamsAccountType } from './types'

const require = createRequire(import.meta.url)

export interface ExtractedTeamsToken {
  token: string
  accountType: TeamsAccountType
}

interface TeamsCookiePath {
  path: string
  accountType: TeamsAccountType
}

interface KeychainVariant {
  service: string
  account: string
}

interface BrowserConfig {
  name: string
  darwin: string
  linux: string
  win32: string
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
    darwin: 'Microsoft Edge',
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

export class TeamsTokenExtractor {
  private platform: NodeJS.Platform
  private keyCache: DerivedKeyCache
  private cachedKey: Buffer | null = null

  constructor(platform?: NodeJS.Platform, keyCache?: DerivedKeyCache) {
    this.platform = platform ?? process.platform
    this.keyCache = keyCache ?? new DerivedKeyCache()
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

    for (const browser of BROWSERS) {
      const browserBase = this.getBrowserBasePath(browser)
      if (!browserBase) continue

      const profileDirs = this.discoverProfileDirs(browserBase)
      for (const profileDir of profileDirs) {
        paths.push({ path: join(profileDir, 'Cookies'), accountType: 'work' })
        paths.push({ path: join(profileDir, 'Network', 'Cookies'), accountType: 'work' })
      }
    }

    return paths
  }

  getTeamsCookiesPaths(): TeamsCookiePath[] {
    const desktopPaths = this.getDesktopCookiesPaths()
    const browserPaths = this.getBrowserCookiesPaths()
    return [...desktopPaths, ...browserPaths]
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

    dirs.push(join(browserBase, 'Default'))

    if (!existsSync(browserBase)) return dirs

    try {
      const entries = readdirSync(browserBase, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        if (!/^Profile \d+$/i.test(entry.name)) continue
        dirs.push(join(browserBase, entry.name))
      }
    } catch {}

    return dirs
  }

  private findLocalStateForCookiePath(cookiePath: string): string | null {
    const parts = cookiePath.split(/[/\\]/)
    for (let levels = 2; levels <= 4; levels++) {
      if (parts.length < levels) break
      const base = parts.slice(0, parts.length - levels).join('/')
      const candidate = join(base, 'Local State')
      if (existsSync(candidate)) return candidate
    }
    return null
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
    return [
      // Teams-specific keychain entries
      { service: 'Microsoft Teams Safe Storage', account: 'Microsoft Teams' },
      {
        service: 'Microsoft Teams (work or school) Safe Storage',
        account: 'Microsoft Teams (work or school)',
      },
      { service: 'Microsoft Edge Safe Storage', account: 'Microsoft Edge' },
      { service: 'Teams Safe Storage', account: 'Teams' },
      // Browser keychain entries for fallback
      { service: 'Chrome Safe Storage', account: 'Chrome' },
      { service: 'Chrome Canary Safe Storage', account: 'Chrome Canary' },
      { service: 'Arc Safe Storage', account: 'Arc' },
      { service: 'Brave Safe Storage', account: 'Brave' },
      { service: 'Vivaldi Safe Storage', account: 'Vivaldi' },
      { service: 'Chromium Safe Storage', account: 'Chromium' },
    ]
  }

  isValidSkypeToken(token: string): boolean {
    if (!token || token.length === 0) return false
    // Skype tokens are typically JWT format or long base64 strings (50+ chars)
    return token.length >= 50
  }

  isEncryptedValue(value: Buffer): boolean {
    if (!value || value.length < 4) return false
    const prefix = value.subarray(0, 3).toString('utf8')
    return prefix === 'v10' || prefix === 'v11'
  }

  async extract(): Promise<ExtractedTeamsToken[]> {
    await this.loadCachedKey()
    return this.extractFromCookiesDB()
  }

  private async loadCachedKey(): Promise<void> {
    if (this.platform !== 'darwin') return

    const cached = await this.keyCache.get('teams')
    if (cached) {
      this.cachedKey = cached
    }
  }

  async clearKeyCache(): Promise<void> {
    await this.keyCache.clear('teams')
    this.cachedKey = null
  }

  private async extractFromCookiesDB(): Promise<ExtractedTeamsToken[]> {
    const cookiePaths = this.getTeamsCookiesPaths()
    const results: ExtractedTeamsToken[] = []
    const seenAccountTypes = new Set<TeamsAccountType>()

    for (const { path: dbPath, accountType } of cookiePaths) {
      if (!dbPath || !existsSync(dbPath)) continue
      // Skip fallback paths if we already have a token for this account type
      if (seenAccountTypes.has(accountType)) continue

      const token = await this.copyAndExtract(dbPath)
      if (token && this.isValidSkypeToken(token)) {
        results.push({ token, accountType })
        seenAccountTypes.add(accountType)
      }
    }

    return results
  }

  private async copyAndExtract(dbPath: string): Promise<string | null> {
    const tempPath = join(tmpdir(), `teams-cookies-${Date.now()}`)

    try {
      this.copyDatabaseToTemp(dbPath, tempPath)
      // For Windows: find the Local State relative to the cookie path so browser cookies
      // use the browser's own Local State instead of the Teams app Local State.
      const localStatePath =
        this.platform === 'win32'
          ? (this.findLocalStateForCookiePath(dbPath) ?? this.getLocalStatePath())
          : undefined
      const token = await this.extractFromSQLite(tempPath, localStatePath)
      this.cleanupTempFile(tempPath)
      return token
    } catch {
      this.cleanupTempFile(tempPath)
      return null
    }
  }

  private copyDatabaseToTemp(sourcePath: string, destPath: string): string {
    copyFileSync(sourcePath, destPath)
    return destPath
  }

  private cleanupTempFile(tempPath: string): void {
    try {
      if (existsSync(tempPath)) {
        unlinkSync(tempPath)
      }
    } catch {
      // Ignore cleanup errors
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

        let row: CookieRow
        if (typeof globalThis.Bun !== 'undefined') {
          const { Database } = require('bun:sqlite')
          const db = new Database(dbPath, { readonly: true })
          row = db.query(sql).get() as CookieRow
          db.close()
        } else {
          const Database = require('better-sqlite3')
          const db = new Database(dbPath, { readonly: true })
          row = db.prepare(sql).get() as CookieRow
          db.close()
        }

        if (row?.encrypted_value) {
          const decrypted = this.decryptCookie(Buffer.from(row.encrypted_value), localStatePath)
          if (decrypted && this.isValidSkypeToken(decrypted)) {
            return decrypted
          }
        }
      }

      return null
    } catch {
      return null
    }
  }

  private decryptCookie(encryptedValue: Buffer, localStatePath?: string): string | null {
    if (!this.isEncryptedValue(encryptedValue)) {
      // Not encrypted, return as-is
      return encryptedValue.toString('utf8')
    }

    if (this.platform === 'win32') {
      return this.decryptWindowsCookie(encryptedValue, localStatePath)
    } else if (this.platform === 'darwin') {
      return this.decryptMacCookie(encryptedValue)
    } else if (this.platform === 'linux') {
      return this.decryptLinuxCookie(encryptedValue)
    }

    return null
  }

  private decryptWindowsCookie(encryptedData: Buffer, localStatePath?: string): string | null {
    try {
      const statePath = localStatePath ?? this.getLocalStatePath()
      if (!existsSync(statePath)) return null

      const localState = JSON.parse(readFileSync(statePath, 'utf8'))
      const encryptedKey = Buffer.from(localState.os_crypt.encrypted_key, 'base64')

      // Remove DPAPI prefix (5 bytes)
      const dpapiBlobKey = encryptedKey.subarray(5)
      const masterKey = this.decryptDPAPI(dpapiBlobKey)
      if (!masterKey) return null

      return this.decryptAESGCM(encryptedData, masterKey)
    } catch {
      return null
    }
  }

  private decryptDPAPI(encryptedBlob: Buffer): Buffer | null {
    try {
      const b64 = encryptedBlob.toString('base64')
      const psScript = `
        Add-Type -AssemblyName System.Security
        $bytes = [Convert]::FromBase64String('${b64}')
        $decrypted = [Security.Cryptography.ProtectedData]::Unprotect($bytes, $null, 'CurrentUser')
        [Convert]::ToBase64String($decrypted)
      `.replace(/\n/g, ' ')

      const result = execSync(`powershell -Command "${psScript}"`, { encoding: 'utf8' })
      return Buffer.from(result.trim(), 'base64')
    } catch {
      return null
    }
  }

  private decryptMacCookie(encryptedData: Buffer): string | null {
    if (this.cachedKey) {
      const decrypted = this.decryptAESCBC(encryptedData, this.cachedKey)
      if (decrypted) return decrypted
    }

    const password = this.getKeychainPassword()
    if (!password) return null

    const key = pbkdf2Sync(password, 'saltysalt', 1003, 16, 'sha1')
    const decrypted = this.decryptAESCBC(encryptedData, key)
    if (decrypted) {
      this.cachedKey = key
      this.keyCache.set('teams', key).catch(() => {})
    }
    return decrypted
  }

  private decryptLinuxCookie(encryptedData: Buffer): string | null {
    // Linux uses a hardcoded password 'peanuts' for Chromium-based apps
    const key = pbkdf2Sync('peanuts', 'saltysalt', 1, 16, 'sha1')
    return this.decryptAESCBC(encryptedData, key)
  }

  private getKeychainPassword(): string | null {
    const variants = this.getKeychainVariants()

    for (const variant of variants) {
      const password = this.execSecurityCommand(variant.service, variant.account)
      if (password) return password
    }

    return null
  }

  private execSecurityCommand(service: string, account: string): string | null {
    try {
      // Escape double quotes in service/account to prevent command injection
      const safeService = service.replace(/"/g, '\\"')
      const safeAccount = account.replace(/"/g, '\\"')
      const result = execSync(
        `security find-generic-password -s "${safeService}" -a "${safeAccount}" -w 2>/dev/null`,
        { encoding: 'utf8' },
      )
      return result.trim()
    } catch {
      return null
    }
  }

  private decryptAESCBC(encryptedData: Buffer, key: Buffer): string | null {
    try {
      const ciphertext = encryptedData.subarray(3)
      const iv = Buffer.alloc(16, 0x20)

      const decipher = createDecipheriv('aes-128-cbc', key, iv)
      decipher.setAutoPadding(true)

      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])

      // Chromium v130+ prepends a 32-byte integrity hash before the actual cookie value.
      // Detect by checking if the first bytes contain non-printable characters.
      if (decrypted.length > 32) {
        const hasNonPrintablePrefix = decrypted.subarray(0, 32).some((b) => b < 0x20 || b > 0x7e)
        if (hasNonPrintablePrefix) {
          return decrypted.subarray(32).toString('utf8')
        }
      }

      const decryptedStr = decrypted.toString('utf8')

      // Chromium v24+ prepends a 32-byte integrity hash before the actual value
      // Look for JWT token start (eyJ) or other token patterns
      const jwtStart = decryptedStr.indexOf('eyJ')
      if (jwtStart > 0 && jwtStart <= 32) {
        return decryptedStr.substring(jwtStart)
      }

      // If no JWT prefix found but decryption succeeded, check if first 32 bytes are garbage
      if (decrypted.length > 32) {
        const possibleToken = decryptedStr.substring(32)
        if (possibleToken.length > 50 && /^[A-Za-z0-9._-]+$/.test(possibleToken.substring(0, 50))) {
          return possibleToken
        }
      }

      return decryptedStr
    } catch {
      return null
    }
  }

  private decryptAESGCM(encryptedData: Buffer, key: Buffer): string | null {
    try {
      // Format: v10 (3 bytes) + IV (12 bytes) + ciphertext + auth tag (16 bytes)
      if (encryptedData.length < 3 + 12 + 16) return null

      const iv = encryptedData.subarray(3, 15)
      const authTag = encryptedData.subarray(-16)
      const ciphertext = encryptedData.subarray(15, -16)

      const decipher = createDecipheriv('aes-256-gcm', key, iv)
      decipher.setAuthTag(authTag)

      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
      return decrypted.toString('utf8')
    } catch {
      return null
    }
  }

  async isTeamsRunning(): Promise<boolean> {
    const processName = this.getProcessName()
    return this.checkProcessRunning(processName)
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
      } else {
        const result = execSync(`pgrep -f "${processName}" 2>/dev/null || true`, {
          encoding: 'utf8',
        })
        return result.trim().length > 0
      }
    } catch {
      return false
    }
  }
}
