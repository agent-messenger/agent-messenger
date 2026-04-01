import {
  createAccountId,
  type OneBotMessageEvent,
  type OneBotSendRequest,
  type WeChatAccount,
  WeChatError,
  type WeChatMessageSummary,
} from './types'

export class WeChatClient {
  private baseUrl: string
  private wsUrl: string
  private accountId: string | null = null

  constructor(options?: { host?: string; port?: number }) {
    const host = options?.host ?? '127.0.0.1'
    const port = options?.port ?? 58080
    this.baseUrl = `http://${host}:${port}`
    this.wsUrl = `ws://${host}:${port}/ws`
  }

  async isConnected(): Promise<boolean> {
    try {
      await fetch(this.baseUrl, { signal: AbortSignal.timeout(3000) })
      return true
    } catch {
      return false
    }
  }

  async getLoginInfo(): Promise<{ user_id: string; nickname: string }> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.wsUrl)
      const echo = 'get_login_info'
      const timeout = setTimeout(() => {
        ws.close()
        reject(new WeChatError('getLoginInfo timed out', 'login_info_timeout'))
      }, 5000)

      ws.onopen = () => {
        ws.send(JSON.stringify({ action: 'get_login_info', echo }))
      }

      ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(String(event.data)) as {
            echo?: string
            status?: string
            data?: { user_id: string; nickname: string }
          }
          if (data.echo === echo && data.status === 'ok' && data.data) {
            clearTimeout(timeout)
            ws.close()
            resolve(data.data)
          }
        } catch { /* ignore malformed messages */ }
      }

      ws.onerror = () => {
        clearTimeout(timeout)
        reject(new WeChatError('WebSocket error connecting to OneBot server', 'ws_error'))
      }
    })
  }

  async sendMessage(chatId: string, text: string): Promise<{ success: boolean }> {
    const isGroup = chatId.includes('@chatroom')
    const endpoint = isGroup ? '/send_group_msg' : '/send_private_msg'
    const body: OneBotSendRequest = {
      message: [{ type: 'text', data: { text } }],
      ...(isGroup ? { group_id: chatId } : { user_id: chatId }),
    }

    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      throw new WeChatError(`Send failed: HTTP ${res.status}`, 'send_failed')
    }

    return { success: true }
  }

  async receiveMessages(options?: { timeout?: number; limit?: number }): Promise<WeChatMessageSummary[]> {
    const windowMs = options?.timeout ?? 5000
    const limit = options?.limit ?? 50

    return new Promise((resolve) => {
      const collected: OneBotMessageEvent[] = []
      const ws = new WebSocket(this.wsUrl)

      const done = () => {
        ws.close()
        const results = collected.slice(0, limit).map((evt) => {
          const chatId = evt.message_type === 'group' ? evt.group_id : evt.user_id
          const text = evt.message.find((s) => s.type === 'text')?.data.text
          return {
            id: evt.message_id,
            chat_id: chatId,
            from: evt.user_id,
            from_name: evt.sender.nickname,
            timestamp: new Date(evt.time).toISOString(),
            is_outgoing: evt.user_id === evt.self_id,
            type: evt.message.length > 0 ? evt.message[0].type : 'text',
            text,
          } satisfies WeChatMessageSummary
        })
        resolve(results)
      }

      const timer = setTimeout(done, windowMs)

      ws.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(String(event.data)) as OneBotMessageEvent
          if (data.post_type === 'message') {
            collected.push(data)
            if (collected.length >= limit) {
              clearTimeout(timer)
              done()
            }
          }
        } catch { /* ignore malformed messages */ }
      }

      ws.onerror = () => {
        clearTimeout(timer)
        resolve([])
      }
    })
  }

  getAccountId(): string | null {
    return this.accountId
  }

  async login(credentials?: { accountId?: string }): Promise<this> {
    if (credentials?.accountId) {
      this.accountId = credentials.accountId
      return this
    }

    const { WeChatCredentialManager } = await import('./credential-manager')
    const manager = new WeChatCredentialManager()
    const account = await manager.getAccount()

    if (account) {
      this.accountId = account.account_id
    }

    return this
  }

  async saveCurrentAccount(userInfo: { user_id: string; nickname: string }): Promise<WeChatAccount | null> {
    const accountId = this.accountId ?? createAccountId(userInfo.user_id)
    this.accountId = accountId

    const { WeChatCredentialManager } = await import('./credential-manager')
    const manager = new WeChatCredentialManager()
    const now = new Date().toISOString()
    const existing = await manager.getAccount(accountId)

    const account: WeChatAccount = {
      account_id: accountId,
      name: userInfo.nickname,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    }

    await manager.setAccount(account)
    return account
  }
}
