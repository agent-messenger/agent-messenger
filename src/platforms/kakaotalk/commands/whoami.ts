import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { withKakaoClient } from './shared'

async function whoamiAction(options: { account?: string; pretty?: boolean }): Promise<void> {
  try {
    const profile = await withKakaoClient(options, (client) => client.getProfile())
    console.log(formatOutput(profile, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const whoamiCommand = new Command('whoami')
  .description('Show current authenticated user')
  .option('--account <id>', 'Use a specific KakaoTalk account')
  .option('--pretty', 'Pretty print JSON output')
  .action(whoamiAction)
