import { LineClient } from '@/platforms/line/client'
import { LineCredentialManager } from '@/platforms/line/credential-manager'

import type { AuthHint, AuthIO, PlatformAdapter, UnifiedChannel, UnifiedMessage, Workspace } from './types'

export class LineAdapter implements PlatformAdapter {
  readonly name = 'LINE'

  private client: LineClient | null = null
  private credManager = new LineCredentialManager()
  private currentAccount: Workspace | null = null

  async login(): Promise<void> {
    const client = new LineClient()
    await client.login()
    this.client = client

    const config = await this.credManager.load()
    if (config.current_account && config.accounts[config.current_account]) {
      const acct = config.accounts[config.current_account]
      this.currentAccount = { id: acct.account_id, name: acct.display_name ?? acct.account_id }
    }
  }

  async getChannels(): Promise<UnifiedChannel[]> {
    const client = this.ensureClient()
    const chats = await client.getChats({ limit: 50 })
    return chats.map((chat) => ({
      id: chat.chat_id,
      name: chat.display_name || chat.chat_id,
    }))
  }

  async getMessages(channelId: string, limit = 50): Promise<UnifiedMessage[]> {
    const client = this.ensureClient()
    const messages = await client.getMessages(channelId, { count: limit })
    return messages.map((msg) => ({
      id: msg.message_id,
      channelId,
      author: msg.author_id ?? 'unknown',
      content: msg.text ?? '',
      timestamp: msg.sent_at,
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
      name: acct.display_name ?? acct.account_id,
    }))
  }

  async switchWorkspace(accountId: string): Promise<void> {
    const creds = await this.credManager.getAccount(accountId)
    if (!creds) throw new Error(`Account ${accountId} not found`)

    const client = new LineClient()
    await client.login(creds)
    this.client = client
    this.currentAccount = { id: creds.account_id, name: creds.display_name ?? creds.account_id }
  }

  getCurrentWorkspace(): Workspace | null {
    return this.currentAccount
  }

  getAuthHint(): AuthHint {
    return {
      command: 'agent-line auth login',
      description: 'Run the command below and scan the QR code with your LINE mobile app.',
    }
  }

  async authenticate(io: AuthIO): Promise<void> {
    const client = new LineClient(this.credManager)

    io.print('Generating QR code...')
    const result = await client.loginWithQR({
      onQRUrl: (url) => {
        io.print('Scan this URL with the LINE mobile app:')
        io.print(url)
      },
      onPincode: (pin) => {
        io.print(`Enter this PIN in the LINE mobile app: ${pin}`)
      },
    })

    if (!result.authenticated) {
      throw new Error('Authentication failed')
    }

    this.client = client
    const accountId = result.account_id ?? 'default'
    this.currentAccount = { id: accountId, name: result.display_name ?? accountId }
  }

  private ensureClient(): LineClient {
    if (!this.client) {
      throw new Error('Not logged in. Call login() first.')
    }
    return this.client
  }
}
