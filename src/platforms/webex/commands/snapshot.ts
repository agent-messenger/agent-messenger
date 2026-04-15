import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { WebexClient } from '../client'

export async function snapshotAction(options: { full?: boolean; pretty?: boolean }): Promise<void> {
  try {
    const client = await new WebexClient().login()

    const myMemberships = await client.listMyMemberships({ max: 100 })
    const myRoomIds = new Set(myMemberships.map((m) => m.roomId))

    const allSpaces = await client.listSpaces({ max: 100 })
    const spaces = allSpaces.filter((s) => myRoomIds.has(s.id))

    const snapshot: Record<string, any> = {
      spaces: options.full
        ? spaces.map((s) => ({
            id: s.id,
            title: s.title,
            type: s.type,
            lastActivity: s.lastActivity,
          }))
        : spaces.map((s) => ({ id: s.id, title: s.title })),
    }

    if (!options.full) {
      snapshot.hint = "Use 'message list <space>' for messages, 'space info <space>' for space details."
    }

    console.log(formatOutput(snapshot, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const snapshotCommand = new Command('snapshot')
  .description('Get workspace overview for AI agents (brief by default, use --full for comprehensive data)')
  .option('--full', 'Include full space details (verbose)')
  .option('--pretty', 'Pretty print JSON output')
  .action(async (options) => {
    await snapshotAction({
      full: options.full,
      pretty: options.pretty,
    })
  })
