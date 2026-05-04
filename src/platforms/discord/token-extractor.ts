import { execSync, spawn } from 'node:child_process'
import { pbkdf2Sync } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import {
  BROWSER_KEYCHAIN_VARIANTS,
  CHROMIUM_BROWSERS,
  ChromiumCookieDecryptor,
  discoverBrowserProfileDirs,
  getBrowserBasePath,
  getAgentBrowserProfileDirs,
} from '@/shared/chromium'
import type { KeychainVariant } from '@/shared/chromium'
import { DerivedKeyCache } from '@/shared/utils/derived-key-cache'
import { lookupLinuxKeyringPassword } from '@/shared/utils/linux-keyring'

export interface ExtractedDiscordToken {
  token: string
}

export type DiscordVariant = 'stable' | 'canary' | 'ptb'

interface CDPTarget {
  id: string
  type: string
  title: string
  url: string
  webSocketDebuggerUrl: string
}

interface CDPMessage {
  id: number
  method?: string
  params?: Record<string, unknown>
  result?: { result?: { value?: unknown } }
  error?: { code: number; message: string }
}

const TOKEN_REGEX = /[\w-]{24,}\.[\w-]{6}\.[\w-]{25,110}/
const MFA_TOKEN_REGEX = /mfa\.[\w-]{84}/
const ENCRYPTED_PREFIX = 'dQw4w9WgXcQ:'

export const CDP_PORT = 9222
export const CDP_TIMEOUT = 5000
export const DISCORD_STARTUP_WAIT = 4000
export const TOKEN_EXTRACTION_JS = `(webpackChunkdiscord_app.push([[''], {}, e => { m = []; for (let c in e.c) m.push(e.c[c]); }]), m).find(m => m?.exports?.default?.getToken !== void 0).exports.default.getToken()`

const DISCORD_PROCESS_NAMES: Record<DiscordVariant, { darwin: string; win32: string; linux: string }> = {
  stable: { darwin: 'Discord', win32: 'Discord.exe', linux: 'discord' },
  canary: { darwin: 'Discord Canary', win32: 'DiscordCanary.exe', linux: 'discordcanary' },
  ptb: { darwin: 'Discord PTB', win32: 'DiscordPTB.exe', linux: 'discordptb' },
}

const DISCORD_APP_PATHS: Record<DiscordVariant, { darwin: string }> = {
  stable: { darwin: '/Applications/Discord.app/Contents/MacOS/Discord' },
  canary: { darwin: '/Applications/Discord Canary.app/Contents/MacOS/Discord Canary' },
  ptb: { darwin: '/Applications/Discord PTB.app/Contents/MacOS/Discord PTB' },
}

const DISCORD_APP_KEYCHAIN_VARIANTS: KeychainVariant[] = [
  { service: 'discord Safe Storage', account: 'discord Key' },
  { service: 'discordcanary Safe Storage', account: 'discordcanary Key' },
  { service: 'discordptb Safe Storage', account: 'discordptb Key' },
  { service: 'Discord Safe Storage', account: 'Discord' },
  { service: 'Discord Canary Safe Storage', account: 'Discord Canary' },
  { service: 'Discord PTB Safe Storage', account: 'Discord PTB' },
]

export class DiscordTokenExtractor {
  private platform: NodeJS.Platform
  private startupWait: number
  private killWait: number
  private keyCache: DerivedKeyCache
  private cachedKey: Buffer | null = null
  private decryptor: ChromiumCookieDecryptor
  private customBrowserProfileDirs: string[]

  constructor(
    platform?: NodeJS.Platform,
    startupWait?: number,
    killWait?: number,
    keyCache?: DerivedKeyCache,
    customBrowserProfileDirs?: string[],
  ) {
    this.platform = platform ?? process.platform
    this.startupWait = startupWait ?? DISCORD_STARTUP_WAIT
    this.killWait = killWait ?? 1000
    this.keyCache = keyCache ?? new DerivedKeyCache()
    this.customBrowserProfileDirs = customBrowserProfileDirs ?? []
    this.decryptor = new ChromiumCookieDecryptor({
      platform: this.platform,
      appKeychainVariants: DISCORD_APP_KEYCHAIN_VARIANTS,
      keyCache: this.keyCache,
      keyCachePlatform: 'discord',
      linuxKeyringAppNames: ['discord', 'Discord'],
    })
  }

