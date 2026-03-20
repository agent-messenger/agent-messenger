import { Command } from 'commander'

import { formatOutput } from '@/shared/utils/output'

import type { LineBotTextMessage } from '../types'
import type { WorkspaceOption } from './shared'
import { getClient } from './shared'

interface MessageResult {
  success?: boolean
  to?: string
  sent_messages?: Array<{
    id?: string
    quote_token?: string
  }>
  message_count?: number
  error?: string
}

type MessageOptions = WorkspaceOption

export async function sendAction(to: string, text: string, options: MessageOptions): Promise<MessageResult> {
  try {
    const client = await getClient(options)
    const messages = buildTextMessages(text)
    const response = await client.pushMessage(to, messages)

    return {
      success: true,
      to,
      message_count: messages.length,
      sent_messages: response.sentMessages?.map((message) => ({
        id: message.id,
        quote_token: message.quoteToken,
      })),
    }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export async function broadcastAction(text: string, options: MessageOptions): Promise<MessageResult> {
  try {
    const client = await getClient(options)
    const messages = buildTextMessages(text)
    const response = await client.broadcast(messages)

    return {
      success: true,
      message_count: messages.length,
      sent_messages: response.sentMessages?.map((message) => ({
        id: message.id,
        quote_token: message.quoteToken,
      })),
    }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

function buildTextMessages(text: string): LineBotTextMessage[] {
  return [{ type: 'text', text }]
}

function cliOutput(result: MessageResult, pretty?: boolean): void {
  console.log(formatOutput(result, pretty))
  if (result.error) process.exit(1)
}

export const messageCommand = new Command('message')
  .description('Message commands')
  .addCommand(
    new Command('send')
      .description('Send a push message to a user, group, or room')
      .argument('<to>', 'User, group, or room ID')
      .argument('<text>', 'Message text')
      .option('--workspace <id>', 'Workspace ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (to: string, text: string, opts: MessageOptions) => {
        cliOutput(await sendAction(to, text, opts), opts.pretty)
      }),
  )
  .addCommand(
    new Command('broadcast')
      .description('Broadcast a message to all followers')
      .argument('<text>', 'Message text')
      .option('--workspace <id>', 'Workspace ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (text: string, opts: MessageOptions) => {
        cliOutput(await broadcastAction(text, opts), opts.pretty)
      }),
  )
