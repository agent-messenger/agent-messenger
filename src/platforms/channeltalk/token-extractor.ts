import { createDecipheriv } from 'node:crypto'
import { copyFileSync, existsSync, readFileSync, unlinkSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'

import type { ExtractedChannelToken } from './types'

type CookieRow = { name: string; value: string; encrypted_value: Uint8Array | Buffer }

export class ChannelTokenExtractor {
  private platform: NodeJS.Platform

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

  async extract(): Promise<ExtractedChannelToken | null> {
    const cookiesPath = this.getCookiesPath()
    if (!cookiesPath) {
      return null
    }

    const tempPath = join(tmpdir(), `channel-cookies-${Date.now()}`)

    try {
      copyFileSync(cookiesPath, tempPath)
      const sql = `
        SELECT name, value, encrypted_value FROM cookies
        WHERE name IN ('x-account', 'ch-session-1', 'ch-session')
        AND host_key LIKE '%.channel.io%'
      `
      const rows: CookieRow[] = typeof globalThis.Bun !== 'undefined'
        ? await (async () => {
            const { Database } = await import('bun:sqlite')
            const db = new Database(tempPath, { readonly: true })
            const result = db.query(sql).all() as CookieRow[]
            db.close()
            return result
          })()
        : await (async () => {
            const { createRequire } = await import('node:module')
            const req = createRequire(import.meta.url)
            const Database = req('better-sqlite3')
            const db = new Database(tempPath, { readonly: true })
            const result = db.prepare(sql).all() as CookieRow[]
            db.close()
            return result
          })()

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

  private decryptCookie(encryptedValue: Buffer): string | null {
    if (!this.isEncryptedValue(encryptedValue)) {
      return encryptedValue.toString('utf8')
    }

    if (this.platform === 'win32') {
      return this.decryptWindowsCookie(encryptedValue)
    }

    return null
  }

  private isEncryptedValue(value: Buffer): boolean {
    if (!value || value.length < 4) return false
    const prefix = value.subarray(0, 3).toString('utf8')
    return prefix === 'v10' || prefix === 'v11'
  }

  private decryptWindowsCookie(encryptedData: Buffer): string | null {
    try {
      const localStatePath = this.getLocalStatePath()
      if (!localStatePath) return null

      const localState = JSON.parse(readFileSync(localStatePath, 'utf8'))
      const encryptedKey = Buffer.from(localState.os_crypt.encrypted_key, 'base64')

      // Remove "DPAPI" prefix (5 bytes)
      const dpapiBlobKey = encryptedKey.subarray(5)
      const masterKey = this.decryptDPAPI(dpapiBlobKey)
      if (!masterKey) return null

      return this.decryptAESGCM(encryptedData, masterKey)
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
