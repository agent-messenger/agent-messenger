import { Command } from 'commander'
import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'
import { SlackClient } from '../client'
import { CredentialManager } from '../credential-manager'

async function listAction(options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const workspace = await credManager.getWorkspace()

    if (!workspace) {
      console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new SlackClient(workspace.token, workspace.cookie)
    const sections = await client.getChannelSections()

    const output = sections.map((section) => ({
      id: section.id,
      name: section.name,
      channel_count: section.channel_ids.length,
      channel_ids: section.channel_ids,
      date_created: section.date_created,
      date_updated: section.date_updated,
    }))

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

const sections = new Command('sections').description('Manage Slack channel sections (sidebar folders)')

sections
  .command('list')
  .description('List all channel sections')
  .option('--pretty', 'Pretty print output')
  .action(listAction)

export const sectionsCommand = sections
