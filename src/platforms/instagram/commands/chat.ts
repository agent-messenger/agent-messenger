import { Command } from 'commander'
import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'
import { parseLimitOption, withInstagramClient } from './shared'

async function listAction(options: { account?: string; pretty?: boolean; limit?: string }): Promise<void> {
  try {
    const limit = parseLimitOption(options.limit, 20)
    const chats = await withInstagramClient(options, (client) => client.listChats(limit))
    console.log(formatOutput(chats, options.pretty))
    process.exit(0)
  } catch (error) {
    handleError(error as Error)
  }
}

async function searchAction(
  query: string,
  options: { account?: string; pretty?: boolean; limit?: string },
): Promise<void> {
  try {
    const limit = parseLimitOption(options.limit, 20)
    const chats = await withInstagramClient(options, (client) => client.searchChats(query, limit))
    console.log(formatOutput(chats, options.pretty))
    process.exit(0)
  } catch (error) {
    handleError(error as Error)
  }
}

export const chatCommand = new Command('chat')
  .description('Instagram chat commands')
  .addCommand(
    new Command('list')
      .description('List DM conversations')
      .option('--limit <n>', 'Number of chats to fetch', '20')
      .option('--account <id>', 'Use a specific Instagram account')
      .option('--pretty', 'Pretty print JSON output')
      .action(listAction),
  )
  .addCommand(
    new Command('search')
      .description('Search DM conversations by name')
      .argument('<query>', 'Search query')
      .option('--limit <n>', 'Number of results to return', '20')
      .option('--account <id>', 'Use a specific Instagram account')
      .option('--pretty', 'Pretty print JSON output')
      .action(searchAction),
  )
