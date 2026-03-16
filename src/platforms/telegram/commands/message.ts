import { Command } from 'commander'
import { handleError } from '../../../shared/utils/error-handler'
import { formatOutput } from '../../../shared/utils/output'
import { withTelegramClient } from './shared'

async function listAction(
  reference: string,
  options: { account?: string; pretty?: boolean; limit?: string },
): Promise<void> {
  try {
    const limit = Number.parseInt(options.limit ?? '20', 10)
    const messages = await withTelegramClient(options, async (client) => client.listMessages(reference, limit))
    console.log(formatOutput(messages, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function sendAction(
  reference: string,
  text: string,
  options: { account?: string; pretty?: boolean },
): Promise<void> {
  try {
    const message = await withTelegramClient(options, async (client) => client.sendMessage(reference, text))
    console.log(formatOutput(message, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const messageCommand = new Command('message')
  .description('Telegram message commands')
  .addCommand(
    new Command('list')
      .description('List recent messages in a chat')
      .argument('<chat>', 'Chat ID, @username, or title')
      .option('--limit <n>', 'Number of messages to fetch', '20')
      .option('--account <id>', 'Use a specific Telegram account')
      .option('--pretty', 'Pretty print JSON output')
      .action(listAction),
  )
  .addCommand(
    new Command('send')
      .description('Send a text message to a chat')
      .argument('<chat>', 'Chat ID, @username, or title')
      .argument('<text>', 'Message text')
      .option('--account <id>', 'Use a specific Telegram account')
      .option('--pretty', 'Pretty print JSON output')
      .action(sendAction),
  )
