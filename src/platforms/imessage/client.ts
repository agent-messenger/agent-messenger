import { existsSync } from 'node:fs'

import { type IMessageChatSummary, type IMessageMessageSummary, type IMessageServerInfo, IMessageError } from './types'

interface BlueBubblesEnvelope<T> {
  status: number
  message: string
  data: T
}

interface BlueBubblesHandle {
  address?: string
}

interface BlueBubblesMessage {
  guid: string
  text?: string | null
  dateCreated?: number
  isFromMe?: boolean
  handle?: BlueBubblesHandle | null
}

interface BlueBubblesChat {
  guid: string
  chatIdentifier?: string
  displayName?: string | null
  style?: number
  participants?: BlueBubblesHandle[]
  lastMessage?: BlueBubblesMessage | null
}

interface BlueBubblesServerInfo {
  server_version?: string
  os_version?: string
  private_api?: boolean
  detected_icloud?: string
}

const GROUP_CHAT_STYLE = 43

function looksLikeContainer(): boolean {
  if (process.env.AGENT_MESSENGER_IN_CONTAINER === '1') return true
  try {
    return existsSync('/.dockerenv')
  } catch {
    return false
  }
}

function hostIsLoopback(serverUrl: string): boolean {
  try {
    const host = new URL(serverUrl).hostname
    return host === 'localhost' || host === '127.0.0.1' || host === '::1'
  } catch {
    return false
  }
}

function toIsoTimestamp(dateCreated?: number): string {
  if (!dateCreated || Number.isNaN(dateCreated)) return new Date(0).toISOString()
  return new Date(dateCreated).toISOString()
}

function summarizeMessage(msg: BlueBubblesMessage, chatGuid: string): IMessageMessageSummary {
  return {
    id: msg.guid,
    chat_id: chatGuid,
    from: msg.isFromMe ? '' : (msg.handle?.address ?? ''),
    from_name: msg.handle?.address ?? undefined,
    timestamp: toIsoTimestamp(msg.dateCreated),
    is_outgoing: Boolean(msg.isFromMe),
    text: msg.text ?? undefined,
  }
}

function summarizeChat(chat: BlueBubblesChat): IMessageChatSummary {
  const type = chat.style === GROUP_CHAT_STYLE || (chat.participants?.length ?? 0) > 1 ? 'group' : 'individual'
  const fallbackName = chat.chatIdentifier ?? chat.guid
  return {
    id: chat.guid,
    name: chat.displayName?.trim() || fallbackName,
    type,
    last_message: chat.lastMessage ? summarizeMessage(chat.lastMessage, chat.guid) : undefined,
  }
}

export class BlueBubblesClient {
  private serverUrl: string | null = null
  private password: string | null = null

  async login(credentials?: { serverUrl: string; password: string }): Promise<this> {
    if (credentials) {
      this.serverUrl = credentials.serverUrl.replace(/\/+$/, '')
      this.password = credentials.password
      return this
    }

    const { IMessageCredentialManager } = await import('./credential-manager')
    const manager = new IMessageCredentialManager()
    const resolved = await manager.resolveCredentials()
    if (!resolved) {
      throw new IMessageError(
        'No iMessage credentials found. Run "agent-imessage auth login" or "agent-imessage setup" first.',
        'no_credentials',
        { doctorCommand: 'agent-imessage setup' },
      )
    }
    return this.login({ serverUrl: resolved.server_url, password: resolved.password })
  }

  private ensureAuth(): void {
    if (this.serverUrl === null || this.password === null) {
      throw new IMessageError('Not authenticated. Call .login() first.', 'not_authenticated')
    }
  }

