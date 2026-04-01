import { execSync } from 'node:child_process'
import { createDecipheriv, pbkdf2Sync } from 'node:crypto'
import { copyFileSync, existsSync, readFileSync, readdirSync, unlinkSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

import { DerivedKeyCache } from '@/shared/utils/derived-key-cache'

const require = createRequire(import.meta.url)

export interface ExtractedInstagramCookies {
  sessionid: string
  ds_user_id: string
  csrftoken: string
  mid?: string
  ig_did?: string
  rur?: string
}

interface BrowserConfig {
  name: string
  darwin: string
  linux: string
  win32: string
  localStateDarwin?: string
  localStateLinux?: string
  localStateWin32?: string
}

interface KeychainVariant {
  service: string
  account: string
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

const INSTAGRAM_HOST_KEYS = ['.instagram.com', 'www.instagram.com', 'i.instagram.com']
const INSTAGRAM_COOKIE_NAMES = ['sessionid', 'ds_user_id', 'csrftoken', 'mid', 'ig_did', 'rur']

export class InstagramTokenExtractor {
  private platform: NodeJS.Platform
  private debugLog: ((message: string) => void) | null
  private cachedKey: Buffer | null = null

  constructor(
    platform?: NodeJS.Platform,
    debugLog?: (message: string) => void,
    _keyCache?: DerivedKeyCache,
  ) {
    this.platform = platform ?? process.platform
    this.debugLog = debugLog ?? null
  }

  private debug(message: string): void {
    this.debugLog?.(message)
  }

  getBrowserCookiesPaths(): string[] {
    const paths: string[] = []

    for (const browser of BROWSERS) {
      const browserBase = this.getBrowserBasePath(browser)
      if (!browserBase) continue

      const profileDirs = this.discoverProfileDirs(browserBase)
      for (const profileDir of profileDirs) {
        paths.push(join(profileDir, 'Cookies'))
        paths.push(join(profileDir, 'Network', 'Cookies'))
      }
    }

    return paths
  }

  getLocalStatePaths(): string[] {
    const paths: string[] = []

    for (const browser of BROWSERS) {
      const browserBase = this.getBrowserBasePath(browser)
      if (!browserBase) continue

      paths.push(join(browserBase, 'Local State'))
    }

    return paths
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

  getKeychainVariants(): KeychainVariant[] {
    return [
      { service: 'Chrome Safe Storage', account: 'Chrome' },
      { service: 'Chrome Canary Safe Storage', account: 'Chrome Canary' },
      { service: 'Microsoft Edge Safe Storage', account: 'Microsoft Edge' },
      { service: 'Arc Safe Storage', account: 'Arc' },
      { service: 'Brave Safe Storage', account: 'Brave' },
      { service: 'Vivaldi Safe Storage', account: 'Vivaldi' },
      { service: 'Chromium Safe Storage', account: 'Chromium' },
    ]
  }

  isEncryptedValue(value: Buffer): boolean {
    if (!value || value.length < 4) return false
    const prefix = value.subarray(0, 3).toString('utf8')
    return prefix === 'v10' || prefix === 'v11'
  }

  isValidSessionId(sessionid: string): boolean {
    if (!sessionid || sessionid.length === 0) return false
    return sessionid.length >= 20
  }

  async extract(): Promise<ExtractedInstagramCookies[]> {
    const results: ExtractedInstagramCookies[] = []
    const seenUsers = new Set<string>()
    const cookiePaths = this.getBrowserCookiesPaths()

    for (const cookiePath of cookiePaths) {
      if (!existsSync(cookiePath)) continue

      this.debug(`Scanning: ${cookiePath}`)
      const cookies = await this.copyAndExtract(cookiePath)
      if (cookies && !seenUsers.has(cookies.ds_user_id)) {
        this.debug(`Found Instagram cookies in: ${cookiePath}`)
        seenUsers.add(cookies.ds_user_id)
        results.push(cookies)
      }
    }

    if (results.length === 0) {
      this.debug('No Instagram cookies found in any browser profile')
    }

    return results
  }

  private async copyAndExtract(dbPath: string): Promise<ExtractedInstagramCookies | null> {
    const tempPath = join(tmpdir(), `instagram-cookies-${Date.now()}`)

    try {
      this.copyDatabaseToTemp(dbPath, tempPath)
      const cookies = await this.extractFromSQLite(tempPath, dbPath)
      this.cleanupTempFile(tempPath)
      return cookies
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

  private async extractFromSQLite(
    dbPath: string,
    originalPath: string,
  ): Promise<ExtractedInstagramCookies | null> {
    try {
      const placeholders = INSTAGRAM_HOST_KEYS.map(() => '?').join(', ')
      const sql = `
        SELECT name, value, encrypted_value
        FROM cookies
        WHERE host_key IN (${placeholders})
      `

      type CookieRow = { name: string; value?: string; encrypted_value?: Uint8Array | Buffer }

      let rows: CookieRow[]
      if (typeof globalThis.Bun !== 'undefined') {
        const { Database } = require('bun:sqlite')
        const db = new Database(dbPath, { readonly: true })
        rows = db.query(sql).all(...INSTAGRAM_HOST_KEYS) as CookieRow[]
        db.close()
      } else {
        const Database = require('better-sqlite3')
        const db = new Database(dbPath, { readonly: true })
        rows = db.prepare(sql).all(...INSTAGRAM_HOST_KEYS) as CookieRow[]
        db.close()
      }

      const cookieMap: Record<string, string> = {}
      for (const row of rows) {
        if (!INSTAGRAM_COOKIE_NAMES.includes(row.name)) continue

        let value = ''
        if (row.encrypted_value && row.encrypted_value.length > 0) {
          const encBuf = Buffer.from(row.encrypted_value)
          if (this.isEncryptedValue(encBuf)) {
            const decrypted = this.decryptCookie(encBuf, originalPath)
            if (decrypted) {
              value = decrypted
            }
          } else {
            value = encBuf.toString('utf8')
          }
        } else if (row.value) {
          value = row.value
        }

        if (value && !cookieMap[row.name]) {
          cookieMap[row.name] = value
        }
      }

      if (!cookieMap['sessionid'] || !cookieMap['ds_user_id'] || !cookieMap['csrftoken']) {
        return null
      }

      if (!this.isValidSessionId(cookieMap['sessionid'])) {
        return null
      }

      const result: ExtractedInstagramCookies = {
        sessionid: cookieMap['sessionid'],
        ds_user_id: cookieMap['ds_user_id'],
        csrftoken: cookieMap['csrftoken'],
      }

      if (cookieMap['mid']) result.mid = cookieMap['mid']
      if (cookieMap['ig_did']) result.ig_did = cookieMap['ig_did']
      if (cookieMap['rur']) result.rur = cookieMap['rur']

      return result
    } catch {
      return null
    }
  }

  private decryptCookie(encryptedValue: Buffer, dbPath: string): string | null {
    if (!this.isEncryptedValue(encryptedValue)) {
      return encryptedValue.toString('utf8')
    }

    if (this.platform === 'win32') {
      return this.decryptWindowsCookie(encryptedValue, dbPath)
    } else if (this.platform === 'darwin') {
      return this.decryptMacCookie(encryptedValue)
    } else if (this.platform === 'linux') {
      return this.decryptLinuxCookie(encryptedValue)
    }

    return null
  }

  private decryptWindowsCookie(encryptedData: Buffer, dbPath: string): string | null {
    try {
      const localStatePath = this.findLocalStateForCookiePath(dbPath)
      if (!localStatePath || !existsSync(localStatePath)) return null

      const localState = JSON.parse(readFileSync(localStatePath, 'utf8'))
      const encryptedKey = Buffer.from(localState.os_crypt.encrypted_key, 'base64')
      const dpapiBlobKey = encryptedKey.subarray(5)
      const masterKey = this.decryptDPAPI(dpapiBlobKey)
      if (!masterKey) return null

      return this.decryptAESGCM(encryptedData, masterKey)
    } catch {
      return null
    }
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

    for (const variant of this.getKeychainVariants()) {
      const password = this.execSecurityCommand(variant.service, variant.account)
      if (!password) continue

      const key = pbkdf2Sync(password, 'saltysalt', 1003, 16, 'sha1')
      const decrypted = this.decryptAESCBC(encryptedData, key)
      if (decrypted) {
        this.cachedKey = key
        return decrypted
      }
    }

    return null
  }

  private decryptLinuxCookie(encryptedData: Buffer): string | null {
    const key = pbkdf2Sync('peanuts', 'saltysalt', 1, 16, 'sha1')
    return this.decryptAESCBC(encryptedData, key)
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

      return decrypted.toString('utf8')
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
}
