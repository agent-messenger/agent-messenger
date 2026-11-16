import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { LineClient } from '../client'
import { assertMessageId } from '../message-id'

async function listAction(chatId: string, options: { count?: string; pretty?: boolean }): Promise<void> {
  let client: LineClient | undefined
  try {
    client = await new LineClient().login()
    const count = options.count ? Number.parseInt(options.count, 10) : 20
    const messages = await client.getMessages(chatId, { count })
    console.log(formatOutput(messages, options.pretty))
  } catch (error) {
    handleError(error as Error)
  } finally {
    client?.close()
  }
}

async function sendAction(
  chatId: string,
  text: string,
  options: { replyTo?: string; pretty?: boolean },
): Promise<void> {
  let client: LineClient | undefined
  try {
    if (options.replyTo !== undefined) assertMessageId(options.replyTo, '--reply-to value')
    client = await new LineClient().login()
    const result =
      options.replyTo !== undefined
        ? await client.sendMessage(chatId, text, { replyTo: options.replyTo })
        : await client.sendMessage(chatId, text)
    console.log(formatOutput(result, options.pretty))
  } catch (error) {
    handleError(error as Error)
  } finally {
    client?.close()
  }
}

export const messageCommand = new Command('message')
  .description('LINE message commands')
  .addCommand(
    new Command('list')
      .description('List messages in a chat room')
      .argument('<chat-id>', 'Chat room MID')
      .option('-n, --count <number>', 'Number of messages to fetch', '20')
      .option('--pretty', 'Pretty print JSON output')
      .action(listAction),
  )
  .addCommand(
    new Command('send')
      .description('Send a text message to a chat room')
      .argument('<chat-id>', 'Chat room MID')
      .argument('<text>', 'Message text')
      .option('--reply-to <message-id>', 'Send as a quoted reply to this message ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(sendAction),
  )
