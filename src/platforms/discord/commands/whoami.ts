import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { DiscordClient } from '../client'
import { DiscordCredentialManager } from '../credential-manager'

export async function whoamiAction(options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new DiscordCredentialManager()
    const config = await credManager.load()

    if (!config.token) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      return process.exit(1)
    }

    const client = await new DiscordClient().login({ token: config.token })
    const user = await client.testAuth()

    const output = {
      id: user.id,
      username: user.username,
      global_name: user.global_name,
      avatar: user.avatar,
      bot: user.bot,
    }
    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const whoamiCommand = new Command('whoami')
  .description('Show current authenticated user')
  .option('--pretty', 'Pretty print JSON output')
  .action(whoamiAction)
