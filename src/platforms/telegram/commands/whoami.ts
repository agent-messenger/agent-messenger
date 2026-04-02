import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { withTelegramClient } from './shared'

export async function whoamiAction(options: { account?: string; pretty?: boolean }): Promise<void> {
  try {
    await withTelegramClient(options, async (client) => {
      const status = await client.getAuthStatus()
      const output = {
        account_id: status.account_id,
        phone_number: status.phone_number,
        authenticated: status.authenticated,
        ...status.user && { user: status.user },
      }
      console.log(formatOutput(output, options.pretty))
    })
  } catch (error) {
    handleError(error as Error)
  }
}

export const whoamiCommand = new Command('whoami')
  .description('Show current authenticated user')
  .option('--account <id>', 'Use a specific Telegram account')
  .option('--pretty', 'Pretty print JSON output')
  .action(whoamiAction)
