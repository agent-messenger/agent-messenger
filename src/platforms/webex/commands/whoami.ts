import { Command } from 'commander'
import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'
import { WebexClient } from '../client'

export async function whoamiAction(options: { pretty?: boolean }): Promise<void> {
  try {
    const client = await new WebexClient().login()
    const user = await client.testAuth()

    const output = {
      id: user.id,
      emails: user.emails,
      displayName: user.displayName,
      nickName: user.nickName,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar,
      orgId: user.orgId,
      type: user.type,
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
