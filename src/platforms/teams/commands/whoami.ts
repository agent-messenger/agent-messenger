import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { TeamsClient } from '../client'
import { TeamsCredentialManager } from '../credential-manager'

export async function whoamiAction(options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new TeamsCredentialManager()
    const cred = await credManager.getTokenWithExpiry()

    if (!cred) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      return process.exit(1)
    }

    const client = await new TeamsClient().login({ token: cred.token, tokenExpiresAt: cred.tokenExpiresAt })
    const user = await client.testAuth()

    const output = {
      id: user.id,
      displayName: user.displayName,
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
