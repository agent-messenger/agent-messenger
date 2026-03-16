import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { DiscordClient } from '../client'
import { DiscordCredentialManager } from '../credential-manager'
import type { DiscordDMChannel } from '../types'

export async function listAction(options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new DiscordCredentialManager()
    const config = await credManager.load()

    if (!config.token) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new DiscordClient(config.token)
    const channels = await client.listDMChannels()

    const output = channels.map((channel: DiscordDMChannel) => ({
      id: channel.id,
      type: channel.type === 1 ? 'DM' : 'Group DM',
      name: channel.name || null,
      recipients: channel.recipients.map((user) => ({
        id: user.id,
        username: user.username,
      })),
      last_message_id: channel.last_message_id || null,
    }))

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export async function createAction(userId: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new DiscordCredentialManager()
    const config = await credManager.load()

    if (!config.token) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new DiscordClient(config.token)
    const channel = await client.createDM(userId)

    const output = {
      id: channel.id,
      type: channel.type === 1 ? 'DM' : 'Group DM',
      name: channel.name || null,
      recipients: channel.recipients.map((user) => ({
        id: user.id,
        username: user.username,
      })),
    }

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const dmCommand = new Command('dm')
  .description('DM channel commands')
  .addCommand(
    new Command('list')
      .description('List DM channels')
      .option('--pretty', 'Pretty print JSON output')
      .action(listAction),
  )
  .addCommand(
    new Command('create')
      .description('Create a DM channel')
      .argument('<user-id>', 'User ID to create DM with')
      .option('--pretty', 'Pretty print JSON output')
      .action(createAction),
  )