  getDiscordDirs(): string[] {
    switch (this.platform) {
      case 'darwin':
        return [
          join(homedir(), 'Library', 'Application Support', 'Discord'),
          join(homedir(), 'Library', 'Application Support', 'discordcanary'),
          join(homedir(), 'Library', 'Application Support', 'discordptb'),
        ]
      case 'linux':
        return [
          join(homedir(), '.config', 'discord'),
          join(homedir(), '.config', 'discordcanary'),
          join(homedir(), '.config', 'discordptb'),
        ]
      case 'win32': {
        const appdata = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming')
        return [join(appdata, 'Discord'), join(appdata, 'discordcanary'), join(appdata, 'discordptb')]
      }
      default:
        return []
    }
  }

  getBrowserLevelDBDirs(): string[] {
    const dirs: string[] = []

    for (const browser of CHROMIUM_BROWSERS) {
      const browserBase = getBrowserBasePath(browser, this.platform)
      if (!browserBase) continue

      const profileDirs = discoverBrowserProfileDirs(browserBase)
      for (const profileDir of profileDirs) {
        dirs.push(join(profileDir, 'Local Storage', 'leveldb'))
      }
    }

    for (const profileDir of getAgentBrowserProfileDirs({ customProfileDirs: this.customBrowserProfileDirs })) {
      dirs.push(join(profileDir, 'Local Storage', 'leveldb'))
    }

    return dirs
  }

  private findBrowserBaseDirForPath(path: string): string | null {
    const parts = path.split(/[/\\]/)
    for (let levels = 2; levels <= 5; levels++) {
      if (parts.length < levels) break
      const base = parts.slice(0, parts.length - levels).join('/')
      if (existsSync(join(base, 'Local State'))) return base
    }
    return null
  }

  getKeychainVariants(): KeychainVariant[] {
    return [...DISCORD_APP_KEYCHAIN_VARIANTS, ...BROWSER_KEYCHAIN_VARIANTS]
  }

  getVariantFromPath(path: string): DiscordVariant {
    const lowerPath = path.toLowerCase()
    if (lowerPath.includes('canary')) return 'canary'
    if (lowerPath.includes('ptb')) return 'ptb'
    return 'stable'
  }

  isValidToken(token: string): boolean {
    if (!token || token.length === 0) return false
    return TOKEN_REGEX.test(token) || MFA_TOKEN_REGEX.test(token)
  }

  isEncryptedToken(token: string): boolean {
    return token.startsWith(ENCRYPTED_PREFIX)
  }

  async extract(): Promise<ExtractedDiscordToken[]> {
    await this.loadCachedKey()

    const results: ExtractedDiscordToken[] = []
    const seenTokens = new Set<string>()

    if (this.customBrowserProfileDirs.length > 0) {
      for (const t of await this.extractFromBrowserLevelDB()) {
        if (!seenTokens.has(t.token)) {
          seenTokens.add(t.token)
          results.push(t)
        }
      }
    }

    for (const t of await this.extractFromLevelDB()) {
      if (!seenTokens.has(t.token)) {
        seenTokens.add(t.token)
        results.push(t)
      }
    }

    if (this.customBrowserProfileDirs.length === 0) {
      for (const t of await this.extractFromBrowserLevelDB()) {
        if (!seenTokens.has(t.token)) {
          seenTokens.add(t.token)
          results.push(t)
        }
      }
    }

    if (results.length === 0 && this.platform === 'darwin') {
      const cdpToken = await this.tryExtractViaCDP()
      if (cdpToken && !seenTokens.has(cdpToken)) {
        results.push({ token: cdpToken })
      }
    }

    return results
  }

  private async loadCachedKey(): Promise<void> {
    if (this.platform !== 'darwin') return

    await this.decryptor.loadCachedKey()

    const cached = await this.keyCache.get('discord')
    if (cached) {
      this.cachedKey = cached
    }
  }

  async clearKeyCache(): Promise<void> {
    await this.decryptor.clearKeyCache()
    this.cachedKey = null
  }

