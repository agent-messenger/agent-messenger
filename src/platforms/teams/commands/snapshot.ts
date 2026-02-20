import { Command } from 'commander'
import { parallelMap } from '@/shared/utils/concurrency'
import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'
import { TeamsClient } from '../client'
import { TeamsCredentialManager } from '../credential-manager'
import type { TeamsChannel } from '../types'

export async function snapshotAction(options: {
  channelsOnly?: boolean
  usersOnly?: boolean
  limit?: number
  teamId?: string
  pretty?: boolean
}): Promise<void> {
  try {
    const credManager = new TeamsCredentialManager()
    const cred = await credManager.getTokenWithExpiry()

    if (!cred) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const currentTeam = await credManager.getCurrentTeam()
    const teamId = options.teamId || currentTeam?.team_id
    if (!teamId) {
      console.log(
        formatOutput({ error: 'No current team set. Run "team switch" first or use --team-id.' }, options.pretty),
      )
      process.exit(1)
    }

    const client = new TeamsClient(cred.token, cred.tokenExpiresAt)
    const messageLimit = options.limit || 20

    const snapshot: Record<string, unknown> = {}

    const team = await client.getTeam(teamId)
    snapshot.team = {
      id: team.id,
      name: team.name,
      description: team.description,
    }

    if (!options.usersOnly) {
      const channels = await client.listChannels(teamId)

      snapshot.channels = channels.map((ch) => ({
        id: ch.id,
        name: ch.name,
        type: ch.type,
      }))

      if (!options.channelsOnly) {
        const channelMessages = await parallelMap(
          channels,
          async (channel: TeamsChannel) => {
            const messages = await client.getMessages(teamId, channel.id, messageLimit)
            return messages.map((msg) => ({
              ...msg,
              channel_name: channel.name,
            }))
          },
          5,
        )

        snapshot.recent_messages = channelMessages.flat().map((msg) => ({
          channel_id: msg.channel_id,
          channel_name: msg.channel_name,
          id: msg.id,
          author: msg.author.displayName,
          content: msg.content,
          timestamp: msg.timestamp,
        }))
      }
    }

    if (!options.channelsOnly) {
      const users = await client.listUsers(teamId)

      snapshot.members = users.map((u) => ({
        id: u.id,
        displayName: u.displayName,
        email: u.email || null,
      }))
    }

    console.log(formatOutput(snapshot, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const snapshotCommand = new Command('snapshot')
  .description('Get comprehensive team state for AI agents')
  .option('--channels-only', 'Include only channels (exclude messages and members)')
  .option('--users-only', 'Include only members (exclude channels and messages)')
  .option('--limit <n>', 'Number of recent messages per channel (default: 20)', '20')
  .option('--team-id <id>', 'Team ID (defaults to current team)')
  .option('--pretty', 'Pretty print JSON output')
  .action(async (options) => {
    await snapshotAction({
      channelsOnly: options.channelsOnly,
      usersOnly: options.usersOnly,
      limit: parseInt(options.limit, 10),
      teamId: options.teamId,
      pretty: options.pretty,
    })
  })
