import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { createAccountId, type InstagramAccount, type InstagramAccountPaths, type InstagramConfig } from './types'

export class InstagramCredentialManager {
  private configDir: string
  private credentialsPath: string
  private instagramRootDir: string

  constructor(configDir?: string) {
    this.configDir = configDir ?? join(homedir(), '.config', 'agent-messenger')
    this.credentialsPath = join(this.configDir, 'instagram-credentials.json')
    this.instagramRootDir = join(this.configDir, 'instagram')
  }

  async loadConfig(): Promise<InstagramConfig> {
    if (!existsSync(this.credentialsPath)) {
      return { current: null, accounts: {} }
    }

    try {
      const content = await readFile(this.credentialsPath, 'utf-8')
      return JSON.parse(content) as InstagramConfig
    } catch {
      return { current: null, accounts: {} }
    }
  }

  async saveConfig(config: InstagramConfig): Promise<void> {
    await mkdir(this.configDir, { recursive: true })
    await writeFile(this.credentialsPath, JSON.stringify(config, null, 2), { mode: 0o600 })
  }

  async getAccount(accountId?: string): Promise<InstagramAccount | null> {
    const config = await this.loadConfig()

    if (!accountId) {
      return config.current ? (config.accounts[config.current] ?? null) : null
    }

    const direct = config.accounts[accountId]
    if (direct) {
      return direct
    }

    const normalized = createAccountId(accountId)
    return config.accounts[normalized] ?? null
  }

  async listAccounts(): Promise<Array<InstagramAccount & { is_current: boolean }>> {
    const config = await this.loadConfig()

    return Object.values(config.accounts).map((account) => ({
      ...account,
      is_current: account.account_id === config.current,
    }))
  }

  async setAccount(account: InstagramAccount): Promise<void> {
    const config = await this.loadConfig()
    config.accounts[account.account_id] = account

    if (!config.current) {
      config.current = account.account_id
    }

    await this.saveConfig(config)
  }

  async setCurrent(accountId: string): Promise<boolean> {
    const config = await this.loadConfig()
    const account = config.accounts[accountId] ?? config.accounts[createAccountId(accountId)]

    if (!account) {
      return false
    }

    config.current = account.account_id
    await this.saveConfig(config)
    return true
  }

  async removeAccount(accountId: string): Promise<boolean> {
    const config = await this.loadConfig()
    const account = config.accounts[accountId] ?? config.accounts[createAccountId(accountId)]

    if (!account) {
      return false
    }

    delete config.accounts[account.account_id]

    if (config.current === account.account_id) {
      config.current = Object.keys(config.accounts)[0] ?? null
    }

    await this.saveConfig(config)
    await rm(this.getAccountPaths(account.account_id).account_dir, { recursive: true, force: true })
    return true
  }

  async clearCredentials(): Promise<void> {
    if (existsSync(this.credentialsPath)) {
      await rm(this.credentialsPath, { force: true })
    }

    if (existsSync(this.instagramRootDir)) {
      await rm(this.instagramRootDir, { recursive: true, force: true })
    }
  }

  getAccountPaths(accountId: string): InstagramAccountPaths {
    const safeAccountId = createAccountId(accountId)
    const accountDir = join(this.instagramRootDir, safeAccountId)

    return {
      account_dir: accountDir,
      session_path: join(accountDir, 'session.json'),
    }
  }

  async ensureAccountPaths(accountId: string): Promise<InstagramAccountPaths> {
    const paths = this.getAccountPaths(accountId)
    await mkdir(paths.account_dir, { recursive: true })
    return paths
  }
}
