import { KakaoTalkClient } from '@/platforms/kakaotalk/client'
import { KakaoCredentialManager } from '@/platforms/kakaotalk/credential-manager'

import type { AuthHint, AuthIO, PlatformAdapter, UnifiedChannel, UnifiedMessage, Workspace } from './types'

export class KakaoTalkAdapter implements PlatformAdapter {
  readonly name = 'KakaoTalk'

  private client: KakaoTalkClient | null = null
  private credManager = new KakaoCredentialManager()
  private currentAccount: Workspace | null = null

  async login(): Promise<void> {
    this.client?.close()
    const client = new KakaoTalkClient()
    await client.login()
    this.client = client

    const config = await this.credManager.load()
    if (config.current_account && config.accounts[config.current_account]) {
      const acct = config.accounts[config.current_account]
      this.currentAccount = { id: acct.account_id, name: acct.account_id }
    }
  }

  async getChannels(): Promise<UnifiedChannel[]> {
    const client = this.ensureClient()
    const chats = await client.getChats()
    return chats.map((chat) => ({
      id: chat.chat_id,
      name: chat.display_name || `Chat ${chat.chat_id}`,
    }))
  }

  async getMessages(channelId: string, limit = 50): Promise<UnifiedMessage[]> {
    const client = this.ensureClient()
    const messages = await client.getMessages(channelId, { count: limit })
    return messages.map((msg) => ({
      id: msg.log_id,
      channelId,
      author: String(msg.author_id),
      content: msg.message ?? '',
      timestamp: String(msg.sent_at),
    }))
  }

  async sendMessage(channelId: string, text: string): Promise<void> {
    const client = this.ensureClient()
    await client.sendMessage(channelId, text)
  }

  async getWorkspaces(): Promise<Workspace[]> {
    const config = await this.credManager.load()
    return Object.values(config.accounts).map((acct) => ({
      id: acct.account_id,
      name: acct.account_id,
    }))
  }

  async switchWorkspace(accountId: string): Promise<void> {
    this.client?.close()
    const creds = await this.credManager.getAccount(accountId)
    if (!creds) throw new Error(`Account ${accountId} not found`)

    const client = new KakaoTalkClient()
    await client.login({ oauthToken: creds.oauth_token, userId: creds.user_id, deviceUuid: creds.device_uuid })
    this.client = client
    this.currentAccount = { id: creds.account_id, name: creds.account_id }
  }

  getCurrentWorkspace(): Workspace | null {
    return this.currentAccount
  }

  getAuthHint(): AuthHint {
    return {
      command: 'agent-kakaotalk auth login',
      description: 'Run the command below and log in with your Kakao account credentials.',
    }
  }

  async authenticate(io: AuthIO): Promise<void> {
    const { loginFlow, generateDeviceUuid } = await import('@/platforms/kakaotalk/auth/kakao-login')
    const { KakaoTokenExtractor } = await import('@/platforms/kakaotalk/token-extractor')

    const existing = await this.credManager.getAccount()
    const pendingState = await this.credManager.loadPendingLogin()
    const savedDeviceUuid = pendingState?.device_uuid ?? existing?.device_uuid ?? generateDeviceUuid()

    let email: string | undefined
    let password: string | undefined

    io.print('Checking for cached credentials...')
    try {
      const extractor = new KakaoTokenExtractor()
      const cached = await extractor.extract()
      if (cached?.login_form_body) {
        const params = new URLSearchParams(cached.login_form_body)
        email = params.get('email') ?? undefined
        const cachedPassword = params.get('password') ?? undefined
        const isHashed = cachedPassword && /^[0-9a-f]{128}$/.test(cachedPassword)
        if (!isHashed) password = cachedPassword
        if (email) io.print(`Found cached credentials for ${email}`)
      }
    } catch {}

    if (!email) {
      email = await io.prompt('KakaoTalk email')
      if (!email) throw new Error('Email is required')
    }
    if (!password) {
      password = await io.prompt('Password', { secret: true })
      if (!password) throw new Error('Password is required')
    }

    io.print('Logging in...')
    const result = await loginFlow({
      email,
      password,
      deviceType: 'tablet',
      force: false,
      savedDeviceUuid,
      onPasscodeDisplay: (code) => {
        io.print(`Enter this code on your phone: ${code}`)
        io.print('Waiting for confirmation...')
      },
    })

    if (!result.authenticated || !result.credentials) {
      throw new Error(result.message ?? result.error ?? 'Authentication failed')
    }

    const now = new Date().toISOString()
    await this.credManager.setAccount({
      account_id: result.credentials.user_id || 'default',
      oauth_token: result.credentials.access_token,
      user_id: result.credentials.user_id,
      refresh_token: result.credentials.refresh_token,
      device_uuid: result.credentials.device_uuid,
      device_type: result.credentials.device_type,
      created_at: now,
      updated_at: now,
    })
    await this.credManager.setCurrentAccount(result.credentials.user_id || 'default')

    const client = new KakaoTalkClient()
    await client.login({
      oauthToken: result.credentials.access_token,
      userId: result.credentials.user_id,
      deviceUuid: result.credentials.device_uuid,
    })
    this.client = client
    this.currentAccount = { id: result.credentials.user_id, name: email }
  }

  private ensureClient(): KakaoTalkClient {
    if (!this.client) {
      throw new Error('Not logged in. Call login() first.')
    }
    return this.client
  }
}
