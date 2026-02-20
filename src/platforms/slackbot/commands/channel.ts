import { Command } from 'commander'
import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'
import { type BotOption, getClient } from './shared'

async function listAction(options: BotOption & { limit?: string }): Promise<void> {
  try {
    const client = await getClient(options)
    const limit = options.limit ? parseInt(options.limit, 10) : undefined
    const channels = await client.listChannels(limit ? { limit } : undefined)

    console.log(formatOutput(channels, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function infoAction(channelInput: string, options: BotOption): Promise<void> {
  try {
    const client = await getClient(options)
    const channel = await client.resolveChannel(channelInput)
    const info = await client.getChannelInfo(channel)

    console.log(formatOutput(info, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const channelCommand = new Command('channel')
  .description('Channel commands')
  .addCommand(
    new Command('list')
      .description('List channels')
      .option('--limit <n>', 'Number of channels to fetch')
      .option('--bot <id>', 'Use specific bot')
      .option('--pretty', 'Pretty print JSON output')
      .action(listAction),
  )
  .addCommand(
    new Command('info')
      .description('Get channel info')
      .argument('<channel>', 'Channel ID or name')
      .option('--bot <id>', 'Use specific bot')
      .option('--pretty', 'Pretty print JSON output')
      .action(infoAction),
  )
