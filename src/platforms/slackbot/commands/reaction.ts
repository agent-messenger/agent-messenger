import { Command } from 'commander'
import { handleError } from '../../../shared/utils/error-handler'
import { formatOutput } from '../../../shared/utils/output'
import { SlackBotClient } from '../client'
import { SlackBotCredentialManager } from '../credential-manager'

async function addAction(
  channel: string,
  timestamp: string,
  emoji: string,
  options: { pretty?: boolean }
): Promise<void> {
  try {
    const credManager = new SlackBotCredentialManager()
    const creds = await credManager.getCredentials()

    if (!creds) {
      console.log(formatOutput({ error: 'No credentials. Run "auth set" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new SlackBotClient(creds.token)
    await client.addReaction(channel, timestamp, emoji)

    console.log(formatOutput({ success: true, channel, timestamp, emoji }, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function removeAction(
  channel: string,
  timestamp: string,
  emoji: string,
  options: { pretty?: boolean }
): Promise<void> {
  try {
    const credManager = new SlackBotCredentialManager()
    const creds = await credManager.getCredentials()

    if (!creds) {
      console.log(formatOutput({ error: 'No credentials. Run "auth set" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new SlackBotClient(creds.token)
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
      .argument('<channel>', 'Channel ID')
      .argument('<timestamp>', 'Message timestamp')
      .argument('<emoji>', 'Emoji name (with or without colons)')
      .option('--pretty', 'Pretty print JSON output')
      .action(addAction)
  )
  .addCommand(
    new Command('remove')
      .description('Remove a reaction from a message')
      .argument('<channel>', 'Channel ID')
      .argument('<timestamp>', 'Message timestamp')
      .argument('<emoji>', 'Emoji name (with or without colons)')
      .option('--pretty', 'Pretty print JSON output')
      .action(removeAction)
  )
