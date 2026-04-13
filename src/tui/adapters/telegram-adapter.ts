import { TelegramTdlibClient } from '@/platforms/telegram/client'
import { TelegramCredentialManager } from '@/platforms/telegram/credential-manager'

import type { AuthHint, AuthIO, PlatformAdapter, UnifiedChannel, UnifiedMessage, Workspace } from './types'

export class TelegramAdapter implements PlatformAdapter {
  readonly name = 'Telegram'

  private client: TelegramTdlibClient | null = null
  private credManager = new TelegramCredentialManager()
  private currentAccount: Workspace | null = null

  async login(): Promise<void> {
    const account = await this.credManager.getAccount()
    if (!account) throw new Error('No Telegram credentials found')

    const paths = this.credManager.getAccountPaths(account.account_id)
    const client = await TelegramTdlibClient.create(account, paths)

    try {
      const state = await client.connect()
      if (state?.['@type'] !== 'authorizationStateReady') {
        throw new Error('Telegram account not authenticated')
      }
    } catch (err) {
      await client.close().catch(() => {})
      throw err
    }

    this.client = client
    this.currentAccount = { id: account.account_id, name: account.phone_number ?? account.account_id }
  }

  async getChannels(): Promise<UnifiedChannel[]> {
    const client = this.ensureClient()
    const chats = await client.listChats(50)
    return chats.map((chat) => ({
      id: String(chat.id),
      name: chat.title,
    }))
  }

  async getMessages(channelId: string, limit = 50): Promise<UnifiedMessage[]> {
    const client = this.ensureClient()
    const messages = await client.listMessages(channelId, limit)
    return messages
      .map((msg) => ({
        id: String(msg.id),
        channelId: String(msg.chat_id),
        author: msg.sender.id ? String(msg.sender.id) : 'unknown',
        content: msg.text ?? '',
        timestamp: msg.date,
      }))
      .reverse()
  }

  async sendMessage(channelId: string, text: string): Promise<void> {
    const client = this.ensureClient()
    await client.sendMessage(channelId, text)
  }

  async getWorkspaces(): Promise<Workspace[]> {
    const accounts = await this.credManager.listAccounts()
    return accounts.map((acct) => ({
      id: acct.account_id,
      name: acct.phone_number ?? acct.account_id,
    }))
  }

  async switchWorkspace(accountId: string): Promise<void> {
    if (this.client) {
      await this.client.close().catch(() => {})
      this.client = null
    }

    const account = await this.credManager.getAccount(accountId)
    if (!account) throw new Error(`Account ${accountId} not found`)

    const paths = this.credManager.getAccountPaths(account.account_id)
    const client = await TelegramTdlibClient.create(account, paths)

    try {
      const state = await client.connect()
      if (state?.['@type'] !== 'authorizationStateReady') {
        throw new Error('Telegram account not authenticated')
      }
    } catch (err) {
      await client.close().catch(() => {})
      throw err
    }

    this.client = client
    this.currentAccount = { id: account.account_id, name: account.phone_number ?? account.account_id }
  }

  getCurrentWorkspace(): Workspace | null {
    return this.currentAccount
  }

  getAuthHint(): AuthHint {
    return {
      command: 'agent-telegram auth login',
      description: 'Run the command below and follow the interactive login flow with your phone number.',
    }
  }

  async authenticate(io: AuthIO): Promise<void> {
    const { getTelegramAppCredentials } = await import('@/platforms/telegram/app-config')
    const { provisionTelegramApp } = await import('@/platforms/telegram/my-telegram-org')
    const { createAccountId } = await import('@/platforms/telegram/types')

    const existing = await this.credManager.getAccount()
    const defaults = getTelegramAppCredentials()
    let apiId = existing?.api_id ?? defaults.api_id
    let apiHash = existing?.api_hash ?? defaults.api_hash

    const phone = await io.prompt('Phone number (e.g. +14155551234)')
    if (!phone) throw new Error('Phone number is required')

    if (!apiId || !apiHash) {
      io.print('Provisioning API credentials via my.telegram.org...')
      io.print('A verification code will be sent to your Telegram account.')
      try {
        const app = await provisionTelegramApp({
          phone,
          promptForCode: async () => {
            const code = await io.prompt('Provisioning code (sent to your Telegram app)')
            if (!code) throw new Error('Code is required')
            return code
          },
        })
        apiId = app.api_id
        apiHash = app.api_hash
        io.print('API credentials obtained.')
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err)
        io.print(`Auto-provisioning failed: ${detail}`)
        io.print('Enter credentials manually from https://my.telegram.org/apps')
        const idStr = await io.prompt('API ID')
        apiId = Number.parseInt(idStr, 10)
        if (!apiId || !Number.isFinite(apiId)) throw new Error('Invalid API ID')
        apiHash = await io.prompt('API hash')
        if (!apiHash) throw new Error('API hash is required')
      }
    }

    const accountId = createAccountId(phone)
    const now = new Date().toISOString()
    const account = {
      account_id: accountId,
      api_id: apiId,
      api_hash: apiHash,
      phone_number: phone,
      created_at: now,
      updated_at: now,
    }

    await this.credManager.setAccount(account)
    await this.credManager.setCurrent(accountId)
    const paths = this.credManager.getAccountPaths(accountId)

    const client = await TelegramTdlibClient.create(account, paths)

    try {
      let result = await client.login({ phone_number: phone })

      while (!result.authenticated && result.next_action) {
        switch (result.next_action) {
          case 'provide_code': {
            const code = await io.prompt('Verification code')
            result = await client.login({ phone_number: phone, code })
            break
          }
          case 'provide_password': {
            const hint = result.hint ? ` (hint: ${result.hint})` : ''
            const password = await io.prompt(`2FA password${hint}`, { secret: true })
            result = await client.login({ phone_number: phone, password })
            break
          }
          default:
            throw new Error(`Unexpected auth step: ${result.next_action}`)
        }
      }

      if (!result.authenticated) {
        throw new Error('Authentication did not complete')
      }

      this.client = client
      this.currentAccount = { id: accountId, name: phone }
    } catch (err) {
      await client.close().catch(() => {})
      throw err
    }
  }

  private ensureClient(): TelegramTdlibClient {
    if (!this.client) {
      throw new Error('Not logged in. Call login() first.')
    }
    return this.client
  }
}
