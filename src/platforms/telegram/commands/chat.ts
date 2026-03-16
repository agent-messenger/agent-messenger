import { Command } from 'commander'
import { handleError } from '../../../shared/utils/error-handler'
import { formatOutput } from '../../../shared/utils/output'
import { parseLimitOption, withTelegramClient } from './shared'

async function listAction(options: { account?: string; pretty?: boolean; limit?: string }): Promise<void> {
  try {
    const limit = parseLimitOption(options.limit, 20)

    const chats = await withTelegramClient(options, async (client) => client.listChats(limit))
    console.log(formatOutput(chats, options.pretty))
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
    const chats = await withTelegramClient(options, async (client) => client.searchChats(query, limit))
    console.log(formatOutput(chats, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function getAction(reference: string, options: { account?: string; pretty?: boolean }): Promise<void> {
  try {
    const chat = await withTelegramClient(options, async (client) => client.getChat(reference))
    console.log(formatOutput(chat, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const chatCommand = new Command('chat')
  .description('Telegram chat commands')
  .addCommand(
    new Command('list')
      .description('List chats from the main Telegram chat list')
      .option('--limit <n>', 'Number of chats to fetch', '20')
      .option('--account <id>', 'Use a specific Telegram account')
      .option('--pretty', 'Pretty print JSON output')
      .action(listAction),
  )
  .addCommand(
    new Command('search')
      .description('Search chats by title, username, or known local chat name')
      .argument('<query>', 'Search query')
      .option('--limit <n>', 'Number of chats to fetch', '20')
      .option('--account <id>', 'Use a specific Telegram account')
      .option('--pretty', 'Pretty print JSON output')
      .action(searchAction),
  )
  .addCommand(
    new Command('get')
      .description('Get a single chat by ID, @username, or exact title match')
      .argument('<chat>', 'Chat ID, @username, or title')
      .option('--account <id>', 'Use a specific Telegram account')
      .option('--pretty', 'Pretty print JSON output')
      .action(getAction),
  )
