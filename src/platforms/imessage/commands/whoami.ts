import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { withIMessageClient } from './shared'

async function whoamiAction(options: { account?: string; pretty?: boolean }): Promise<void> {
  try {
    const profile = await withIMessageClient(options, (client) => client.getProfile())
    console.log(formatOutput(profile, options.pretty))
    process.exit(0)
  } catch (error) {
    handleError(error as Error)
  }
}

export const whoamiCommand = new Command('whoami')
  .description('Show the active iMessage server and account')
  .option('--account <id>', 'Use a specific iMessage account')
  .option('--pretty', 'Pretty print JSON output')
  .action(whoamiAction)
