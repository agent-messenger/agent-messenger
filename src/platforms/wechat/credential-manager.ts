import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  createAccountId,
  type WeChatAccount,
  type WeChatAccountPaths,
  type WeChatConfig,
  WeChatConfigSchema,
} from './types'

export class WeChatCredentialManager {
  private configDir: string
  private credentialsPath: string
  private wechatRootDir: string

  constructor(configDir?: string) {
    this.configDir = configDir ?? join(homedir(), '.config', 'agent-messenger')
    this.credentialsPath = join(this.configDir, 'wechat-credentials.json')
    this.wechatRootDir = join(this.configDir, 'wechat')
  }

  async loadConfig(): Promise<WeChatConfig> {
    if (!existsSync(this.credentialsPath)) {
      return { current: null, accounts: {} }
    }

    try {
      const content = await readFile(this.credentialsPath, 'utf-8')
      const json: unknown = JSON.parse(content)
      const parsed = WeChatConfigSchema.safeParse(json)
      if (!parsed.success) {
        return { current: null, accounts: {} }
      }
      return parsed.data
    } catch {
      return { current: null, accounts: {} }
    }
  }

  async saveConfig(config: WeChatConfig): Promise<void> {
    await mkdir(this.configDir, { recursive: true })
    await writeFile(this.credentialsPath, JSON.stringify(config, null, 2), { mode: 0o600 })
  }

  async getAccount(accountId?: string): Promise<WeChatAccount | null> {
    const envWxid = process.env.E2E_WECHAT_WXID

    if (envWxid && !accountId) {
      const id = createAccountId(envWxid)
      return {
        account_id: id,
        name: process.env.E2E_WECHAT_NAME,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    }

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

  async listAccounts(): Promise<Array<WeChatAccount & { is_current: boolean }>> {
    const config = await this.loadConfig()

    return Object.values(config.accounts).map((account) => ({
      ...account,
      is_current: account.account_id === config.current,
    }))
  }

  async setAccount(account: WeChatAccount): Promise<void> {
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

    if (existsSync(this.wechatRootDir)) {
      await rm(this.wechatRootDir, { recursive: true, force: true })
    }
  }

  getAccountPaths(accountId: string): WeChatAccountPaths {
    const safeAccountId = createAccountId(accountId)
    const accountDir = join(this.wechatRootDir, safeAccountId)

    return {
      account_dir: accountDir,
    }
  }

  async ensureAccountPaths(accountId: string): Promise<WeChatAccountPaths> {
    const paths = this.getAccountPaths(accountId)
    await mkdir(paths.account_dir, { recursive: true })
    return paths
  }
}
