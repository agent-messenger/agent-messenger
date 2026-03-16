import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import type { BotOption } from './shared'
import { getClient, getCurrentServer } from './shared'

interface ActionResult {
  success?: boolean
  error?: string
  channel?: string
  messageId?: string
  emoji?: string
}

export async function addAction(
  channel: string,
  messageId: string,
  emoji: string,
  options: BotOption,
): Promise<ActionResult> {
  try {
    const serverId = await getCurrentServer(options)
    const client = await getClient(options)
    const channelId = await client.resolveChannel(serverId, channel)
    await client.addReaction(channelId, messageId, emoji)

    return { success: true, channel: channelId, messageId, emoji }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export async function removeAction(
  channel: string,
  messageId: string,
  emoji: string,
  options: BotOption,
): Promise<ActionResult> {
  try {
    const serverId = await getCurrentServer(options)
    const client = await getClient(options)
    const channelId = await client.resolveChannel(serverId, channel)
    await client.removeReaction(channelId, messageId, emoji)

    return { success: true, channel: channelId, messageId, emoji }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export const reactionCommand = new Command('reaction')
  .description('Reaction commands')
  .addCommand(
    new Command('add')
      .description('Add a reaction to a message')
      .argument('<channel>', 'Channel ID or name')
      .argument('<message-id>', 'Message ID')
      .argument('<emoji>', 'Emoji name or unicode')
      .option('--server <id>', 'Use specific server')
      .option('--bot <id>', 'Use specific bot')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (channelArg: string, messageIdArg: string, emojiArg: string, options: BotOption) => {
        try {
          const result = await addAction(channelArg, messageIdArg, emojiArg, options)
          console.log(formatOutput(result, options.pretty))
        } catch (error) {
          handleError(error as Error)
        }
      }),
  )
  .addCommand(
    new Command('remove')
      .description('Remove a reaction from a message')
      .argument('<channel>', 'Channel ID or name')
      .argument('<message-id>', 'Message ID')
      .argument('<emoji>', 'Emoji name or unicode')
      .option('--server <id>', 'Use specific server')
      .option('--bot <id>', 'Use specific bot')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (channelArg: string, messageIdArg: string, emojiArg: string, options: BotOption) => {
        try {
          const result = await removeAction(channelArg, messageIdArg, emojiArg, options)
          console.log(formatOutput(result, options.pretty))
        } catch (error) {
          handleError(error as Error)
        }
      }),
  )
