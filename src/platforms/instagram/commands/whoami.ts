import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { withInstagramClient } from './shared'

export async function whoamiAction(options: { account?: string; pretty?: boolean }): Promise<void> {
  try {
    const profile = await withInstagramClient(options, (client) => client.getProfile())
    console.log(formatOutput(profile, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const whoamiCommand = new Command('whoami')
  .description('Show current authenticated user')
  .option('--account <id>', 'Use a specific Instagram account')
  .option('--pretty', 'Pretty print JSON output')
  .action(whoamiAction)
