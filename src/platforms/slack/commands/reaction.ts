import { Command } from 'commander'
import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'
import { SlackClient } from '../client'
import { CredentialManager } from '../credential-manager'

async function addAction(channel: string, ts: string, emoji: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const ws = await credManager.getWorkspace()

    if (!ws) {
      console.log(formatOutput({ error: 'No workspace configured. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new SlackClient(ws.token, ws.cookie)
    channel = await client.resolveChannel(channel)
    await client.addReaction(channel, ts, emoji)

    console.log(
      formatOutput(
        {
          success: true,
          channel,
          ts,
          emoji,
        },
        options.pretty,
      ),
    )
  } catch (error) {
    handleError(error as Error)
  }
}

async function removeAction(channel: string, ts: string, emoji: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const ws = await credManager.getWorkspace()

    if (!ws) {
      console.log(formatOutput({ error: 'No workspace configured. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new SlackClient(ws.token, ws.cookie)
    channel = await client.resolveChannel(channel)
    await client.removeReaction(channel, ts, emoji)

    console.log(
      formatOutput(
        {
          success: true,
          channel,
          ts,
          emoji,
        },
        options.pretty,
      ),
    )
  } catch (error) {
    handleError(error as Error)
  }
}

async function listAction(channel: string, ts: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const ws = await credManager.getWorkspace()

    if (!ws) {
      console.log(formatOutput({ error: 'No workspace configured. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new SlackClient(ws.token, ws.cookie)
    channel = await client.resolveChannel(channel)
    const message = await client.getMessage(channel, ts)

    if (!message) {
      console.log(
        formatOutput(
          {
            error: 'Message not found',
            channel,
            ts,
          },
          options.pretty,
        ),
      )
      process.exit(1)
    }

    const reactions = message.reactions || []

    console.log(
      formatOutput(
        {
          channel,
          ts,
          reactions,
        },
        options.pretty,
      ),
    )
  } catch (error) {
    handleError(error as Error)
  }
}

export const reactionCommand = new Command('reaction')
  .description('Reaction commands')
  .addCommand(
    new Command('add')
      .description('Add emoji reaction to message')
      .argument('<channel>', 'Channel ID or name')
      .argument('<ts>', 'Message timestamp')
      .argument('<emoji>', 'Emoji name (without colons)')
      .option('--pretty', 'Pretty print JSON output')
      .action(addAction),
  )
  .addCommand(
    new Command('remove')
      .description('Remove emoji reaction from message')
      .argument('<channel>', 'Channel ID or name')
      .argument('<ts>', 'Message timestamp')
      .argument('<emoji>', 'Emoji name (without colons)')
      .option('--pretty', 'Pretty print JSON output')
      .action(removeAction),
  )
  .addCommand(
    new Command('list')
      .description('List reactions on a message')
      .argument('<channel>', 'Channel ID or name')
      .argument('<ts>', 'Message timestamp')
      .option('--pretty', 'Pretty print JSON output')
      .action(listAction),
  )
