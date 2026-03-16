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
    const result = await client.getDrafts(options.cursor)

    let drafts = result.drafts

    if (options.limit) {
      drafts = drafts.slice(0, options.limit)
    }

    const output = drafts.map((draft) => ({
      id: draft.id,
      channel_id: draft.channel_id,
      text: draft.message?.text || '',
      date_created: draft.date_created,
      date_updated: draft.date_updated,
    }))

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const draftsCommand = new Command('drafts').description('Drafts commands').addCommand(
  new Command('list')
    .description('List message drafts')
    .option('--limit <n>', 'Number of drafts to display')
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
