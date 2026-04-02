import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { LineClient } from '../client'

async function whoamiAction(options: { pretty?: boolean }): Promise<void> {
  let client: LineClient | undefined
  try {
    client = await new LineClient().login()
    const profile = await client.getProfile()
    console.log(formatOutput(profile, options.pretty))
  } catch (error) {
    handleError(error as Error)
  } finally {
    client?.close()
  }
}

export const whoamiCommand = new Command('whoami')
  .description('Show current authenticated user')
  .option('--pretty', 'Pretty print JSON output')
  .action(whoamiAction)
