import { execSync } from 'node:child_process'
import { createDecipheriv, pbkdf2Sync } from 'node:crypto'
import { copyFileSync, existsSync, readFileSync, readdirSync, unlinkSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

import type { ExtractedChannelToken } from './types'

type CookieRow = { name: string; value: string; encrypted_value: Uint8Array | Buffer }

interface BrowserConfig {
  name: string
  darwin: string
  linux: string
  win32: string
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

export class ChannelTokenExtractor {
  private platform: NodeJS.Platform
  private cachedKey: Buffer | null = null

  constructor(platform?: NodeJS.Platform) {
    this.platform = platform ?? process.platform
  }

  getAppDataDir(): string | null {
    switch (this.platform) {
      case 'darwin': {
        const sandboxedPath = join(
          homedir(),
          'Library',
          'Containers',
          'com.zoyi.channel.desk.osx',
          'Data',
          'Library',
          'Application Support',
          'Channel Talk',
        )
        if (existsSync(sandboxedPath)) {
          return sandboxedPath
        }
        const directPath = join(homedir(), 'Library', 'Application Support', 'Channel Talk')
        return existsSync(directPath) ? directPath : null
      }
      case 'win32': {
        const appdata = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming')
        const appDir = join(appdata, 'Channel Talk')
        return existsSync(appDir) ? appDir : null
      }
      default:
        return null
    }
  }

  getCookiesPath(): string | null {
    const appDir = this.getAppDataDir()
    if (!appDir) return null

    switch (this.platform) {
      case 'darwin':
        return existsSync(join(appDir, 'Cookies')) ? join(appDir, 'Cookies') : null
      case 'win32': {
        const networkPath = join(appDir, 'Network', 'Cookies')
        return existsSync(networkPath) ? networkPath : null
      }
      default:
        return null
    }
  }

  private getLocalStatePath(): string | null {
    const appDir = this.getAppDataDir()
    if (!appDir) return null
    const localStatePath = join(appDir, 'Local State')
    return existsSync(localStatePath) ? localStatePath : null
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

  async extract(): Promise<ExtractedChannelToken | null> {
    const desktopResult = await this.extractFromDesktopApp()
    if (desktopResult) return desktopResult

    return this.extractFromBrowsers()
  }

  private async extractFromDesktopApp(): Promise<ExtractedChannelToken | null> {
    const cookiesPath = this.getCookiesPath()
    if (!cookiesPath) {
      return null
    }

    const tempPath = join(tmpdir(), `channel-cookies-${Date.now()}`)

    try {
      copyFileSync(cookiesPath, tempPath)
      const rows = await this.queryCookieDB(tempPath)

      const accountCookie = this.getCookieValue(rows, 'x-account')
      const sessionCookie =
        this.getCookieValue(rows, 'ch-session-1') ??
        this.getCookieValue(rows, 'ch-session')

      return accountCookie ? { accountCookie, sessionCookie } : null
    } catch {
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

  private async extractFromBrowsers(): Promise<ExtractedChannelToken | null> {
    const cookiePaths = this.getBrowserCookiesPaths()

    for (const cookiePath of cookiePaths) {
      if (!existsSync(cookiePath)) continue

      const result = await this.extractFromBrowserCookiePath(cookiePath)
      if (result) return result
    }

    return null
  }

  private async extractFromBrowserCookiePath(cookiePath: string): Promise<ExtractedChannelToken | null> {
    const tempPath = join(tmpdir(), `channel-browser-cookies-${Date.now()}`)

    try {
      copyFileSync(cookiePath, tempPath)
      const rows = await this.queryCookieDB(tempPath)

      const accountCookie = this.getBrowserCookieValue(rows, 'x-account', cookiePath)
      const sessionCookie =
        this.getBrowserCookieValue(rows, 'ch-session-1', cookiePath) ??
        this.getBrowserCookieValue(rows, 'ch-session', cookiePath)

      return accountCookie ? { accountCookie, sessionCookie } : null
    } catch {
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

  private async queryCookieDB(dbPath: string): Promise<CookieRow[]> {
    const sql = `
      SELECT name, value, encrypted_value FROM cookies
      WHERE name IN ('x-account', 'ch-session-1', 'ch-session')
      AND host_key LIKE '%.channel.io%'
    `

    if (typeof globalThis.Bun !== 'undefined') {
      return await (async () => {
        const { Database } = await import('bun:sqlite')
        const db = new Database(dbPath, { readonly: true })
        const result = db.query(sql).all() as CookieRow[]
        db.close()
        return result
      })()
    }

    return await (async () => {
      const { createRequire } = await import('node:module')
      const req = createRequire(import.meta.url)
      const Database = req('better-sqlite3')
      const db = new Database(dbPath, { readonly: true })
      const result = db.prepare(sql).all() as CookieRow[]
      db.close()
      return result
    })()
  }

  private getCookieValue(rows: CookieRow[], name: string): string | undefined {
    const row = rows.find((r) => r.name === name)
    if (!row) return undefined

    if (row.value && row.value.length > 0) {
      return row.value
    }

    const encrypted = Buffer.from(row.encrypted_value)
    if (encrypted.length === 0) return undefined

    return this.decryptCookie(encrypted) ?? undefined
  }

  private getBrowserCookieValue(rows: CookieRow[], name: string, dbPath: string): string | undefined {
    const row = rows.find((r) => r.name === name)
    if (!row) return undefined

    if (row.value && row.value.length > 0) {
      return row.value
    }

    const encrypted = Buffer.from(row.encrypted_value)
    if (encrypted.length === 0) return undefined

    return this.decryptBrowserCookie(encrypted, dbPath) ?? undefined
  }

  private decryptCookie(encryptedValue: Buffer): string | null {
    if (!this.isEncryptedValue(encryptedValue)) {
      return encryptedValue.toString('utf8')
    }

    if (this.platform === 'win32') {
      return this.decryptWindowsCookie(encryptedValue)
    }

    return null
  }

  private decryptBrowserCookie(encryptedValue: Buffer, dbPath: string): string | null {
    if (!this.isEncryptedValue(encryptedValue)) {
      return encryptedValue.toString('utf8')
    }

    if (this.platform === 'win32') {
      const localStatePath = this.findLocalStateForCookiePath(dbPath)
      return this.decryptWindowsCookie(encryptedValue, localStatePath ?? undefined)
    } else if (this.platform === 'darwin') {
      return this.decryptMacCookie(encryptedValue)
    } else if (this.platform === 'linux') {
      return this.decryptLinuxCookie(encryptedValue)
    }

    return null
  }

  private isEncryptedValue(value: Buffer): boolean {
    if (!value || value.length < 4) return false
    const prefix = value.subarray(0, 3).toString('utf8')
    return prefix === 'v10' || prefix === 'v11'
  }

  private decryptWindowsCookie(encryptedData: Buffer, localStatePath?: string): string | null {
    try {
      const statePath = localStatePath ?? this.getLocalStatePath()
      if (!statePath) return null

      const localState = JSON.parse(readFileSync(statePath, 'utf8'))
      const encryptedKey = Buffer.from(localState.os_crypt.encrypted_key, 'base64')

      const dpapiBlobKey = encryptedKey.subarray(5)
      const masterKey = this.decryptDPAPI(dpapiBlobKey)
      if (!masterKey) return null

      return this.decryptAESGCM(encryptedData, masterKey)
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
    }
    return decrypted
  }

  private decryptLinuxCookie(encryptedData: Buffer): string | null {
    const key = pbkdf2Sync('peanuts', 'saltysalt', 1, 16, 'sha1')
    return this.decryptAESCBC(encryptedData, key)
  }

  private getKeychainPassword(): string | null {
    for (const variant of this.getKeychainVariants()) {
      try {
        const safeService = variant.service.replace(/"/g, '\\"')
        const safeAccount = variant.account.replace(/"/g, '\\"')
        const result = execSync(
          `security find-generic-password -s "${safeService}" -a "${safeAccount}" -w 2>/dev/null`,
          { encoding: 'utf8' },
        )
        const password = result.trim()
        if (password) return password
      } catch {}
    }
    return null
  }

  private decryptAESCBC(encryptedData: Buffer, key: Buffer): string | null {
    try {
      const ciphertext = encryptedData.subarray(3)
      const iv = Buffer.alloc(16, 0x20)

      const decipher = createDecipheriv('aes-128-cbc', key, iv)
      decipher.setAutoPadding(true)

      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])

      // Chromium v130+ integrity hash: 32-byte non-printable prefix
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

  decryptDPAPI(encryptedBlob: Buffer): Buffer | null {
    if (this.platform !== 'win32') return null
    try {
      const b64 = encryptedBlob.toString('base64')
      const psScript = [
        'Add-Type -AssemblyName System.Security',
        `$bytes = [Convert]::FromBase64String('${b64}')`,
        '$decrypted = [Security.Cryptography.ProtectedData]::Unprotect($bytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)',
        '[Convert]::ToBase64String($decrypted)',
      ].join('; ')

      const result = execSync(`powershell -NoProfile -NonInteractive -Command "${psScript}"`, {
        encoding: 'utf8',
        timeout: 10000,
      })
      return Buffer.from(result.trim(), 'base64')
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
