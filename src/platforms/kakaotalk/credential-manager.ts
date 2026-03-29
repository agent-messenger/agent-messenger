import { existsSync } from 'node:fs'
import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

import type { KakaoAccountCredentials, KakaoConfig, KakaoDeviceType } from './types'

export interface PendingLoginState {
  device_uuid: string
  device_type: KakaoDeviceType
  email: string
  created_at: string
}

export class KakaoCredentialManager {
  private configDir: string
  private credentialsPath: string
  private pendingLoginPath: string

  constructor(configDir?: string) {
    this.configDir = configDir ?? join(homedir(), '.config', 'agent-messenger')
    this.credentialsPath = join(this.configDir, 'kakaotalk-credentials.json')
    this.pendingLoginPath = join(this.configDir, 'kakaotalk-pending-login.json')
  }

  async load(): Promise<KakaoConfig> {
    if (!existsSync(this.credentialsPath)) {
      return { current_account: null, accounts: {} }
    }

    const content = await readFile(this.credentialsPath, 'utf-8')
    return JSON.parse(content) as KakaoConfig
  }

  async save(config: KakaoConfig): Promise<void> {
    await mkdir(this.configDir, { recursive: true })
    await writeFile(this.credentialsPath, JSON.stringify(config, null, 2))
    await chmod(this.credentialsPath, 0o600)
  }

  async getAccount(id?: string): Promise<KakaoAccountCredentials | null> {
    const config = await this.load()

    if (id) {
      return config.accounts[id] ?? null
    }

    if (!config.current_account) {
      return null
    }

    return config.accounts[config.current_account] ?? null
  }

  async setAccount(account: KakaoAccountCredentials): Promise<void> {
    const config = await this.load()
    config.accounts[account.account_id] = account

    if (!config.current_account) {
      config.current_account = account.account_id
    }

    await this.save(config)
  }

  async removeAccount(id: string): Promise<void> {
    const config = await this.load()
    delete config.accounts[id]

    if (config.current_account === id) {
      config.current_account = Object.keys(config.accounts)[0] ?? null
    }

    await this.save(config)
  }

  async listAccounts(): Promise<Array<KakaoAccountCredentials & { is_current: boolean }>> {
    const config = await this.load()
    return Object.values(config.accounts).map((account) => ({
      ...account,
      is_current: account.account_id === config.current_account,
    }))
  }

  async setCurrentAccount(id: string): Promise<void> {
    const config = await this.load()
    config.current_account = id
    await this.save(config)
  }

  async savePendingLogin(state: PendingLoginState): Promise<void> {
    await mkdir(this.configDir, { recursive: true })
    await writeFile(this.pendingLoginPath, JSON.stringify(state, null, 2))
    await chmod(this.pendingLoginPath, 0o600)
  }

  async loadPendingLogin(): Promise<PendingLoginState | null> {
    if (!existsSync(this.pendingLoginPath)) return null
    const content = await readFile(this.pendingLoginPath, 'utf-8')
    return JSON.parse(content) as PendingLoginState
  }

  async clearPendingLogin(): Promise<void> {
    if (existsSync(this.pendingLoginPath)) {
      await rm(this.pendingLoginPath, { force: true })
    }
  }
}

export { KakaoCredentialManager as CredentialManager }