  private async tryExtractViaCDP(): Promise<string | null> {
    const token = await this.extractViaCDP()
    if (token) {
      return token
    }

    for (const variant of ['stable', 'canary', 'ptb'] as DiscordVariant[]) {
      try {
        const appPath = this.getAppPath(variant)
        if (!existsSync(appPath)) continue

        await this.launchDiscordWithDebug(variant)
        const extractedToken = await this.extractViaCDP()
        if (extractedToken) {
          return extractedToken
        }
      } catch {}
    }

    return null
  }

  private async extractFromLevelDB(): Promise<ExtractedDiscordToken[]> {
    const dirs = this.getDiscordDirs()
    const results: ExtractedDiscordToken[] = []
    const seenTokens = new Set<string>()

    for (const dir of dirs) {
      if (!existsSync(dir)) continue

      const token = await this.extractFromDir(dir)
      if (token && !seenTokens.has(token)) {
        seenTokens.add(token)
        results.push({ token })
      }
    }

    return results
  }

  private async extractFromBrowserLevelDB(): Promise<ExtractedDiscordToken[]> {
    const leveldbDirs = this.getBrowserLevelDBDirs()
    const results: ExtractedDiscordToken[] = []
    const seenTokens = new Set<string>()

    for (const leveldbDir of leveldbDirs) {
      if (!existsSync(leveldbDir)) continue

      // The browser base dir contains the Local State file needed for Windows decryption
      const browserBaseDir = this.findBrowserBaseDirForPath(leveldbDir)
      const tokens = this.extractTokensFromLDBFiles(leveldbDir, browserBaseDir ?? leveldbDir)

      for (const token of tokens) {
        if (!seenTokens.has(token)) {
          seenTokens.add(token)
          results.push({ token })
        }
      }
    }

    return results
  }

  private async extractFromDir(discordDir: string): Promise<string | null> {
    const levelDbPath = join(discordDir, 'Local Storage', 'leveldb')

    if (!existsSync(levelDbPath)) return null

    const tokens = this.extractTokensFromLDBFiles(levelDbPath, discordDir)
    return tokens.length > 0 ? tokens[0]! : null
  }

  private extractTokensFromLDBFiles(dbPath: string, discordDir: string): string[] {
    const tokens: string[] = []

    try {
      const files = readdirSync(dbPath).filter((f) => f.endsWith('.ldb') || f.endsWith('.log'))

      for (const file of files) {
        const filePath = join(dbPath, file)
        const content = readFileSync(filePath)
        const extracted = this.extractTokensFromBuffer(content, discordDir)
        tokens.push(...extracted)
      }
    } catch {
      return tokens
    }

    return [...new Set(tokens)]
  }

  private extractTokensFromBuffer(buffer: Buffer, discordDir: string): string[] {
    const tokens: string[] = []
    const content = buffer.toString('utf8')

    const encryptedMatches = content.match(new RegExp(`${ENCRYPTED_PREFIX}[A-Za-z0-9+/=]+`, 'g'))
    if (encryptedMatches) {
      for (const match of encryptedMatches) {
        try {
          const decrypted = this.decryptToken(match, discordDir)
          if (decrypted && this.isValidToken(decrypted)) {
            tokens.push(decrypted)
          }
        } catch {}
      }
    }

    const standardMatches = content.match(TOKEN_REGEX)
    if (standardMatches) {
      for (const match of standardMatches) {
        if (this.isValidToken(match)) {
          tokens.push(match)
        }
      }
    }

    const mfaMatches = content.match(MFA_TOKEN_REGEX)
    if (mfaMatches) {
      for (const match of mfaMatches) {
        tokens.push(match)
      }
    }

    return tokens
  }

  private decryptToken(encryptedToken: string, discordDir: string): string | null {
    if (!encryptedToken.startsWith(ENCRYPTED_PREFIX)) return null

    const encryptedData = Buffer.from(encryptedToken.substring(ENCRYPTED_PREFIX.length), 'base64')

    if (this.platform === 'win32') {
      return this.decryptWindowsToken(encryptedData, discordDir)
    } else if (this.platform === 'darwin') {
      return this.decryptMacToken(encryptedData, discordDir)
    } else if (this.platform === 'linux') {
      return this.decryptLinuxToken(encryptedData)
    }

    return null
  }

