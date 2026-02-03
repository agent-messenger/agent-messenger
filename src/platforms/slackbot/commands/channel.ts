import { Command } from 'commander'
import { handleError } from '../../../shared/utils/error-handler'
import { formatOutput } from '../../../shared/utils/output'
import { SlackBotClient } from '../client'
import { SlackBotCredentialManager } from '../credential-manager'

async function listAction(options: { limit?: string; pretty?: boolean }): Promise<void> {
  try {
    const credManager = new SlackBotCredentialManager()
    const creds = await credManager.getCredentials()

    if (!creds) {
      console.log(formatOutput({ error: 'No credentials. Run "auth set" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new SlackBotClient(creds.token)
    const limit = options.limit ? parseInt(options.limit, 10) : undefined
    const channels = await client.listChannels(limit ? { limit } : undefined)

    console.log(formatOutput(channels, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function infoAction(channel: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new SlackBotCredentialManager()
    const creds = await credManager.getCredentials()

    if (!creds) {
      console.log(formatOutput({ error: 'No credentials. Run "auth set" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new SlackBotClient(creds.token)
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
      .option('--pretty', 'Pretty print JSON output')
      .action(listAction)
  )
  .addCommand(
    new Command('info')
      .description('Get channel info')
      .argument('<channel>', 'Channel ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(infoAction)
  )
