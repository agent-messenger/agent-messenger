import { runPreSendHook } from '@/shared/pre-send-hook'

import { spawn } from 'node:child_process'

import { classifyImsgFailure } from './errors'
import { ImsgRpc } from './rpc'
import { type IMessageChatSummary, type IMessageMessageSummary, type IMessageStatus, IMessageError } from './types'

interface ImsgChat {
  id: number
  name?: string | null
  identifier?: string | null
  guid?: string | null
  service?: string | null
  is_group?: boolean
  participants?: string[] | null
  last_message?: ImsgMessage | null
}

interface ImsgMessage {
  id: number
  chat_id: number
  guid: string
  sender?: string | null
  sender_name?: string | null
  is_from_me?: boolean
  text?: string | null
  created_at?: string | null
}

const STANDARD_REACTIONS = new Set(['love', 'like', 'dislike', 'laugh', 'emphasis', 'question'])

export interface SendTarget {
  chatId?: number
  chatGuid?: string
  chatIdentifier?: string
  to?: string
}

export type OneShotRunner = (
  binaryPath: string,
  args: string[],
) => Promise<{ code: number; stdout: string; stderr: string }>

const defaultRunner: OneShotRunner = (binaryPath, args) =>
  new Promise((resolve, reject) => {
    let proc: ReturnType<typeof spawn>
    try {
      proc = spawn(binaryPath, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    } catch {
      reject(new IMessageError(`Could not run "${binaryPath}".`, 'imsg_not_found'))
      return
    }
    let stdout = ''
    let stderr = ''
    proc.stdout?.on('data', (c: Buffer) => (stdout += c.toString()))
    proc.stderr?.on('data', (c: Buffer) => (stderr += c.toString()))
    proc.once('error', (err: NodeJS.ErrnoException) => {
      reject(
        err.code === 'ENOENT'
          ? new IMessageError(`Could not run "${binaryPath}".`, 'imsg_not_found', {
              suggestion: 'Install imsg: "brew install steipete/tap/imsg".',
              doctorCommand: 'agent-imessage doctor',
            })
          : err,
      )
    })
    proc.once('close', (code) => resolve({ code: code ?? 0, stdout, stderr }))
  })

function summarizeMessage(msg: ImsgMessage): IMessageMessageSummary {
  return {
    id: msg.id,
    guid: msg.guid,
    chat_id: msg.chat_id,
    from: msg.is_from_me ? '' : (msg.sender ?? ''),
    from_name: msg.sender_name ?? undefined,
    is_outgoing: Boolean(msg.is_from_me),
    timestamp: msg.created_at ?? new Date(0).toISOString(),
    text: msg.text ?? undefined,
  }
}

function summarizeChat(chat: ImsgChat): IMessageChatSummary {
  return {
    id: chat.id,
    guid: chat.guid ?? null,
    identifier: chat.identifier ?? null,
    name: chat.name?.trim() || chat.identifier || chat.guid || String(chat.id),
    service: chat.service ?? 'iMessage',
    is_group: Boolean(chat.is_group),
    participants: chat.participants ?? [],
    last_message: chat.last_message ? summarizeMessage(chat.last_message) : undefined,
  }
}

export class ImsgClient {
  private binaryPath = 'imsg'
  private region: string | undefined
  private rpc: ImsgRpc
  private runner: OneShotRunner

  constructor(deps?: { rpc?: ImsgRpc; runner?: OneShotRunner }) {
    this.rpc = deps?.rpc ?? new ImsgRpc()
    this.runner = deps?.runner ?? defaultRunner
  }

  async login(credentials?: { binaryPath?: string; region?: string }): Promise<this> {
    if (credentials) {
      this.binaryPath = credentials.binaryPath ?? 'imsg'
      this.region = credentials.region
      return this
    }
    const { IMessageCredentialManager } = await import('./credential-manager')
    const resolved = await new IMessageCredentialManager().resolveAccount()
    this.binaryPath = resolved?.binary_path ?? 'imsg'
    this.region = resolved?.region
    return this
  }

  async connect(): Promise<void> {
    await this.rpc.start(this.binaryPath)
    await this.rpc.request('chats.list', { limit: 1 })
  }

  async getVersion(): Promise<string | null> {
    const result = await this.runner(this.binaryPath, ['--version'])
    if (result.code !== 0) return null
    return result.stdout.trim() || null
  }

  async getStatus(): Promise<IMessageStatus> {
    let version: string | null = null
    let fullDiskAccess = false
    try {
      version = await this.getVersion()
    } catch {
      version = null
    }
    try {
      await this.rpc.request('chats.list', { limit: 1 })
      fullDiskAccess = true
    } catch {
      fullDiskAccess = false
    }
    return {
      imsg_version: version,
      binary_path: this.binaryPath,
      full_disk_access: fullDiskAccess,
      automation: 'unknown',
      bridge_available: false,
    }
  }

  async listChats(limit = 25): Promise<IMessageChatSummary[]> {
    const result = await this.rpc.request<{ chats: ImsgChat[] }>('chats.list', { limit })
    return result.chats.map(summarizeChat)
  }

  async searchChats(query: string, limit = 25): Promise<IMessageChatSummary[]> {
    const all = await this.listChats(Math.max(limit, 100))
    const lower = query.toLowerCase()
    return all
      .filter((c) => c.name.toLowerCase().includes(lower) || (c.identifier ?? '').toLowerCase().includes(lower))
      .slice(0, limit)
  }

  async getMessages(chatId: number, limit = 25, start?: string): Promise<IMessageMessageSummary[]> {
    const result = await this.rpc.request<{ messages: ImsgMessage[] }>('messages.history', {
      chat_id: chatId,
      limit,
      ...(start ? { start } : {}),
    })
    return result.messages.map(summarizeMessage).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
  }

  async sendMessage(target: SendTarget, text: string): Promise<IMessageMessageSummary> {
    const params: Record<string, unknown> = { text }
    if (target.chatId !== undefined) params.chat_id = target.chatId
    else if (target.chatGuid) params.chat_guid = target.chatGuid
    else if (target.chatIdentifier) params.chat_identifier = target.chatIdentifier
    else if (target.to) params.to = target.to
    else throw new IMessageError('A chat id, guid, or recipient is required to send.', 'chat_not_found')
    if (this.region) params.region = this.region

    await runPreSendHook({ version: 1, platform: 'imessage', action: 'send', target: { id: String(target.chatId ?? target.chatGuid ?? target.chatIdentifier ?? target.to ?? '') }, text, })
    const result = await this.rpc.request<{ ok?: boolean; guid?: string; id?: number; service?: string }>(
      'send',
      params,
    )
    return {
      id: result.id ?? 0,
      guid: result.guid ?? '',
      chat_id: target.chatId ?? 0,
      from: '',
      is_outgoing: true,
      timestamp: new Date().toISOString(),
      text,
    }
  }

  async sendReaction(chatId: number, reaction: string, messageGuid?: string): Promise<void> {
    if (messageGuid) {
      throw new IMessageError(
        'Reacting to a specific message requires the imsg Private API bridge.',
        'private_api_required',
        { suggestion: 'Enable the bridge with "imsg launch" (requires SIP disabled).' },
      )
    }
    if (!STANDARD_REACTIONS.has(reaction)) {
      throw new IMessageError(
        `Custom reactions require the imsg Private API bridge. Standard tapbacks: ${[...STANDARD_REACTIONS].join(', ')}.`,
        'private_api_required',
        { suggestion: 'Enable the bridge with "imsg launch" (requires SIP disabled).' },
      )
    }
    await runPreSendHook({ version: 1, platform: 'imessage', action: 'react', target: { id: String(chatId) },  })
    const result = await this.runner(this.binaryPath, [
      'react',
      '--chat-id',
      String(chatId),
      '--reaction',
      reaction,
      '--json',
    ])
    if (result.code !== 0) {
      const detail = result.stderr.trim() || result.stdout.trim() || 'Reaction failed.'
      throw classifyImsgFailure(detail, 'send_failed')
    }
  }

  async watch(
    onMessage: (msg: IMessageMessageSummary) => void,
    options: { chatId?: number; sinceRowId?: number; onError?: (msg: string) => void } = {},
  ): Promise<() => Promise<void>> {
    const params: Record<string, unknown> = { include_reactions: false }
    if (options.chatId !== undefined) params.chat_id = options.chatId
    if (options.sinceRowId !== undefined) params.since_rowid = options.sinceRowId

    const subscription = await this.rpc.subscribe(
      params,
      (raw) => onMessage(summarizeMessage(raw as ImsgMessage)),
      options.onError,
    )
    return async () => {
      await this.rpc.unsubscribe(subscription)
    }
  }

  async getProfile(): Promise<IMessageStatus> {
    return this.getStatus()
  }

  async close(): Promise<void> {
    this.rpc.close()
  }
}
