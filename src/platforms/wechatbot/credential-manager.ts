import { existsSync } from 'node:fs'
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

import type { WeChatBotAccountEntry, WeChatBotConfig, WeChatBotCredentials } from './types'
import { WeChatBotConfigSchema } from './types'

export class WeChatBotCredentialManager {
  private configDir: string
  private credentialsPath: string

  constructor(configDir?: string) {
    this.configDir = configDir ?? join(homedir(), '.config', 'agent-messenger')
    this.credentialsPath = join(this.configDir, 'wechatbot-credentials.json')
  }

  async load(): Promise<WeChatBotConfig> {
    if (!existsSync(this.credentialsPath)) {
      return { current: null, accounts: {} }
    }

    const content = await readFile(this.credentialsPath, 'utf-8')
    let json: unknown
    try {
      json = JSON.parse(content)
    } catch {
      return { current: null, accounts: {} }
    }
    const parsed = WeChatBotConfigSchema.safeParse(json)
    if (!parsed.success) {
      return { current: null, accounts: {} }
    }
    return parsed.data
  }

  async save(config: WeChatBotConfig): Promise<void> {
    await mkdir(this.configDir, { recursive: true })
    await writeFile(this.credentialsPath, JSON.stringify(config, null, 2), { mode: 0o600 })
    await chmod(this.credentialsPath, 0o600)
  }

  async getCredentials(accountId?: string): Promise<WeChatBotCredentials | null> {
    const envAppId = process.env.E2E_WECHATBOT_APP_ID
    const envAppSecret = process.env.E2E_WECHATBOT_APP_SECRET

    if (envAppId && envAppSecret && !accountId) {
      return {
        app_id: envAppId,
        app_secret: envAppSecret,
        account_name: 'env',
      }
    }

    const config = await this.load()

    if (accountId) {
      const account = config.accounts[accountId]
      if (!account) return null
      return {
        app_id: account.app_id,
        app_secret: account.app_secret,
        account_name: account.account_name,
      }
    }

    if (!config.current) {
      return null
    }

    const account = config.accounts[config.current.account_id]
    if (!account) return null

    return {
      app_id: account.app_id,
      app_secret: account.app_secret,
      account_name: account.account_name,
    }
  }

  async setCredentials(entry: WeChatBotAccountEntry): Promise<void> {
    const config = await this.load()

    config.accounts[entry.app_id] = {
      app_id: entry.app_id,
      app_secret: entry.app_secret,
      account_name: entry.account_name,
    }

    config.current = {
      account_id: entry.app_id,
    }

    await this.save(config)
  }

  async removeAccount(accountId: string): Promise<boolean> {
    const config = await this.load()

    if (!config.accounts[accountId]) {
      return false
    }

    delete config.accounts[accountId]

    if (config.current?.account_id === accountId) {
      config.current = null
    }

    await this.save(config)
    return true
  }

  async setCurrent(accountId: string): Promise<boolean> {
    const config = await this.load()

    if (!config.accounts[accountId]) {
      return false
    }

    config.current = {
      account_id: accountId,
    }

    await this.save(config)
    return true
  }

  async listAll(): Promise<Array<WeChatBotAccountEntry & { is_current: boolean }>> {
    const config = await this.load()
    const results: Array<WeChatBotAccountEntry & { is_current: boolean }> = []

    for (const account of Object.values(config.accounts)) {
      results.push({
        app_id: account.app_id,
        app_secret: account.app_secret,
        account_name: account.account_name,
        is_current: config.current?.account_id === account.app_id,
      })
    }

    return results
  }

  async clearCredentials(): Promise<void> {
    await this.save({ current: null, accounts: {} })
  }
}
