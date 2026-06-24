import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { getConfigDir } from '../../shared/utils/config-dir'
import { createAccountId, type IMessageAccount, type IMessageConfig } from './types'

export interface ResolvedCredentials {
  server_url: string
  password: string
}

export interface CredentialOverrides {
  serverUrl?: string
  password?: string
}

export class IMessageCredentialManager {
  private configDir: string
  private credentialsPath: string

  constructor(configDir?: string) {
    this.configDir = configDir ?? getConfigDir()
    this.credentialsPath = join(this.configDir, 'imessage-credentials.json')
  }

  async loadConfig(): Promise<IMessageConfig> {
    if (!existsSync(this.credentialsPath)) {
      return { current: null, accounts: {} }
    }

    try {
      const content = await readFile(this.credentialsPath, 'utf-8')
      return JSON.parse(content) as IMessageConfig
    } catch {
      return { current: null, accounts: {} }
    }
  }

  async saveConfig(config: IMessageConfig): Promise<void> {
    await mkdir(this.configDir, { recursive: true })
    await writeFile(this.credentialsPath, JSON.stringify(config, null, 2), { mode: 0o600 })
  }

  async getAccount(accountId?: string): Promise<IMessageAccount | null> {
    const config = await this.loadConfig()

    if (!accountId) {
      return config.current ? (config.accounts[config.current] ?? null) : null
    }

    const direct = config.accounts[accountId]
    if (direct) return direct

    return config.accounts[createAccountId(accountId)] ?? null
  }

  async listAccounts(): Promise<Array<IMessageAccount & { is_current: boolean }>> {
    const config = await this.loadConfig()

    return Object.values(config.accounts).map((account) => ({
      ...account,
      is_current: account.account_id === config.current,
    }))
  }

  async setAccount(account: IMessageAccount): Promise<void> {
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

    if (!account) return false

    config.current = account.account_id
    await this.saveConfig(config)
    return true
  }

  async removeAccount(accountId: string): Promise<boolean> {
    const config = await this.loadConfig()
    const account = config.accounts[accountId] ?? config.accounts[createAccountId(accountId)]

    if (!account) return false

    delete config.accounts[account.account_id]

    if (config.current === account.account_id) {
      config.current = Object.keys(config.accounts)[0] ?? null
    }

    await this.saveConfig(config)
    return true
  }

  async clearCredentials(): Promise<void> {
    if (existsSync(this.credentialsPath)) {
      await rm(this.credentialsPath, { force: true })
    }
  }

  async resolveCredentials(accountId?: string, overrides?: CredentialOverrides): Promise<ResolvedCredentials | null> {
    const envUrl = process.env.AGENT_IMESSAGE_URL ?? process.env.BLUEBUBBLES_URL
    const envPassword = process.env.AGENT_IMESSAGE_PASSWORD ?? process.env.BLUEBUBBLES_PASSWORD

    const serverUrl = overrides?.serverUrl ?? envUrl
    const password = overrides?.password ?? envPassword

    if (serverUrl && password) {
      return { server_url: serverUrl, password }
    }

    const account = await this.getAccount(accountId)
    if (!account) return null

    return {
      server_url: serverUrl ?? account.server_url,
      password: password ?? account.password,
    }
  }
}