  private decryptWindowsToken(encryptedData: Buffer, discordDir: string): string | null {
    try {
      const localStatePath = join(discordDir, 'Local State')
      if (!existsSync(localStatePath)) return null

      const localState = JSON.parse(readFileSync(localStatePath, 'utf8'))
      const encryptedKey = Buffer.from(localState.os_crypt.encrypted_key, 'base64')

      const dpapiBlobKey = encryptedKey.subarray(5)
      const masterKey = this.decryptor.decryptDPAPI(dpapiBlobKey)
      if (!masterKey) return null

      return this.decryptor.decryptAESGCM(encryptedData, masterKey)
    } catch {
      return null
    }
  }

  private decryptMacToken(encryptedData: Buffer, discordDir: string): string | null {
    if (this.cachedKey) {
      const decrypted = this.decryptor.decryptAESCBC(encryptedData, this.cachedKey)
      if (decrypted && this.isValidToken(decrypted)) return decrypted
    }

    const variant = this.getVariantFromPath(discordDir)
    // Try Discord-specific variants first, then fall back to all browser variants
    const discordVariants = this.getKeychainVariants().filter((v) => {
      const lowerAccount = v.account.toLowerCase()
      if (variant === 'stable') return lowerAccount === 'discord' || lowerAccount === 'discord key'
      if (variant === 'canary') return lowerAccount === 'discord canary' || lowerAccount === 'discordcanary key'
      if (variant === 'ptb') return lowerAccount === 'discord ptb' || lowerAccount === 'discordptb key'
      return false
    })

    const browserVariants = this.getKeychainVariants().filter((v) => {
      const lowerService = v.service.toLowerCase()
      return !lowerService.includes('discord')
    })

    for (const keychainVariant of [...discordVariants, ...browserVariants]) {
      try {
        const password = execSync(
          `security find-generic-password -s "${keychainVariant.service}" -a "${keychainVariant.account}" -w 2>/dev/null`,
          { encoding: 'utf8' },
        ).trim()

        const key = pbkdf2Sync(password, 'saltysalt', 1003, 16, 'sha1')
        const decrypted = this.decryptor.decryptAESCBC(encryptedData, key)
        if (decrypted && this.isValidToken(decrypted)) {
          this.cachedKey = key
          this.keyCache.set('discord', key).catch(() => {})
          return decrypted
        }
      } catch {}
    }

    return null
  }

  private decryptLinuxToken(encryptedData: Buffer): string | null {
    const prefix = encryptedData.subarray(0, 3).toString()

    if (prefix === 'v11') {
      for (const appName of ['discord', 'Discord']) {
        try {
          const keyringPassword = this.getLinuxKeyringPassword(appName)
          const key = pbkdf2Sync(keyringPassword, 'saltysalt', 1, 16, 'sha1')
          const decrypted = this.decryptor.decryptAESCBC(encryptedData, key)
          if (decrypted) return decrypted
        } catch {}
      }
    }

    const key = pbkdf2Sync('peanuts', 'saltysalt', 1, 16, 'sha1')
    return this.decryptor.decryptAESCBC(encryptedData, key)
  }

  private getLinuxKeyringPassword(appName: string): string {
    return lookupLinuxKeyringPassword(appName)
  }

  async isDiscordRunning(variant?: DiscordVariant): Promise<boolean> {
    const variants = variant ? [variant] : (['stable', 'canary', 'ptb'] as DiscordVariant[])

    for (const v of variants) {
      const processName = this.getProcessName(v)
      if (this.checkProcessRunning(processName)) {
        return true
      }
    }
    return false
  }

