import { Command } from 'commander'

import { formatOutput } from '@/shared/utils/output'

import type { WorkspaceOption } from './shared'
import { getClient } from './shared'

interface MessageResult {
  recipient_id?: string
  message_id?: string
  error?: string
}

type MessageOptions = WorkspaceOption

export async function sendAction(recipientId: string, text: string, options: MessageOptions): Promise<MessageResult> {
  try {
    const client = await getClient(options)
    const message = await client.sendMessage(recipientId, text)

    return {
      recipient_id: message.recipient_id,
      message_id: message.message_id,
    }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

function cliOutput(result: MessageResult, pretty?: boolean): void {
  console.log(formatOutput(result, pretty))
  if (result.error) process.exit(1)
}

export const messageCommand = new Command('message')
  .description('Message commands')
  .addCommand(
    new Command('send')
      .description('Send a message to an Instagram-scoped user ID')
      .argument('<recipient-id>', 'Instagram-scoped user ID (IGSID)')
      .argument('<text>', 'Message text')
      .option('--workspace <id>', 'Workspace ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (recipientId: string, text: string, opts: MessageOptions) => {
        cliOutput(await sendAction(recipientId, text, opts), opts.pretty)
      }),
  )
