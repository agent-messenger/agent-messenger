import { Command } from 'commander'
import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'
import { WebexClient } from '../client'

export async function snapshotAction(options: {
  pretty?: boolean
}): Promise<void> {
  try {
    const client = await new WebexClient().login()

    const myMemberships = await client.listMyMemberships({ max: 100 })
    const myRoomIds = new Set(myMemberships.map((m) => m.roomId))

    const allSpaces = await client.listSpaces({ max: 100 })
    const spaces = allSpaces.filter((s) => myRoomIds.has(s.id))

    const snapshot = {
      spaces: spaces.map((s) => ({
        id: s.id,
        title: s.title,
        type: s.type,
        lastActivity: s.lastActivity,
      })),
    }

    console.log(formatOutput(snapshot, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const snapshotCommand = new Command('snapshot')
  .description('Get workspace spaces overview for AI agents')
  .option('--pretty', 'Pretty print JSON output')
  .action(async (options) => {
    await snapshotAction({
      pretty: options.pretty,
    })
  })