  private getProcessName(variant: DiscordVariant): string {
    const platformKey = this.platform as 'darwin' | 'win32' | 'linux'
    return DISCORD_PROCESS_NAMES[variant][platformKey] || DISCORD_PROCESS_NAMES[variant].linux
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

  async killDiscord(variant?: DiscordVariant): Promise<void> {
    const variants = variant ? [variant] : (['stable', 'canary', 'ptb'] as DiscordVariant[])

    for (const v of variants) {
      const processName = this.getProcessName(v)
      this.killProcess(processName)
    }

    await new Promise((resolve) => setTimeout(resolve, this.killWait))
  }

  private killProcess(processName: string): void {
    try {
      if (this.platform === 'win32') {
        execSync(`taskkill /F /IM "${processName}" 2>nul`, { encoding: 'utf8' })
      } else {
        execSync(`pkill -f "${processName}" 2>/dev/null || true`, { encoding: 'utf8' })
      }
    } catch {}
  }

  async launchDiscordWithDebug(variant: DiscordVariant, port: number = CDP_PORT): Promise<void> {
    const appPath = this.getAppPath(variant)

    if (!existsSync(appPath)) {
      throw new Error(`Discord ${variant} not found at ${appPath}`)
    }

    await this.killDiscord(variant)

    const args = [`--remote-debugging-port=${port}`]

    if (this.platform === 'darwin') {
      spawn(appPath, args, {
        detached: true,
        stdio: 'ignore',
      }).unref()
    } else if (this.platform === 'win32') {
      spawn(appPath, args, {
        detached: true,
        stdio: 'ignore',
        shell: true,
      }).unref()
    } else {
      spawn(appPath, args, {
        detached: true,
        stdio: 'ignore',
      }).unref()
    }

    await new Promise((resolve) => setTimeout(resolve, this.startupWait))
  }

  private getAppPath(variant: DiscordVariant): string {
    if (this.platform === 'darwin') {
      return DISCORD_APP_PATHS[variant].darwin
    } else if (this.platform === 'win32') {
      const localAppData = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local')
      const appName = variant === 'stable' ? 'Discord' : variant === 'canary' ? 'DiscordCanary' : 'DiscordPTB'
      return join(localAppData, appName, 'Update.exe')
    } else {
      return variant === 'stable' ? 'discord' : `discord${variant}`
    }
  }

  async discoverCDPTargets(port: number = CDP_PORT): Promise<CDPTarget[]> {
    try {
      const response = await fetch(`http://localhost:${port}/json`, {
        signal: AbortSignal.timeout(CDP_TIMEOUT),
      })
      if (!response.ok) {
        return []
      }
      return (await response.json()) as CDPTarget[]
    } catch {
      return []
    }
  }

  findDiscordPageTarget(targets: CDPTarget[]): CDPTarget | null {
    const discordTarget = targets.find(
      (t) => t.type === 'page' && (t.url.includes('discord.com') || t.title.toLowerCase().includes('discord')),
    )
    return discordTarget ?? null
  }

  async executeJSViaCDP(webSocketUrl: string, expression: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(webSocketUrl)
      const messageId = 1
      let timeoutId: ReturnType<typeof setTimeout>

      const cleanup = () => {
        clearTimeout(timeoutId)
        ws.close()
      }

      timeoutId = setTimeout(() => {
        cleanup()
        reject(new Error('CDP execution timeout'))
      }, CDP_TIMEOUT)

      ws.onopen = () => {
        const message: CDPMessage = {
          id: messageId,
          method: 'Runtime.evaluate',
          params: {
            expression,
            returnByValue: true,
          },
        }
        ws.send(JSON.stringify(message))
      }

      ws.onmessage = (event) => {
        try {
          const response = JSON.parse(event.data as string) as CDPMessage
          if (response.id === messageId) {
            cleanup()
            if (response.error) {
              reject(new Error(response.error.message))
            } else {
              resolve(response.result?.result?.value)
            }
          }
        } catch (e) {
          cleanup()
          reject(e)
        }
      }

      ws.onerror = (error) => {
        cleanup()
        reject(error)
      }
    })
  }

  async extractViaCDP(port: number = CDP_PORT): Promise<string | null> {
    const targets = await this.discoverCDPTargets(port)
    if (targets.length === 0) {
      return null
    }

    const discordTarget = this.findDiscordPageTarget(targets)
    if (!discordTarget) {
      return null
    }

    try {
      const result = await this.executeJSViaCDP(discordTarget.webSocketDebuggerUrl, TOKEN_EXTRACTION_JS)
      if (typeof result === 'string' && this.isValidToken(result)) {
        return result
      }
      return null
    } catch {
      return null
    }
  }
}
