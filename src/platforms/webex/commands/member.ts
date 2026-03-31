import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { WebexClient } from '../client'

export async function listAction(
  spaceId: string,
  options: { limit?: number; pretty?: boolean },
): Promise<void> {
  try {
    const client = await new WebexClient().login()
    const members = await client.listMemberships(spaceId, { max: options.limit })

    const output = members.map((m) => ({
      id: m.id,
      personId: m.personId,
      personEmail: m.personEmail,
      personDisplayName: m.personDisplayName,
      isModerator: m.isModerator,
      created: m.created,
    }))

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const memberCommand = new Command('member')
  .description('Member commands')
  .addCommand(
    new Command('list')
      .description('List members of a space')
      .argument('<space-id>', 'Space ID')
      .option('--limit <n>', 'Number of members to retrieve', '100')
      .option('--pretty', 'Pretty print JSON output')
      .action((spaceId, options) =>
        listAction(spaceId, {
          limit: parseInt(options.limit, 10),
          pretty: options.pretty,
        }),
      ),
  )
