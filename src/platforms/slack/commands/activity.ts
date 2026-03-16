import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { SlackClient } from '../client'
import { CredentialManager } from '../credential-manager'

async function listAction(options: {
  pretty?: boolean
  unread?: boolean
  limit?: string
  types?: string
}): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const ws = await credManager.getWorkspace()

    if (!ws) {
      console.log(formatOutput({ error: 'No workspace configured. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new SlackClient(ws.token, ws.cookie)

    const mode = options.unread ? 'priority_unreads_v1' : 'chrono_reads_and_unreads'
    const limit = options.limit ? parseInt(options.limit, 10) : 20

    const items = await client.getActivityFeed({
      types: options.types,
      mode,
      limit,
    })

    console.log(
      formatOutput(
        {
          items,
          count: items.length,
        },
        options.pretty,
      ),
    )
  } catch (error) {
    handleError(error as Error)
  }
}

export const activityCommand = new Command('activity')
  .description('Activity feed commands')
  .addCommand(
    new Command('list')
      .description('List activity feed items')
      .option('--pretty', 'Pretty print JSON output')
      .option('--unread', 'Show only unread activity')
      .option('--limit <number>', 'Number of items to return (default: 20)')
      .option(
        '--types <types>',
        'Filter by activity types (comma-separated: thread_reply,message_reaction,at_user,at_channel,keyword)',
      )
      .action(listAction),
  )