  private buildUrl(path: string, query: Record<string, string | number | undefined> = {}): string {
    const url = new URL(`${this.serverUrl}${path}`)
    url.searchParams.set('password', this.password!)
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value))
    }
    return url.toString()
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    options: { query?: Record<string, string | number | undefined>; body?: unknown } = {},
  ): Promise<T> {
    this.ensureAuth()

    const init: RequestInit = { method }
    if (method === 'POST' && options.body !== undefined) {
      init.headers = { 'Content-Type': 'application/json' }
      init.body = JSON.stringify(options.body)
    }

    let response: Response
    try {
      response = await fetch(this.buildUrl(path, options.query), init)
    } catch {
      throw this.normalizeNetworkError()
    }

    if (response.status === 401) {
      throw new IMessageError('Password rejected by BlueBubbles.', 'auth_rejected', {
        suggestion: 'Check the server password in BlueBubbles settings, then rerun "agent-imessage auth login".',
        doctorCommand: 'agent-imessage doctor',
      })
    }

    if (!response.ok) {
      throw new IMessageError(`BlueBubbles request failed (HTTP ${response.status}).`, 'send_failed', {
        doctorCommand: 'agent-imessage doctor',
      })
    }

    const envelope = (await response.json()) as BlueBubblesEnvelope<T>
    return envelope.data
  }

  private normalizeNetworkError(): IMessageError {
    if (this.serverUrl && hostIsLoopback(this.serverUrl) && looksLikeContainer()) {
      return new IMessageError(
        'Cannot reach BlueBubbles at a loopback address from inside a container.',
        'localhost_in_container',
        {
          suggestion:
            'Inside Docker, localhost is the container itself. Use "http://host.docker.internal:1234" (same-Mac) or the Mac\'s LAN IP.',
          doctorCommand: 'agent-imessage doctor',
        },
      )
    }
    return new IMessageError(`BlueBubbles is not reachable at ${this.serverUrl}.`, 'unreachable', {
      suggestion: 'Is the BlueBubbles Mac app running and is the port correct (default 1234)?',
      doctorCommand: 'agent-imessage doctor',
    })
  }

  async connect(): Promise<void> {
    await this.request<unknown>('GET', '/api/v1/ping')
  }

  async getServerInfo(): Promise<IMessageServerInfo> {
    const info = await this.request<BlueBubblesServerInfo>('GET', '/api/v1/server/info')
    return {
      backend: 'bluebubbles',
      version: info.server_version ?? null,
      private_api_enabled: Boolean(info.private_api),
      macos_version: info.os_version ?? null,
    }
  }

  async listChats(limit = 25): Promise<IMessageChatSummary[]> {
    const chats = await this.request<BlueBubblesChat[]>('POST', '/api/v1/chat/query', {
      body: { limit, offset: 0, with: ['lastMessage', 'participants'], sort: 'lastmessage' },
    })
    return chats.map(summarizeChat)
  }

  async searchChats(query: string, limit = 25): Promise<IMessageChatSummary[]> {
    const all = await this.listChats(Math.max(limit, 100))
    const lower = query.toLowerCase()
    const filtered = all.filter((c) => c.name.toLowerCase().includes(lower) || c.id.toLowerCase().includes(lower))
    return filtered.slice(0, limit)
  }

  async getMessages(chatGuid: string, limit = 25): Promise<IMessageMessageSummary[]> {
    const messages = await this.request<BlueBubblesMessage[]>('POST', '/api/v1/message/query', {
      body: {
        chatGuid,
        limit,
        offset: 0,
        with: ['handle'],
        sort: 'DESC',
      },
    })
    return messages
      .map((msg) => summarizeMessage(msg, chatGuid))
      .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
  }

  async countMessages(after: number, chatGuid?: string): Promise<number> {
    const result = await this.request<{ total: number }>('GET', '/api/v1/message/count', {
      query: { after, chatGuid },
    })
    return result.total
  }

  async sendMessage(chatGuid: string, text: string): Promise<IMessageMessageSummary> {
    const message = await this.request<BlueBubblesMessage>('POST', '/api/v1/message/text', {
      body: { chatGuid, message: text, method: 'apple-script' },
    })
    return summarizeMessage(message, chatGuid)
  }

  async getProfile(): Promise<{ id: string; backend: string; private_api_enabled: boolean }> {
    const info = await this.getServerInfo()
    return {
      id: this.serverUrl ?? '',
      backend: info.backend,
      private_api_enabled: info.private_api_enabled,
    }
  }

  async close(): Promise<void> {
    this.serverUrl = null
    this.password = null
  }
}
