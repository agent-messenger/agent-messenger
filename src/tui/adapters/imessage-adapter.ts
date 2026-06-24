import { BlueBubblesClient } from '@/platforms/imessage/client'
import { IMessageCredentialManager } from '@/platforms/imessage/credential-manager'

import type { AuthHint, AuthIO, PlatformAdapter, UnifiedChannel, UnifiedMessage, Workspace } from './types'

const POLL_INTERVAL_MS = 5000

export class IMessageAdapter implements PlatformAdapter {
  readonly name = 'iMessage'

  private client: BlueBubblesClient | null = null
  private credManager = new IMessageCredentialManager()
  private currentAccount: Workspace | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null

  async login(): Promise<void> {
    const client = new BlueBubblesClient()
    await client.login()
    await client.connect()
    this.client = client

    const config = await this.credManager.loadConfig()
    if (config.current && config.accounts[config.current]) {
      const acct = config.accounts[config.current]
      this.currentAccount = { id: acct.account_id, name: acct.label ?? acct.server_url }
    }
  }

  async getChannels(): Promise<UnifiedChannel[]> {
    const client = this.ensureClient()
    const chats = await client.listChats(50)
    return chats.map((chat) => ({ id: chat.id, name: chat.name || chat.id }))
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

  async startListening(onMessage: (msg: UnifiedMessage) => void): Promise<void> {
    const client = this.ensureClient()
    let watermark = Date.now()
    const seen = new Set<string>()

    this.pollTimer = setInterval(() => {
      void (async () => {
        try {
          const count = await client.countMessages(watermark)
          if (count <= 0) return
          const chats = await client.listChats(50)
          for (const chat of chats) {
            const last = chat.last_message
            if (!last) continue
            const ts = Date.parse(last.timestamp)
            if (ts <= watermark || seen.has(last.id)) continue
            seen.add(last.id)
            if (ts > watermark) watermark = ts
            onMessage({
              id: last.id,
              channelId: chat.id,
              author: last.is_outgoing ? 'you' : (last.from_name ?? last.from ?? 'unknown'),
              content: last.text ?? '',
              timestamp: last.timestamp,
            })
          }
        } catch {
          this.stopListening()
        }
      })()
    }, POLL_INTERVAL_MS)
  }

  stopListening(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  async getWorkspaces(): Promise<Workspace[]> {
    const accounts = await this.credManager.listAccounts()
    return accounts.map((acct) => ({ id: acct.account_id, name: acct.label ?? acct.server_url }))
  }

  async switchWorkspace(accountId: string): Promise<void> {
    if (this.client) {
      await this.client.close().catch(() => {})
      this.client = null
    }
    const account = await this.credManager.getAccount(accountId)
    if (!account) throw new Error(`Account ${accountId} not found`)

    const client = new BlueBubblesClient()
    await client.login({ serverUrl: account.server_url, password: account.password })
    await client.connect()
    this.client = client
    this.currentAccount = { id: account.account_id, name: account.label ?? account.server_url }
  }

  getCurrentWorkspace(): Workspace | null {
    return this.currentAccount
  }

  getAuthHint(): AuthHint {
    return {
      command: 'agent-imessage setup',
      description: 'iMessage needs a Mac running BlueBubbles. Run the guided setup below.',
    }
  }

  async authenticate(io: AuthIO): Promise<void> {
    const url = await io.prompt('BlueBubbles server URL (e.g. http://host.docker.internal:1234)')
    const password = await io.prompt('Server password', { secret: true })

    const client = await new BlueBubblesClient().login({ serverUrl: url, password })
    await client.connect()
    await client.getServerInfo()

    const { createAccountId } = await import('@/platforms/imessage/types')
    const now = new Date().toISOString()
    const accountId = createAccountId(url)
    await this.credManager.setAccount({
      account_id: accountId,
      provider: 'bluebubbles',
      server_url: url.replace(/\/+$/, ''),
      password,
      created_at: now,
      updated_at: now,
    })
    await this.credManager.setCurrent(accountId)

    this.client = client
    this.currentAccount = { id: accountId, name: url }
  }

  private ensureClient(): BlueBubblesClient {
    if (!this.client) {
      throw new Error('Not logged in. Call login() first.')
    }
    return this.client
  }
}
