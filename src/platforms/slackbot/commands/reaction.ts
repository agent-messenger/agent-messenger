import { Command } from 'commander'
import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'
import { type BotOption, getClient } from './shared'

async function addAction(channelInput: string, timestamp: string, emoji: string, options: BotOption): Promise<void> {
  try {
    const client = await getClient(options)
    const channel = await client.resolveChannel(channelInput)
    await client.addReaction(channel, timestamp, emoji)

    console.log(formatOutput({ success: true, channel, timestamp, emoji }, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function removeAction(channelInput: string, timestamp: string, emoji: string, options: BotOption): Promise<void> {
  try {
    const client = await getClient(options)
    const channel = await client.resolveChannel(channelInput)
    await client.removeReaction(channel, timestamp, emoji)

    console.log(formatOutput({ success: true, channel, timestamp, emoji }, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const reactionCommand = new Command('reaction')
  .description('Reaction commands')
  .addCommand(
    new Command('add')
      .description('Add a reaction to a message')
      .argument('<channel>', 'Channel ID or name')
      .argument('<timestamp>', 'Message timestamp')
      .argument('<emoji>', 'Emoji name (with or without colons)')
      .option('--bot <id>', 'Use specific bot')
      .option('--pretty', 'Pretty print JSON output')
      .action(addAction),
  )
  .addCommand(
    new Command('remove')
      .description('Remove a reaction from a message')
      .argument('<channel>', 'Channel ID or name')
      .argument('<timestamp>', 'Message timestamp')
      .argument('<emoji>', 'Emoji name (with or without colons)')
      .option('--bot <id>', 'Use specific bot')
      .option('--pretty', 'Pretty print JSON output')
      .action(removeAction),
  )
