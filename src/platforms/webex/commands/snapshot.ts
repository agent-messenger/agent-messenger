import { Command } from 'commander'
import { parallelMap } from '@/shared/utils/concurrency'
import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'
import { WebexClient } from '../client'
import { WebexCredentialManager } from '../credential-manager'
import type { WebexSpace } from '../types'

export async function snapshotAction(options: {
  spacesOnly?: boolean
  membersOnly?: boolean
  limit?: number
  pretty?: boolean
}): Promise<void> {
  try {
    const credManager = new WebexCredentialManager()
    const token = await credManager.getToken()
    if (!token) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth login --token <token>" first.' }, options.pretty))
      process.exit(1)
    }

    const client = await new WebexClient().login({ token })
    const messageLimit = options.limit || 20
    const snapshot: Record<string, unknown> = {}

    if (!options.membersOnly) {
      const spaces = await client.listSpaces({ max: 50 })
      snapshot.spaces = spaces.map((s) => ({
        id: s.id,
        title: s.title,
        type: s.type,
        lastActivity: s.lastActivity,
      }))

      if (!options.spacesOnly) {
        const spaceMessages = await parallelMap(
          spaces,
          async (space: WebexSpace) => {
            const messages = await client.listMessages(space.id, { max: messageLimit })
            return messages.map((msg) => ({
              ...msg,
              space_title: space.title,
            }))
          },
          5,
        )

        snapshot.recent_messages = spaceMessages.flat().map((msg) => ({
          space_id: msg.roomId,
          space_title: msg.space_title,
          id: msg.id,
          author: msg.personEmail,
          text: msg.text || msg.markdown || '',
          created: msg.created,
        }))
      }
    }

    if (!options.spacesOnly) {
      // Get members for the first few spaces (avoid massive API calls)
      const spaces = await client.listSpaces({ max: 10 })
      const spaceMembers = await parallelMap(
        spaces,
        async (space: WebexSpace) => {
          const members = await client.listMemberships(space.id, { max: 100 })
          return members.map((m) => ({
            space_id: space.id,
            space_title: space.title,
            personEmail: m.personEmail,
            personDisplayName: m.personDisplayName,
            isModerator: m.isModerator,
          }))
        },
        5,
      )
      snapshot.members = spaceMembers.flat()
    }

    console.log(formatOutput(snapshot, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const snapshotCommand = new Command('snapshot')
  .description('Get comprehensive workspace state for AI agents')
  .option('--spaces-only', 'Include only spaces (exclude messages and members)')
  .option('--members-only', 'Include only members (exclude spaces and messages)')
  .option('--limit <n>', 'Number of recent messages per space (default: 20)', '20')
  .option('--pretty', 'Pretty print JSON output')
  .action(async (options) => {
    await snapshotAction({
      spacesOnly: options.spacesOnly,
      membersOnly: options.membersOnly,
      limit: parseInt(options.limit, 10),
      pretty: options.pretty,
    })
  })
