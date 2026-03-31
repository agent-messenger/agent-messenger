import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { WebexClient } from '../client'

export async function listAction(options: {
  type?: string
  limit?: number
  pretty?: boolean
}): Promise<void> {
  try {
    const client = await new WebexClient().login()
    const spaces = await client.listSpaces({ type: options.type, max: options.limit })
    const output = spaces.map((s) => ({
      id: s.id,
      title: s.title,
      type: s.type,
      lastActivity: s.lastActivity,
      created: s.created,
    }))
    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export async function infoAction(
  spaceId: string,
  options: { pretty?: boolean },
): Promise<void> {
  try {
    const client = await new WebexClient().login()
    const space = await client.getSpace(spaceId)
    const output = {
      id: space.id,
      title: space.title,
      type: space.type,
      isLocked: space.isLocked,
      teamId: space.teamId || null,
      lastActivity: space.lastActivity,
      created: space.created,
      creatorId: space.creatorId,
    }
    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const spaceCommand = new Command('space')
  .description('Space commands')
  .addCommand(
    new Command('list')
      .description('List spaces')
      .option('--type <type>', 'Filter by type (group or direct)')
      .option('--limit <n>', 'Number of spaces to retrieve', '50')
      .option('--pretty', 'Pretty print JSON output')
      .action((options) =>
        listAction({
          type: options.type,
          limit: parseInt(options.limit, 10),
          pretty: options.pretty,
        }),
      ),
  )
  .addCommand(
    new Command('info')
      .description('Get space details')
      .argument('<space-id>', 'Space ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(infoAction),
  )
