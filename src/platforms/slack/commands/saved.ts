import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { SlackClient } from '../client'
import { CredentialManager } from '../credential-manager'

async function listAction(options: { limit?: number; cursor?: string; pretty?: boolean }): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const workspace = await credManager.getWorkspace()

    if (!workspace) {
      console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new SlackClient(workspace.token, workspace.cookie)
    const result = await client.getSavedItems(options.cursor)

    let items = result.items

    if (options.limit) {
      items = items.slice(0, options.limit)
    }

    const output = {
      items: items.map((item) => ({
        type: item.type,
        message: {
          ts: item.message.ts,
          text: item.message.text,
          user: item.message.user,
          username: item.message.username,
          thread_ts: item.message.thread_ts,
        },
        channel: item.channel,
        date_created: item.date_created,
      })),
      has_more: result.has_more,
      next_cursor: result.next_cursor,
    }

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const savedCommand = new Command('saved').description('Saved items commands').addCommand(
  new Command('list')
    .description('List saved items')
    .option('--limit <n>', 'Number of items to display')
    .option('--cursor <cursor>', 'Pagination cursor')
    .option('--pretty', 'Pretty print JSON output')
    .action((options) => {
      listAction({
        limit: options.limit ? parseInt(options.limit, 10) : undefined,
        cursor: options.cursor,
        pretty: options.pretty,
      })
    }),
)
