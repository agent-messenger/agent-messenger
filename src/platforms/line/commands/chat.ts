import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { LineClient } from '../client'

async function listAction(options: {
  limit?: string
  pretty?: boolean
}): Promise<void> {
  let client: LineClient | undefined
  try {
    client = await new LineClient().login()
    const limit = options.limit ? Number.parseInt(options.limit, 10) : 50
    const chats = await client.getChats({ limit })
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
      .description('List conversations (DMs and groups)')
      .option('-n, --limit <number>', 'Max conversations to return', '50')
      .option('--pretty', 'Pretty print JSON output')
      .action(listAction),
  )
