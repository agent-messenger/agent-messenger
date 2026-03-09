import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

import type { TeamsAccount, TeamsAccountType, TeamsConfig, TeamsConfigLegacy } from './types'

export class TeamsCredentialManager {
  static accountOverride?: TeamsAccountType

  private configDir: string
  private credentialsPath: string

  constructor(configDir?: string) {
    this.configDir = configDir ?? join(homedir(), '.config', 'agent-messenger')
    this.credentialsPath = join(this.configDir, 'teams-credentials.json')
  }

  async loadConfig(): Promise<TeamsConfig | null> {
    if (!existsSync(this.credentialsPath)) {
      return null
    }

    try {
      const content = await readFile(this.credentialsPath, 'utf-8')
      const raw = JSON.parse(content)
      return this.migrateIfNeeded(raw)
    } catch {
      return null
    }
  }

  async saveConfig(config: TeamsConfig): Promise<void> {
    await mkdir(this.configDir, { recursive: true })
    await writeFile(this.credentialsPath, JSON.stringify(config, null, 2), { mode: 0o600 })
  }

  private migrateIfNeeded(raw: TeamsConfig | TeamsConfigLegacy): TeamsConfig {
    if ('accounts' in raw && raw.accounts) {
      return raw as TeamsConfig
    }

    const legacy = raw as TeamsConfigLegacy
    const account: TeamsAccount = {
      token: legacy.token,
      token_expires_at: legacy.token_expires_at,
      account_type: 'work',
      current_team: legacy.current_team,
      teams: legacy.teams,
    }
    return {
      current_account: 'work',
      accounts: { work: account },
    }
  }

  private resolveAccountKey(config: TeamsConfig): string | null {
    return TeamsCredentialManager.accountOverride ?? config.current_account
  }

  async getCurrentAccount(): Promise<TeamsAccount | null> {
    const config = await this.loadConfig()
    if (!config) return null
    const key = this.resolveAccountKey(config)
    if (!key) return null
    return config.accounts[key] ?? null
  }

  private resolveCurrentAccount(config: TeamsConfig): TeamsAccount | null {
    const key = this.resolveAccountKey(config)
    if (!key) return null
    return config.accounts[key] ?? null
  }

  async getToken(): Promise<string | null> {
    const config = await this.loadConfig()
    if (!config) return null
    return this.resolveCurrentAccount(config)?.token ?? null
  }

  async getTokenWithExpiry(): Promise<{ token: string; tokenExpiresAt?: string } | null> {
    const config = await this.loadConfig()
    if (!config) return null
    const account = this.resolveCurrentAccount(config)
    if (!account?.token) return null
    return { token: account.token, tokenExpiresAt: account.token_expires_at }
  }

  async setToken(token: string, accountType: TeamsAccountType, expiresAt?: string): Promise<void> {
    let config = await this.loadConfig()
    if (!config) {
      config = { current_account: accountType, accounts: {} }
    }
    const existing = config.accounts[accountType]
    config.accounts[accountType] = {
      token,
      token_expires_at: expiresAt,
      account_type: accountType,
      user_name: existing?.user_name,
      current_team: existing?.current_team ?? null,
      teams: existing?.teams ?? {},
    }
    if (!config.current_account) {
      config.current_account = accountType
    }
    await this.saveConfig(config)
  }

  async getCurrentTeam(): Promise<{ team_id: string; team_name: string } | null> {
    const config = await this.loadConfig()
    if (!config) return null
    const account = this.resolveCurrentAccount(config)
    if (!account?.current_team) return null
    return account.teams[account.current_team] ?? null
  }

  async setCurrentTeam(teamId: string, teamName: string): Promise<void> {
    const config = await this.loadConfig()
    if (!config) return
    const account = this.resolveCurrentAccount(config)
    if (!account) return
    account.current_team = teamId
    account.teams[teamId] = { team_id: teamId, team_name: teamName }
    await this.saveConfig(config)
  }

  async getCurrentAccountType(): Promise<TeamsAccountType | null> {
    const config = await this.loadConfig()
    if (!config) return null
    const key = this.resolveAccountKey(config)
    return (key as TeamsAccountType) ?? null
  }

  async setCurrentAccount(accountType: TeamsAccountType): Promise<void> {
    const config = await this.loadConfig()
    if (!config) return
    if (!config.accounts[accountType]) return
    config.current_account = accountType
    await this.saveConfig(config)
  }

  async getAccounts(): Promise<Record<string, TeamsAccount>> {
    const config = await this.loadConfig()
    return config?.accounts ?? {}
  }

  async clearCredentials(): Promise<void> {
    if (existsSync(this.credentialsPath)) {
      await rm(this.credentialsPath)
    }
  }

  async isTokenExpired(): Promise<boolean> {
    const config = await this.loadConfig()
    if (!config) return true
    const account = this.resolveCurrentAccount(config)
    if (!account?.token_expires_at) return true
    return new Date(account.token_expires_at).getTime() <= Date.now()
  }

  async isAccountTokenExpired(accountType: TeamsAccountType): Promise<boolean> {
    const config = await this.loadConfig()
    if (!config) return true
    const account = config.accounts[accountType]
    if (!account?.token_expires_at) return true
    return new Date(account.token_expires_at).getTime() <= Date.now()
  }
}
