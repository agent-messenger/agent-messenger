import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

export type Platform = 'slack' | 'discord' | 'teams' | 'webex'

/**
 * Caches derived encryption keys to avoid repeated macOS Keychain prompts.
 *
 * The derived key (PBKDF2 output) is stored, NOT the keychain password.
 * This is safe because:
 * 1. The derived key can only decrypt app-specific local storage
 * 2. It's stored with 600 permissions (owner read/write only)
 * 3. If the app updates its encryption, cached key becomes invalid and we re-prompt once
 */
export class DerivedKeyCache {
  private cacheDir: string

  constructor(cacheDir?: string) {
    this.cacheDir = cacheDir ?? join(homedir(), '.config', 'agent-messenger', '.derived-keys')
  }

  private getKeyPath(platform: Platform): string {
    return join(this.cacheDir, `${platform}.key`)
  }

  async get(platform: Platform): Promise<Buffer | null> {
    const keyPath = this.getKeyPath(platform)

    if (!existsSync(keyPath)) {
      return null
    }

    try {
      const content = await readFile(keyPath)
      return content
    } catch {
      return null
    }
  }

  async set(platform: Platform, key: Buffer): Promise<void> {
    await mkdir(this.cacheDir, { recursive: true, mode: 0o700 })

    const keyPath = this.getKeyPath(platform)
    await writeFile(keyPath, key, { mode: 0o600 })
  }

  async clear(platform: Platform): Promise<void> {
    const keyPath = this.getKeyPath(platform)

    if (existsSync(keyPath)) {
      await rm(keyPath)
    }
  }

  async clearAll(): Promise<void> {
    if (existsSync(this.cacheDir)) {
      await rm(this.cacheDir, { recursive: true })
    }
  }
}
