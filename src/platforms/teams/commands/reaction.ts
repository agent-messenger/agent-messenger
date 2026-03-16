import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { TeamsClient } from '../client'
import { TeamsCredentialManager } from '../credential-manager'

export async function addAction(
  teamId: string,
  channelId: string,
  messageId: string,
  emoji: string,
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
    await client.addReaction(teamId, channelId, messageId, emoji)

    console.log(
      formatOutput(
        {
          success: true,
          team_id: teamId,
          channel_id: channelId,
          message_id: messageId,
          emoji,
        },
        options.pretty,
      ),
    )
  } catch (error) {
    handleError(error as Error)
  }
}

export async function removeAction(
  teamId: string,
  channelId: string,
  messageId: string,
  emoji: string,
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
    await client.removeReaction(teamId, channelId, messageId, emoji)

    console.log(
      formatOutput(
        {
          success: true,
          team_id: teamId,
          channel_id: channelId,
          message_id: messageId,
          emoji,
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
      .argument('<team-id>', 'Team ID')
      .argument('<channel-id>', 'Channel ID')
      .argument('<message-id>', 'Message ID')
      .argument('<emoji>', 'Emoji name')
      .option('--pretty', 'Pretty print JSON output')
      .action(addAction),
  )
  .addCommand(
    new Command('remove')
      .description('Remove emoji reaction from message')
      .argument('<team-id>', 'Team ID')
      .argument('<channel-id>', 'Channel ID')
      .argument('<message-id>', 'Message ID')
      .argument('<emoji>', 'Emoji name')
      .option('--pretty', 'Pretty print JSON output')
      .action(removeAction),
  )
