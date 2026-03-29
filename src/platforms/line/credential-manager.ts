import { existsSync } from 'node:fs'
import { mkdir, rm, writeFile, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

import type { LineAccountCredentials, LineConfig } from './types'

export class LineCredentialManager {
  private configDir: string
  private credentialsPath: string

  constructor(configDir?: string) {
    this.configDir = configDir ?? join(homedir(), '.config', 'agent-messenger')
    this.credentialsPath = join(this.configDir, 'line-credentials.json')
  }

  async load(): Promise<LineConfig> {
    if (!existsSync(this.credentialsPath)) {
      return { current_account: null, accounts: {} }
    }

    const content = await readFile(this.credentialsPath, 'utf-8')
    return JSON.parse(content) as LineConfig
  }

  async save(config: LineConfig): Promise<void> {
    await mkdir(this.configDir, { recursive: true })
    await writeFile(this.credentialsPath, JSON.stringify(config, null, 2), { mode: 0o600 })
  }

  async getAccount(accountId?: string): Promise<LineAccountCredentials | null> {
    const config = await this.load()

    if (accountId) {
      return config.accounts[accountId] ?? null
    }

    if (!config.current_account) {
      return null
    }

    return config.accounts[config.current_account] ?? null
  }

  async setAccount(credentials: LineAccountCredentials): Promise<void> {
    const config = await this.load()
    config.accounts[credentials.account_id] = credentials

    if (!config.current_account) {
      config.current_account = credentials.account_id
    }

    await this.save(config)
  }

  async removeAccount(accountId: string): Promise<void> {
    const config = await this.load()
    delete config.accounts[accountId]

    if (config.current_account === accountId) {
      config.current_account = Object.keys(config.accounts)[0] ?? null
    }

    await this.save(config)
  }

  async setCurrentAccount(accountId: string): Promise<void> {
    const config = await this.load()
    config.current_account = accountId
    await this.save(config)
  }

  async listAccounts(): Promise<
    Array<{
      account_id: string
      display_name?: string
      device: string
      is_current: boolean
      created_at: string
    }>
  > {
    const config = await this.load()
    return Object.values(config.accounts).map((account) => ({
      account_id: account.account_id,
      display_name: account.display_name,
      device: account.device,
      is_current: config.current_account === account.account_id,
      created_at: account.created_at,
    }))
  }

  async clearAll(): Promise<void> {
    if (existsSync(this.credentialsPath)) {
      await rm(this.credentialsPath, { force: true })
    }
  }
}

export { LineCredentialManager as CredentialManager }
