import { Command } from 'commander'
import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'
import { parseLimitOption, withInstagramClient } from './shared'

async function listAction(
  threadId: string,
  options: { account?: string; pretty?: boolean; limit?: string },
): Promise<void> {
  try {
    const limit = parseLimitOption(options.limit, 25)
    const messages = await withInstagramClient(options, (client) => client.getMessages(threadId, limit))
    console.log(formatOutput(messages, options.pretty))
    process.exit(0)
  } catch (error) {
    handleError(error as Error)
  }
}

async function sendAction(
  threadId: string,
  text: string,
  options: { account?: string; pretty?: boolean },
): Promise<void> {
  try {
    const message = await withInstagramClient(options, (client) => client.sendMessage(threadId, text))
    console.log(formatOutput(message, options.pretty))
    process.exit(0)
  } catch (error) {
    handleError(error as Error)
  }
}

export const messageCommand = new Command('message')
  .description('Instagram message commands')
  .addCommand(
    new Command('list')
      .description('List messages from a DM thread')
      .argument('<thread-id>', 'Thread ID')
      .option('--limit <n>', 'Number of messages to fetch', '25')
      .option('--account <id>', 'Use a specific Instagram account')
      .option('--pretty', 'Pretty print JSON output')
      .action(listAction),
  )
  .addCommand(
    new Command('send')
      .description('Send a text message to a DM thread')
      .argument('<thread-id>', 'Thread ID')
      .argument('<text>', 'Message text')
      .option('--account <id>', 'Use a specific Instagram account')
      .option('--pretty', 'Pretty print JSON output')
      .action(sendAction),
  )
