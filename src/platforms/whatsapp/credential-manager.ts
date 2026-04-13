import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { createAccountId, type WhatsAppAccount, type WhatsAppAccountPaths, type WhatsAppConfig } from './types'

export class WhatsAppCredentialManager {
  private configDir: string
  private credentialsPath: string
  private baileysRootDir: string

  constructor(configDir?: string) {
    this.configDir = configDir ?? join(homedir(), '.config', 'agent-messenger')
    this.credentialsPath = join(this.configDir, 'whatsapp-credentials.json')
    this.baileysRootDir = join(this.configDir, 'whatsapp')
  }

  async loadConfig(): Promise<WhatsAppConfig> {
    if (!existsSync(this.credentialsPath)) {
      return { current: null, accounts: {} }
    }

    try {
      const content = await readFile(this.credentialsPath, 'utf-8')
      return JSON.parse(content) as WhatsAppConfig
    } catch {
      return { current: null, accounts: {} }
    }
  }

  async saveConfig(config: WhatsAppConfig): Promise<void> {
    await mkdir(this.configDir, { recursive: true })
    await writeFile(this.credentialsPath, JSON.stringify(config, null, 2), { mode: 0o600 })
  }

  async getAccount(accountId?: string): Promise<WhatsAppAccount | null> {
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

  async listAccounts(): Promise<Array<WhatsAppAccount & { is_current: boolean }>> {
    const config = await this.loadConfig()

    return Object.values(config.accounts).map((account) => ({
      ...account,
      is_current: account.account_id === config.current,
    }))
  }

  async setAccount(account: WhatsAppAccount): Promise<void> {
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

    let removedFromConfig = false

    if (account) {
      delete config.accounts[account.account_id]

      if (config.current === account.account_id) {
        config.current = Object.keys(config.accounts)[0] ?? null
      }

      await this.saveConfig(config)
      removedFromConfig = true
    }

    const resolvedId = account?.account_id ?? createAccountId(accountId)
    const accountDir = this.getAccountPaths(resolvedId).account_dir
    const dirExisted = existsSync(accountDir)

    if (dirExisted) {
      await rm(accountDir, { recursive: true, force: true })
    }

    return removedFromConfig || dirExisted
  }

  async clearCredentials(): Promise<void> {
    if (existsSync(this.credentialsPath)) {
      await rm(this.credentialsPath, { force: true })
    }

    if (existsSync(this.baileysRootDir)) {
      await rm(this.baileysRootDir, { recursive: true, force: true })
    }
  }

  getAccountPaths(accountId: string): WhatsAppAccountPaths {
    const safeAccountId = createAccountId(accountId)
    const accountDir = join(this.baileysRootDir, safeAccountId)

    return {
      account_dir: accountDir,
      auth_dir: join(accountDir, 'auth'),
    }
  }

  async ensureAccountPaths(accountId: string): Promise<WhatsAppAccountPaths> {
    const paths = this.getAccountPaths(accountId)
    await mkdir(paths.auth_dir, { recursive: true })
    return paths
  }
}
