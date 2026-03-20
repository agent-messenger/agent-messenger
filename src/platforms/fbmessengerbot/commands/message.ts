import { Command } from 'commander'

import { formatOutput } from '@/shared/utils/output'

import type { WorkspaceOption } from './shared'
import { getClient } from './shared'

interface MessageResult {
  recipient_id?: string
  message_id?: string
  messaging_type?: string
  error?: string
}

type MessageOptions = WorkspaceOption & {
  messagingType?: string
}

const VALID_MESSAGING_TYPES = ['RESPONSE', 'UPDATE', 'MESSAGE_TAG'] as const

export async function sendAction(recipientId: string, text: string, options: MessageOptions): Promise<MessageResult> {
  try {
    const client = await getClient(options)
    const messagingType = options.messagingType ?? 'RESPONSE'

    if (!VALID_MESSAGING_TYPES.includes(messagingType as (typeof VALID_MESSAGING_TYPES)[number])) {
      return { error: 'Invalid --messaging-type value. Use RESPONSE, UPDATE, or MESSAGE_TAG.' }
    }

    const response = await client.sendMessage(
      recipientId,
      text,
      messagingType as 'RESPONSE' | 'UPDATE' | 'MESSAGE_TAG',
    )

    return {
      recipient_id: response.recipient_id,
      message_id: response.message_id,
      messaging_type: messagingType,
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
      .description('Send a text message to a Messenger user')
      .argument('<recipient-id>', 'Page-scoped user ID (PSID)')
      .argument('<text>', 'Message text')
      .option('--messaging-type <type>', 'Messaging type: RESPONSE, UPDATE, or MESSAGE_TAG', 'RESPONSE')
      .option('--workspace <id>', 'Workspace ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (recipientId: string, text: string, opts: { messagingType?: string; workspace?: string; pretty?: boolean }) => {
        cliOutput(await sendAction(recipientId, text, opts), opts.pretty)
      }),
  )
