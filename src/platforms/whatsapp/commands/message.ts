import { Command } from 'commander'
import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'
import { parseLimitOption, withWhatsAppClient } from './shared'

async function listAction(
  chat: string,
  options: { account?: string; pretty?: boolean; limit?: string },
): Promise<void> {
  try {
    const limit = parseLimitOption(options.limit, 25)
    const messages = await withWhatsAppClient(options, (client) => client.getMessages(chat, limit))
    console.log(formatOutput(messages, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function sendAction(
  chat: string,
  text: string,
  options: { account?: string; pretty?: boolean },
): Promise<void> {
  try {
    const message = await withWhatsAppClient(options, (client) => client.sendMessage(chat, text))
    console.log(formatOutput(message, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function reactAction(
  chat: string,
  messageId: string,
  emoji: string,
  options: { account?: string; pretty?: boolean },
): Promise<void> {
  try {
    await withWhatsAppClient(options, (client) => client.sendReaction(chat, messageId, emoji))
    console.log(formatOutput({ success: true, chat, message_id: messageId, emoji }, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const messageCommand = new Command('message')
  .description('WhatsApp message commands')
  .addCommand(
    new Command('list')
      .description('List messages from a chat (JID or phone number)')
      .argument('<chat>', 'Chat JID (e.g. 12025551234@s.whatsapp.net) or phone number')
      .option('--limit <n>', 'Number of messages to fetch', '25')
      .option('--account <id>', 'Use a specific WhatsApp account')
      .option('--pretty', 'Pretty print JSON output')
      .action(listAction),
  )
  .addCommand(
    new Command('send')
      .description('Send a text message to a chat')
      .argument('<chat>', 'Chat JID or phone number')
      .argument('<text>', 'Message text')
      .option('--account <id>', 'Use a specific WhatsApp account')
      .option('--pretty', 'Pretty print JSON output')
      .action(sendAction),
  )
  .addCommand(
    new Command('react')
      .description('React to a message with an emoji')
      .argument('<chat>', 'Chat JID or phone number')
      .argument('<message-id>', 'Message ID to react to')
      .argument('<emoji>', 'Emoji reaction')
      .option('--account <id>', 'Use a specific WhatsApp account')
      .option('--pretty', 'Pretty print JSON output')
      .action(reactAction),
  )
