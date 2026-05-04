import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import {
  BROWSER_KEYCHAIN_VARIANTS,
  CHROMIUM_BROWSERS,
  ChromiumCookieDecryptor,
  ChromiumCookieReader,
  discoverBrowserProfileDirs,
  findLocalStatePath,
  getBrowserBasePath,
  getAgentBrowserProfileDirs,
} from '@/shared/chromium'
import type { KeychainVariant } from '@/shared/chromium'

export interface ExtractedInstagramCookies {
  sessionid: string
  ds_user_id: string
  csrftoken: string
  mid?: string
  ig_did?: string
  rur?: string
}

const INSTAGRAM_HOST_KEYS = ['.instagram.com', 'www.instagram.com', 'i.instagram.com']
const INSTAGRAM_COOKIE_NAMES = ['sessionid', 'ds_user_id', 'csrftoken', 'mid', 'ig_did', 'rur']

export class InstagramTokenExtractor {
  private platform: NodeJS.Platform
  private debugLog: ((message: string) => void) | null
  private decryptor: ChromiumCookieDecryptor
  private cookieReader: ChromiumCookieReader
  private customBrowserProfileDirs: string[]

  constructor(platform?: NodeJS.Platform, debugLog?: (message: string) => void, customBrowserProfileDirs?: string[]) {
    this.platform = platform ?? process.platform
    this.debugLog = debugLog ?? null
    this.customBrowserProfileDirs = customBrowserProfileDirs ?? []
    this.decryptor = new ChromiumCookieDecryptor({ platform: this.platform })
    this.cookieReader = new ChromiumCookieReader()
  }

  getBrowserCookiesPaths(): string[] {
    const paths: string[] = []

    for (const browser of CHROMIUM_BROWSERS) {
      const browserBase = getBrowserBasePath(browser, this.platform)
      if (!browserBase) continue

      const profileDirs = discoverBrowserProfileDirs(browserBase)
      for (const profileDir of profileDirs) {
        paths.push(join(profileDir, 'Cookies'))
        paths.push(join(profileDir, 'Network', 'Cookies'))
      }
    }

    for (const profileDir of getAgentBrowserProfileDirs({ customProfileDirs: this.customBrowserProfileDirs })) {
      paths.push(join(profileDir, 'Cookies'))
      paths.push(join(profileDir, 'Network', 'Cookies'))
    }

    return paths
  }

  getLocalStatePaths(): string[] {
    const paths: string[] = []

    for (const browser of CHROMIUM_BROWSERS) {
      const browserBase = getBrowserBasePath(browser, this.platform)
      if (!browserBase) continue

      paths.push(join(browserBase, 'Local State'))
    }

    for (const profileDir of getAgentBrowserProfileDirs({ customProfileDirs: this.customBrowserProfileDirs })) {
      paths.push(join(profileDir, 'Local State'))
    }

    return paths
  }

  getKeychainVariants(): KeychainVariant[] {
    return BROWSER_KEYCHAIN_VARIANTS
  }

  isEncryptedValue(value: Buffer): boolean {
    return this.decryptor.isEncryptedValue(value)
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

  private debug(message: string): void {
    this.debugLog?.(message)
  }

  private async copyAndExtract(dbPath: string): Promise<ExtractedInstagramCookies | null> {
    let tempPath = dbPath

    try {
      tempPath = this.copyDatabaseToTemp(dbPath, dbPath)
      return await this.extractFromSQLite(tempPath, dbPath)
    } catch {
      return null
    } finally {
      this.cleanupTempFile(tempPath)
    }
  }

  private copyDatabaseToTemp(sourcePath: string, _destPath: string): string {
    return sourcePath
  }

  private cleanupTempFile(_tempPath: string): void {}

  private async extractFromSQLite(dbPath: string, originalPath: string): Promise<ExtractedInstagramCookies | null> {
    try {
      const placeholders = INSTAGRAM_HOST_KEYS.map(() => '?').join(', ')
      const sql = `
        SELECT name, value, encrypted_value
        FROM cookies
        WHERE host_key IN (${placeholders})
      `

      type CookieRow = { name: string; value?: string; encrypted_value?: Uint8Array | Buffer }

      const rows = await this.cookieReader.queryAll<CookieRow>(dbPath, sql, INSTAGRAM_HOST_KEYS)
      const localStatePath = findLocalStatePath(originalPath) ?? undefined

      const cookieMap: Record<string, string> = {}
      for (const row of rows) {
        if (!INSTAGRAM_COOKIE_NAMES.includes(row.name)) continue

        let value = ''
        if (row.encrypted_value && row.encrypted_value.length > 0) {
          const encryptedValue = Buffer.from(row.encrypted_value)
          if (this.decryptor.isEncryptedValue(encryptedValue)) {
            const decryptedBuf = this.decryptor.decryptCookieRaw(encryptedValue, localStatePath)
            if (decryptedBuf) {
              value = ChromiumCookieDecryptor.stripIntegrityHash(decryptedBuf).toString('utf8')
            }
          } else {
            value = encryptedValue.toString('utf8')
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

  private decryptAESCBC(encryptedData: Buffer, key: Buffer): string | null {
    const buf = this.decryptor.decryptAESCBCRaw(encryptedData, key)
    if (!buf) return null
    return ChromiumCookieDecryptor.stripIntegrityHash(buf).toString('utf8')
  }

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
}
