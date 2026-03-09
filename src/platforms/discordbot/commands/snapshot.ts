import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { DiscordBotCredentialManager } from '../credential-manager'
import type { BotOption } from './shared'
import { getClient } from './shared'

interface SnapshotOption extends BotOption {
  channelsOnly?: boolean
  usersOnly?: boolean
  limit?: number
}

interface SnapshotResult {
  server_id?: string
  channels?: Array<{
    id: string
    name: string
    type?: number
    messages?: Array<{
      id: string
      author: string
      content: string
      timestamp: string
    }>
  }>
  users?: Array<{
    id: string
    username: string
    global_name: string | null
  }>
  error?: string
}

export async function snapshotAction(options: SnapshotOption): Promise<SnapshotResult> {
  try {
    const serverId =
      options.server || (await (options._credManager ?? new DiscordBotCredentialManager()).getCurrentServer())
    if (!serverId) {
      return { error: 'No server set. Run "server switch <server-id>" first.' }
    }

    const client = await getClient(options)
    const limit = options.limit ?? 5

    if (options.usersOnly) {
      const users = await client.listUsers(serverId)
      return {
        server_id: serverId,
        users: users.map((u) => ({
          id: u.id,
          username: u.username,
          global_name: u.global_name ?? null,
        })),
      }
    }

    const allChannels = await client.listChannels(serverId)
    const textChannels = allChannels.filter((ch) => ch.type === 0)

    if (options.channelsOnly) {
      return {
        server_id: serverId,
        channels: textChannels.map((ch) => ({
          id: ch.id,
          name: ch.name,
          type: ch.type,
        })),
      }
    }

    const channelsWithMessages = await Promise.all(
      textChannels.map(async (ch) => {
        const messages = await client.getMessages(ch.id, limit)
        return {
          id: ch.id,
          name: ch.name,
          messages: messages.map((msg) => ({
            id: msg.id,
            author: msg.author.username,
            content: msg.content,
            timestamp: msg.timestamp,
          })),
        }
      }),
    )

    return {
      server_id: serverId,
      channels: channelsWithMessages,
    }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export const snapshotCommand = new Command('snapshot')
  .description('Server overview for AI agent context')
  .option('--channels-only', 'List channels only, skip messages')
  .option('--users-only', 'List users only')
  .option('--limit <n>', 'Messages per channel (default: 5)', '5')
  .option('--server <id>', 'Use specific server')
  .option('--bot <id>', 'Use specific bot')
  .option('--pretty', 'Pretty print JSON output')
  .action(async (options) => {
    try {
      const result = await snapshotAction({
        ...options,
        limit: parseInt(options.limit, 10),
      })
      console.log(formatOutput(result, options.pretty))
    } catch (error) {
      handleError(error as Error)
    }
  })
