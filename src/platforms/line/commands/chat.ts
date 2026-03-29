import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { LineClient } from '../client'

async function listAction(options: {
  pretty?: boolean
}): Promise<void> {
  let client: LineClient | undefined
  try {
    client = await new LineClient().login()
    const chats = await client.getChats()
    console.log(formatOutput(chats, options.pretty))
  } catch (error) {
    handleError(error as Error)
  } finally {
    client?.close()
  }
}

export const chatCommand = new Command('chat')
  .description('LINE chat commands')
  .addCommand(
    new Command('list')
      .description('List chat rooms')
      .option('--pretty', 'Pretty print JSON output')
      .action(listAction),
  )
