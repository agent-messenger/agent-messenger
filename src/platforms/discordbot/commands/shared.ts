import { formatOutput } from '@/shared/utils/output'

import { DiscordBotClient } from '../client'
import { DiscordBotCredentialManager } from '../credential-manager'
import type { DiscordFile, DiscordMessage } from '../types'

export interface BotOption {
  bot?: string
  server?: string
  pretty?: boolean
  _credManager?: DiscordBotCredentialManager
}

export interface SendTargetOption extends BotOption {
  thread?: string
  reply?: string
}

export async function getClient(options: BotOption): Promise<DiscordBotClient> {
  const credManager = options._credManager ?? new DiscordBotCredentialManager()
  const creds = await credManager.getCredentials(options.bot)

  if (!creds) {
    console.log(formatOutput({ error: 'No credentials. Run "auth set <token>" first.' }, options.pretty))
    process.exit(1)
  }

  return new DiscordBotClient().login({ token: creds.token })
}

export async function getCurrentServer(options: BotOption): Promise<string> {
  if (options.server) return options.server

  const credManager = options._credManager ?? new DiscordBotCredentialManager()
  const serverId = await credManager.getCurrentServer()

  if (!serverId) {
    console.log(formatOutput({ error: 'No server set. Run "server switch <server-id>" first.' }, options.pretty))
    process.exit(1)
  }

  return serverId
}

export async function resolveSendTarget(
  client: DiscordBotClient,
  serverId: string,
  channel: string,
  thread?: string,
): Promise<{ channelId: string; threadId?: string }> {
  const channelId = await client.resolveChannel(serverId, channel)
  if (!thread) return { channelId }
  if (/^\d+$/.test(thread)) return { channelId, threadId: thread }
  return { channelId, threadId: await client.resolveThread(serverId, channelId, thread) }
}

export interface AttachmentOutput {
  id: string
  filename: string
  size: number
  url: string
  content_type: string | null
}

export function toAttachmentOutput(files: DiscordFile[] | undefined): AttachmentOutput[] {
  return (files ?? []).map((file) => ({
    id: file.id,
    filename: file.filename,
    size: file.size,
    url: file.url,
    content_type: file.content_type ?? null,
  }))
}

export interface MessageOutput {
  id: string
  channel_id: string
  content: string
  author: string
  timestamp: string
  edited_timestamp?: string
  thread_id: string | null
  attachments: AttachmentOutput[]
  reactions: { emoji: { id: string | null; name: string }; count: number; me: boolean }[]
}

export function toMessageOutput(message: DiscordMessage): MessageOutput {
  const output: MessageOutput = {
    id: message.id,
    channel_id: message.channel_id,
    content: message.content,
    author: message.author.username,
    timestamp: message.timestamp,
    thread_id: message.thread?.id ?? null,
    attachments: toAttachmentOutput(message.attachments),
    reactions: (message.reactions ?? []).map((reaction) => ({
      emoji: { id: reaction.emoji.id ?? null, name: reaction.emoji.name },
      count: reaction.count,
      me: reaction.me ?? false,
    })),
  }
  if (message.edited_timestamp !== undefined) output.edited_timestamp = message.edited_timestamp
  return output
}
