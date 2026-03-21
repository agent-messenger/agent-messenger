import { existsSync } from 'node:fs'
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

import type { WhatsAppBotAccountEntry, WhatsAppBotConfig, WhatsAppBotCredentials } from './types'
import { WhatsAppBotConfigSchema } from './types'

export class WhatsAppBotCredentialManager {
  private configDir: string
  private credentialsPath: string

  constructor(configDir?: string) {
    this.configDir = configDir ?? join(homedir(), '.config', 'agent-messenger')
    this.credentialsPath = join(this.configDir, 'whatsappbot-credentials.json')
  }

  async load(): Promise<WhatsAppBotConfig> {
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
    const parsed = WhatsAppBotConfigSchema.safeParse(json)
    if (!parsed.success) {
      return { current: null, accounts: {} }
    }
    return parsed.data
  }

  async save(config: WhatsAppBotConfig): Promise<void> {
    await mkdir(this.configDir, { recursive: true })
    await writeFile(this.credentialsPath, JSON.stringify(config, null, 2), { mode: 0o600 })
    await chmod(this.credentialsPath, 0o600)
  }

  async getCredentials(accountId?: string): Promise<WhatsAppBotCredentials | null> {
    const envAccessToken = process.env.E2E_WHATSAPPBOT_ACCESS_TOKEN
    const envPhoneNumberId = process.env.E2E_WHATSAPPBOT_PHONE_NUMBER_ID

    if (envAccessToken && envPhoneNumberId && !accountId) {
      return {
        phone_number_id: envPhoneNumberId,
        account_name: 'env',
        access_token: envAccessToken,
      }
    }

    const config = await this.load()

    if (accountId) {
      const account = config.accounts[accountId]
      if (!account) return null
      return {
        phone_number_id: account.phone_number_id,
        account_name: account.account_name,
        access_token: account.access_token,
      }
    }

    if (!config.current) {
      return null
    }

    const account = config.accounts[config.current.account_id]
    if (!account) return null

    return {
      phone_number_id: account.phone_number_id,
      account_name: account.account_name,
      access_token: account.access_token,
    }
  }

  async setCredentials(entry: WhatsAppBotAccountEntry): Promise<void> {
    const config = await this.load()

    config.accounts[entry.phone_number_id] = {
      phone_number_id: entry.phone_number_id,
      account_name: entry.account_name,
      access_token: entry.access_token,
    }

    config.current = {
      account_id: entry.phone_number_id,
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

  async listAll(): Promise<Array<WhatsAppBotAccountEntry & { is_current: boolean }>> {
    const config = await this.load()
    const results: Array<WhatsAppBotAccountEntry & { is_current: boolean }> = []

    for (const account of Object.values(config.accounts)) {
      results.push({
        phone_number_id: account.phone_number_id,
        account_name: account.account_name,
        access_token: account.access_token,
        is_current: config.current?.account_id === account.phone_number_id,
      })
    }

    return results
  }

  async clearCredentials(): Promise<void> {
    await this.save({ current: null, accounts: {} })
  }
}
