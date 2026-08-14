import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { TeamsClient } from '../client'
import { TeamsCredentialManager } from '../credential-manager'
import { resolveFormat } from './format'

export async function listAction(options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new TeamsCredentialManager()
    const cred = await credManager.getTokenWithExpiry()

    if (!cred) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = await new TeamsClient().login({
      token: cred.token,
      tokenExpiresAt: cred.tokenExpiresAt,
      accountType: cred.accountType,
      region: cred.region,
    })
    const chats = await client.listChats()

    const output = chats.map((chat) => ({
      id: chat.id,
      type: chat.type,
      topic: chat.topic,
      last_message: chat.last_message,
      last_message_at: chat.last_message_at,
    }))

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export async function historyAction(chatId: string, options: { limit?: number; pretty?: boolean }): Promise<void> {
  try {
    const credManager = new TeamsCredentialManager()
    const cred = await credManager.getTokenWithExpiry()

    if (!cred) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = await new TeamsClient().login({
      token: cred.token,
      tokenExpiresAt: cred.tokenExpiresAt,
      accountType: cred.accountType,
      region: cred.region,
    })
    const limit = options.limit && options.limit > 0 ? options.limit : 50
    const messages = await client.getChatMessages(chatId, limit)

    const output = messages.map((msg) => ({
      id: msg.id,
      author: msg.author.displayName,
      content: msg.content,
      timestamp: msg.timestamp,
    }))

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export async function sendAction(
  chatId: string,
  content: string,
  options: { pretty?: boolean; format?: string },
): Promise<void> {
  const format = resolveFormat(options.format, options.pretty)

  try {
    const credManager = new TeamsCredentialManager()
    const cred = await credManager.getTokenWithExpiry()

    if (!cred) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = await new TeamsClient().login({
      token: cred.token,
      tokenExpiresAt: cred.tokenExpiresAt,
      accountType: cred.accountType,
      region: cred.region,
    })
    const message = await client.sendChatMessage(chatId, content, format)

    const output = {
      id: message.id,
      content: message.content,
      timestamp: message.timestamp,
    }

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export async function editAction(
  chatId: string,
  messageId: string,
  content: string,
  options: { pretty?: boolean; format?: string },
): Promise<void> {
  const format = resolveFormat(options.format, options.pretty)

  try {
    const credManager = new TeamsCredentialManager()
    const cred = await credManager.getTokenWithExpiry()

    if (!cred) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = await new TeamsClient().login({
      token: cred.token,
      tokenExpiresAt: cred.tokenExpiresAt,
      accountType: cred.accountType,
      region: cred.region,
    })
    const message = await client.editChatMessage(chatId, messageId, content, format)

    const output = {
      id: message.id,
      content: message.content,
      timestamp: message.timestamp,
    }

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const chatCommand = new Command('chat')
  .description('Chat commands (1:1, group, and self chats)')
  .addCommand(
    new Command('list')
      .description('List 1:1, group, and self chats')
      .option('--pretty', 'Pretty print JSON output')
      .action(listAction),
  )
  .addCommand(
    new Command('history')
      .description('Get chat message history')
      .argument('<chat-id>', 'Chat ID')
      .option('--limit <n>', 'Number of messages to fetch', '50')
      .option('--pretty', 'Pretty print JSON output')
      .action((chatId, options) => {
        return historyAction(chatId, {
          limit: parseInt(options.limit, 10),
          pretty: options.pretty,
        })
      }),
  )
  .addCommand(
    new Command('send')
      .description('Send a message to a chat')
      .argument('<chat-id>', 'Chat ID')
      .argument('<content>', 'Message content')
      .option('--format <format>', 'Message format: text, markdown, or html', 'text')
      .option('--pretty', 'Pretty print JSON output')
      .action(sendAction),
  )
  .addCommand(
    new Command('edit')
      .description('Edit a message in a chat (your own messages only)')
      .argument('<chat-id>', 'Chat ID')
      .argument('<message-id>', 'Message ID')
      .argument('<content>', 'New message content')
      .option('--format <format>', 'Message format: text, markdown, or html', 'text')
      .option('--pretty', 'Pretty print JSON output')
      .action(editAction),
  )
