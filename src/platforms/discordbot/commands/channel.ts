import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { DiscordBotCredentialManager } from '../credential-manager'
import type { BotOption } from './shared'
import { getClient } from './shared'

interface ActionResult {
  success?: boolean
  error?: string
  channels?: Array<{
    id: string
    name: string
    type: number
  }>
  id?: string
  name?: string
  type?: number
  topic?: string
  guild_id?: string
}

export async function listAction(options: BotOption): Promise<ActionResult> {
  try {
    const serverId =
      options.server || (await (options._credManager ?? new DiscordBotCredentialManager()).getCurrentServer())
    if (!serverId) {
      return { error: 'No server set. Run "server switch <server-id>" first.' }
    }

    const client = await getClient(options)
    const channels = await client.listChannels(serverId)

    const textChannels = channels.filter((c) => c.type === 0)
    return {
      channels: textChannels.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
      })),
    }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export async function infoAction(channel: string, options: BotOption): Promise<ActionResult> {
  try {
    const serverId =
      options.server || (await (options._credManager ?? new DiscordBotCredentialManager()).getCurrentServer())
    if (!serverId) {
      return { error: 'No server set. Run "server switch <server-id>" first.' }
    }

    const client = await getClient(options)
    const channelId = await client.resolveChannel(serverId, channel)
    const channelInfo = await client.getChannel(channelId)

    return {
      id: channelInfo.id,
      name: channelInfo.name,
      type: channelInfo.type,
      topic: channelInfo.topic,
      guild_id: channelInfo.guild_id,
    }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export const channelCommand = new Command('channel')
  .description('Channel commands')
  .addCommand(
    new Command('list')
      .description('List text channels in current server')
      .option('--server <id>', 'Use specific server')
      .option('--bot <id>', 'Use specific bot')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (options: BotOption) => {
        try {
          const result = await listAction(options)
          console.log(formatOutput(result, options.pretty))
        } catch (error) {
          handleError(error as Error)
        }
      }),
  )
  .addCommand(
    new Command('info')
      .description('Get channel info')
      .argument('<channel>', 'Channel ID or name')
      .option('--server <id>', 'Use specific server')
      .option('--bot <id>', 'Use specific bot')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (channelArg: string, options: BotOption) => {
        try {
          const result = await infoAction(channelArg, options)
          console.log(formatOutput(result, options.pretty))
        } catch (error) {
          handleError(error as Error)
        }
      }),
  )
