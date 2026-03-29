import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { LineClient } from '../client'

async function listAction(options: { pretty?: boolean }): Promise<void> {
  let client: LineClient | undefined
  try {
    client = await new LineClient().login()
    const friends = await client.getFriends()
    console.log(formatOutput(friends, options.pretty))
  } catch (error) {
    handleError(error as Error)
  } finally {
    client?.close()
  }
}

export const friendCommand = new Command('friend')
  .description('LINE friend commands')
  .addCommand(
    new Command('list')
      .description('List your LINE friends')
      .option('--pretty', 'Pretty print JSON output')
      .action(listAction),
  )
