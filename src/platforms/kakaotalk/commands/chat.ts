import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { withKakaoClient } from './shared'

async function listAction(options: {
  account?: string
  all?: boolean
  search?: string
  pretty?: boolean
}): Promise<void> {
  try {
    const chats = await withKakaoClient(options, (client) =>
      client.getChats({ all: options.all, search: options.search }),
    )
    console.log(formatOutput(chats, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const chatCommand = new Command('chat')
  .description('KakaoTalk chat commands')
  .addCommand(
    new Command('list')
      .description('List chat rooms')
      .option('--account <id>', 'Use a specific KakaoTalk account')
      .option('--all', 'Fetch all chats (paginate beyond login snapshot)')
      .option('--search <name>', 'Search for a chat by display name')
      .option('--pretty', 'Pretty print JSON output')
      .action(listAction),
  )
