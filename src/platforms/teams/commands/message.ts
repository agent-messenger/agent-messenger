import { Command } from 'commander'
import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'
import { TeamsClient } from '../client'
import { TeamsCredentialManager } from '../credential-manager'
import type { TeamsMessage } from '../types'

export async function sendAction(
  teamId: string,
  channelId: string,
  content: string,
  options: { pretty?: boolean },
): Promise<void> {
  try {
    const credManager = new TeamsCredentialManager()
    const cred = await credManager.getTokenWithExpiry()

    if (!cred) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new TeamsClient(cred.token, cred.tokenExpiresAt)
    const message = await client.sendMessage(teamId, channelId, content)

    const output = {
      id: message.id,
      content: message.content,
      author: message.author.displayName,
      timestamp: message.timestamp,
    }

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export async function listAction(
  teamId: string,
  channelId: string,
  options: { limit?: number; pretty?: boolean },
): Promise<void> {
  try {
    const credManager = new TeamsCredentialManager()
    const cred = await credManager.getTokenWithExpiry()

    if (!cred) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new TeamsClient(cred.token, cred.tokenExpiresAt)
    const limit = options.limit || 50
    const messages = await client.getMessages(teamId, channelId, limit)

    const output = messages.map((msg: TeamsMessage) => ({
      id: msg.id,
      content: msg.content,
      author: msg.author.displayName,
      timestamp: msg.timestamp,
    }))

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export async function getAction(
  teamId: string,
  channelId: string,
  messageId: string,
  options: { pretty?: boolean },
): Promise<void> {
  try {
    const credManager = new TeamsCredentialManager()
    const cred = await credManager.getTokenWithExpiry()

    if (!cred) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new TeamsClient(cred.token, cred.tokenExpiresAt)
    const message = await client.getMessage(teamId, channelId, messageId)

    if (!message) {
      console.log(formatOutput({ error: `Message not found: ${messageId}` }, options.pretty))
      process.exit(1)
    }

    const output = {
      id: message.id,
      content: message.content,
      author: message.author.displayName,
      timestamp: message.timestamp,
    }

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export async function deleteAction(
  teamId: string,
  channelId: string,
  messageId: string,
  options: { force?: boolean; pretty?: boolean },
): Promise<void> {
  try {
    const credManager = new TeamsCredentialManager()
    const cred = await credManager.getTokenWithExpiry()

    if (!cred) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    if (!options.force) {
      console.log(formatOutput({ warning: 'Use --force to confirm deletion', messageId }, options.pretty))
      process.exit(0)
    }

    const client = new TeamsClient(cred.token, cred.tokenExpiresAt)
    await client.deleteMessage(teamId, channelId, messageId)

    console.log(formatOutput({ deleted: messageId }, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const messageCommand = new Command('message')
  .description('Message commands')
  .addCommand(
    new Command('send')
      .description('Send message to channel')
      .argument('<team-id>', 'Team ID')
      .argument('<channel-id>', 'Channel ID')
      .argument('<content>', 'Message content')
      .option('--pretty', 'Pretty print JSON output')
      .action(sendAction),
  )
  .addCommand(
    new Command('list')
      .description('List messages from channel')
      .argument('<team-id>', 'Team ID')
      .argument('<channel-id>', 'Channel ID')
      .option('--limit <n>', 'Number of messages to retrieve', '50')
      .option('--pretty', 'Pretty print JSON output')
      .action((teamId: string, channelId: string, options: any) => {
        return listAction(teamId, channelId, {
          limit: parseInt(options.limit, 10),
          pretty: options.pretty,
        })
      }),
  )
  .addCommand(
    new Command('get')
      .description('Get a single message by ID')
      .argument('<team-id>', 'Team ID')
      .argument('<channel-id>', 'Channel ID')
      .argument('<message-id>', 'Message ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(getAction),
  )
  .addCommand(
    new Command('delete')
      .description('Delete message')
      .argument('<team-id>', 'Team ID')
      .argument('<channel-id>', 'Channel ID')
      .argument('<message-id>', 'Message ID')
      .option('--force', 'Skip confirmation')
      .option('--pretty', 'Pretty print JSON output')
      .action(deleteAction),
  )
