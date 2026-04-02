import { WhatsAppClient } from '@/platforms/whatsapp/client'
import { WhatsAppCredentialManager } from '@/platforms/whatsapp/credential-manager'
import { renderTerminalQR } from '@/shared/utils/qr'

import type { AuthHint, AuthIO, PlatformAdapter, UnifiedChannel, UnifiedMessage, Workspace } from './types'

export class WhatsAppAdapter implements PlatformAdapter {
  readonly name = 'WhatsApp'

  private client: WhatsAppClient | null = null
  private credManager = new WhatsAppCredentialManager()
  private currentAccount: Workspace | null = null

  async login(): Promise<void> {
    const client = new WhatsAppClient()
    await client.login()
    await client.connect()
    this.client = client

    const config = await this.credManager.loadConfig()
    if (config.current && config.accounts[config.current]) {
      const acct = config.accounts[config.current]
      this.currentAccount = { id: acct.account_id, name: acct.phone_number ?? acct.account_id }
    }
  }

  async getChannels(): Promise<UnifiedChannel[]> {
    const client = this.ensureClient()
    const chats = await client.listChats(50)
    return chats.map((chat) => ({
      id: chat.id,
      name: chat.name || chat.id,
    }))
  }

  async getMessages(channelId: string, limit = 50): Promise<UnifiedMessage[]> {
    const client = this.ensureClient()
    const messages = await client.getMessages(channelId, limit)
    return messages.map((msg) => ({
      id: msg.id,
      channelId,
      author: msg.is_outgoing ? 'you' : (msg.from_name ?? msg.from ?? 'unknown'),
      content: msg.text ?? '',
      timestamp: msg.timestamp,
    }))
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
    const client = new WhatsAppClient()
    await client.login({ authDir: paths.auth_dir })
    await client.connect()
    this.client = client
    this.currentAccount = { id: account.account_id, name: account.phone_number ?? account.account_id }
  }

  getCurrentWorkspace(): Workspace | null {
    return this.currentAccount
  }

  getAuthHint(): AuthHint {
    return {
      command: 'agent-whatsapp auth login --qr',
      description: 'Run the command below and scan the QR code with WhatsApp on your phone.',
    }
  }

  async authenticate(io: AuthIO): Promise<void> {
    io.print('Generating QR code...')
    const accountId = 'qr-default'
    const existingPaths = this.credManager.getAccountPaths(accountId)
    const { rm } = await import('node:fs/promises')
    await rm(existingPaths.auth_dir, { recursive: true, force: true })
    const paths = await this.credManager.ensureAccountPaths(accountId)
    const client = await new WhatsAppClient().login({ authDir: paths.auth_dir })

    let waitForAuth: () => Promise<void>
    try {
      const result = await client.connectForQR(async (qr) => {
        io.print('Scan this QR code with WhatsApp on your phone:')
        try {
          const rendered = await renderTerminalQR(qr)
          io.print(rendered)
        } catch {
          io.print(qr)
        }
      })
      waitForAuth = result.waitForAuth
    } catch (err) {
      await client.close()
      throw err
    }

    io.print('Waiting for QR code scan...')
    try {
      await waitForAuth()
    } catch (err) {
      await client.close()
      throw err
    }

    const now = new Date().toISOString()
    await this.credManager.setAccount({
      account_id: accountId,
      created_at: now,
      updated_at: now,
    })
    await this.credManager.setCurrent(accountId)

    this.client = client
    this.currentAccount = { id: accountId, name: accountId }
  }

  private ensureClient(): WhatsAppClient {
    if (!this.client) {
      throw new Error('Not logged in. Call login() first.')
    }
    return this.client
  }
}
