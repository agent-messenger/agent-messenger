import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { DiscordClient } from '../client'
import { DiscordCredentialManager } from '../credential-manager'

export async function listAction(options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new DiscordCredentialManager()
    const config = await credManager.load()

    if (!config.token || !config.current_server) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new DiscordClient(config.token)
    const channels = await client.listChannels(config.current_server)

    const textChannels = channels.filter((ch) => ch.type === 0)

    const output = textChannels.map((ch) => ({
      id: ch.id,
      name: ch.name,
      type: ch.type,
      parent_id: (ch as any).parent_id || null,
      topic: ch.topic || null,
    }))

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export async function infoAction(channelId: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new DiscordCredentialManager()
    const config = await credManager.load()

    if (!config.token) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new DiscordClient(config.token)
    const channel = await client.getChannel(channelId)

    const output = {
      id: channel.id,
      name: channel.name,
      type: channel.type,
      server_id: channel.guild_id,
      topic: channel.topic || null,
      parent_id: (channel as any).parent_id || null,
    }

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export async function historyAction(channelId: string, options: { limit?: number; pretty?: boolean }): Promise<void> {
  try {
    const credManager = new DiscordCredentialManager()
    const config = await credManager.load()

    if (!config.token) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new DiscordClient(config.token)
    const messages = await client.getMessages(channelId, options.limit || 50)

    const output = messages.map((msg) => ({
      id: msg.id,
      author: msg.author.username,
      content: msg.content,
      timestamp: msg.timestamp,
      thread_id: msg.thread_id || null,
    }))

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const channelCommand = new Command('channel')
  .description('Channel commands')
  .addCommand(
    new Command('list')
      .description('List channels in current server')
      .option('--pretty', 'Pretty print JSON output')
      .action(listAction),
  )
  .addCommand(
    new Command('info')
      .description('Get channel info')
      .argument('<channel-id>', 'Channel ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(infoAction),
  )
  .addCommand(
    new Command('history')
      .description('Get channel message history')
      .argument('<channel-id>', 'Channel ID')
      .option('--limit <n>', 'Number of messages to fetch', '50')
      .option('--pretty', 'Pretty print JSON output')
      .action((channelId, options) => {
        historyAction(channelId, {
          limit: parseInt(options.limit, 10),
          pretty: options.pretty,
        })
      }),
  )
