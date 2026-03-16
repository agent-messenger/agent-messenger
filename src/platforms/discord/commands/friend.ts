import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { DiscordClient } from '../client'
import { DiscordCredentialManager } from '../credential-manager'

async function listAction(options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new DiscordCredentialManager()
    const config = await credManager.load()

    if (!config.token) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new DiscordClient(config.token)
    const relationships = await client.getRelationships()

    const output = relationships.map((rel) => ({
      user: {
        id: rel.user.id,
        username: rel.user.username,
        global_name: rel.user.global_name,
      },
      type: rel.type,
      nickname: rel.nickname || null,
    }))

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const friendCommand = new Command('friend')
  .description('Friend commands')
  .addCommand(
    new Command('list')
      .description('List all relationships')
      .option('--pretty', 'Pretty print JSON output')
      .action(listAction),
  )
