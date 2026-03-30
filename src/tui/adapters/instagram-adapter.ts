import { InstagramClient } from '@/platforms/instagram/client'
import { InstagramCredentialManager } from '@/platforms/instagram/credential-manager'

import type { AuthHint, AuthIO, PlatformAdapter, UnifiedChannel, UnifiedMessage, Workspace } from './types'

export class InstagramAdapter implements PlatformAdapter {
  readonly name = 'Instagram'

  private client: InstagramClient | null = null
  private credManager = new InstagramCredentialManager()
  private currentAccount: Workspace | null = null

  async login(): Promise<void> {
    const client = new InstagramClient()
    await client.login()
    this.client = client

    const config = await this.credManager.loadConfig()
    if (config.current && config.accounts[config.current]) {
      const acct = config.accounts[config.current]
      this.currentAccount = { id: acct.account_id, name: acct.username ?? acct.account_id }
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
      channelId: msg.thread_id,
      author: msg.is_outgoing ? 'you' : (msg.from ?? 'unknown'),
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
      name: acct.username ?? acct.account_id,
    }))
  }

  async switchWorkspace(accountId: string): Promise<void> {
    const client = new InstagramClient()
    await client.login(undefined, accountId)
    this.client = client

    const account = await this.credManager.getAccount(accountId)
    this.currentAccount = { id: accountId, name: account?.username ?? accountId }
  }

  getCurrentWorkspace(): Workspace | null {
    return this.currentAccount
  }

  getAuthHint(): AuthHint {
    return {
      command: 'agent-instagram auth login',
      description: 'Run the command below and log in with your Instagram username and password.',
    }
  }

  async authenticate(io: AuthIO): Promise<void> {
    const { createAccountId } = await import('@/platforms/instagram/types')

    const username = await io.prompt('Instagram username')
    if (!username) throw new Error('Username is required')
    const password = await io.prompt('Password', { secret: true })
    if (!password) throw new Error('Password is required')

    io.print('Logging in...')
    const accountId = createAccountId(username)
    const paths = await this.credManager.ensureAccountPaths(accountId)

    const client = new InstagramClient(this.credManager)
    client.setSessionPath(paths.session_path)

    const result = await client.authenticate(username, password)

    let userId = result.userId
    if (result.requiresTwoFactor) {
      const twoFactorId = (result.twoFactorInfo?.['two_factor_identifier'] as string) ?? ''
      const code = await io.prompt('Verification code')
      if (!code) throw new Error('Verification code is required')
      const tfResult = await client.twoFactorLogin(username, code, twoFactorId)
      userId = tfResult.userId || userId
    } else if (result.challengeRequired && result.challengePath) {
      io.print('Security challenge required. Sending verification code via email...')
      await client.challengeSendCode(result.challengePath, 'email')
      const code = await io.prompt('Verification code (check your email)')
      if (!code) throw new Error('Verification code is required')
      const challengeResult = await client.challengeSubmitCode(result.challengePath, code)
      userId = challengeResult.userId || userId
    }

    const now = new Date().toISOString()
    await this.credManager.setAccount({
      account_id: accountId,
      username,
      pk: userId,
      created_at: now,
      updated_at: now,
    })
    await this.credManager.setCurrent(accountId)

    this.client = client
    this.currentAccount = { id: accountId, name: username }
  }

  private ensureClient(): InstagramClient {
    if (!this.client) {
      throw new Error('Not logged in. Call login() first.')
    }
    return this.client
  }
}
