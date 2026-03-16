import { Command } from 'commander'

import { formatOutput } from '@/shared/utils/output'

import type { BotOption } from './shared'
import { getClient, getCurrentServer } from './shared'

interface MessageResult {
  id?: string
  channel_id?: string
  content?: string
  author?: string
  timestamp?: string
  edited_timestamp?: string
  thread_id?: string | null
  messages?: Array<{
    id: string
    channel_id: string
    content: string
    author: string
    timestamp: string
    thread_id?: string | null
  }>
  deleted?: string
  error?: string
}

export async function sendAction(
  channel: string,
  text: string,
  options: BotOption & { thread?: string },
): Promise<MessageResult> {
  try {
    const client = await getClient(options)
    const serverId = await getCurrentServer(options)
    const channelId = await client.resolveChannel(serverId, channel)
    const message = await client.sendMessage(channelId, text, {
      thread_id: options.thread,
    })

    return {
      id: message.id,
      channel_id: message.channel_id,
      content: message.content,
      author: message.author.username,
      timestamp: message.timestamp,
    }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export async function listAction(channel: string, options: BotOption & { limit?: string }): Promise<MessageResult> {
  try {
    const client = await getClient(options)
    const serverId = await getCurrentServer(options)
    const channelId = await client.resolveChannel(serverId, channel)
    const limit = options.limit ? parseInt(options.limit, 10) : 50
    const messages = await client.getMessages(channelId, limit)

    return {
      messages: messages.map((msg) => ({
        id: msg.id,
        channel_id: msg.channel_id,
        content: msg.content,
        author: msg.author.username,
        timestamp: msg.timestamp,
        thread_id: msg.thread_id || null,
      })),
    }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export async function getAction(channel: string, messageId: string, options: BotOption): Promise<MessageResult> {
  try {
    const client = await getClient(options)
    const serverId = await getCurrentServer(options)
    const channelId = await client.resolveChannel(serverId, channel)
    const message = await client.getMessage(channelId, messageId)

    return {
      id: message.id,
      channel_id: message.channel_id,
      content: message.content,
      author: message.author.username,
      timestamp: message.timestamp,
      edited_timestamp: message.edited_timestamp,
      thread_id: message.thread_id || null,
    }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export async function updateAction(
  channel: string,
  messageId: string,
  text: string,
  options: BotOption,
): Promise<MessageResult> {
  try {
    const client = await getClient(options)
    const serverId = await getCurrentServer(options)
    const channelId = await client.resolveChannel(serverId, channel)
    const message = await client.editMessage(channelId, messageId, text)

    return {
      id: message.id,
      channel_id: message.channel_id,
      content: message.content,
      author: message.author.username,
      timestamp: message.timestamp,
      edited_timestamp: message.edited_timestamp,
    }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export async function deleteAction(
  channel: string,
  messageId: string,
  options: BotOption & { force?: boolean },
): Promise<MessageResult> {
  if (!options.force) {
    return { error: 'Use --force to confirm deletion' }
  }

  try {
    const client = await getClient(options)
    const serverId = await getCurrentServer(options)
    const channelId = await client.resolveChannel(serverId, channel)
    await client.deleteMessage(channelId, messageId)

    return { deleted: messageId }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export async function repliesAction(
  _channel: string,
  threadId: string,
  options: BotOption & { limit?: string },
): Promise<MessageResult> {
  try {
    const client = await getClient(options)
    const limit = options.limit ? parseInt(options.limit, 10) : 50
    const messages = await client.getMessages(threadId, limit)

    return {
      messages: messages.map((msg) => ({
        id: msg.id,
        channel_id: msg.channel_id,
        content: msg.content,
        author: msg.author.username,
        timestamp: msg.timestamp,
        thread_id: msg.thread_id || null,
      })),
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
      .description('Send a message to a channel')
      .argument('<channel>', 'Channel ID or name')
      .argument('<text>', 'Message text')
      .option('--thread <id>', 'Thread ID for replies')
      .option('--bot <id>', 'Use specific bot')
      .option('--server <id>', 'Server ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (channel: string, text: string, opts: BotOption & { thread?: string }) => {
        cliOutput(await sendAction(channel, text, opts), opts.pretty)
      }),
  )
  .addCommand(
    new Command('list')
      .description('List messages in a channel')
      .argument('<channel>', 'Channel ID or name')
      .option('--limit <n>', 'Number of messages to fetch', '50')
      .option('--bot <id>', 'Use specific bot')
      .option('--server <id>', 'Server ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (channel: string, opts: BotOption & { limit?: string }) => {
        cliOutput(await listAction(channel, opts), opts.pretty)
      }),
  )
  .addCommand(
    new Command('get')
      .description('Get a single message')
      .argument('<channel>', 'Channel ID or name')
      .argument('<message-id>', 'Message ID')
      .option('--bot <id>', 'Use specific bot')
      .option('--server <id>', 'Server ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (channel: string, messageId: string, opts: BotOption) => {
        cliOutput(await getAction(channel, messageId, opts), opts.pretty)
      }),
  )
  .addCommand(
    new Command('update')
      .description('Update a message')
      .argument('<channel>', 'Channel ID or name')
      .argument('<message-id>', 'Message ID')
      .argument('<text>', 'New message text')
      .option('--bot <id>', 'Use specific bot')
      .option('--server <id>', 'Server ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (channel: string, messageId: string, text: string, opts: BotOption) => {
        cliOutput(await updateAction(channel, messageId, text, opts), opts.pretty)
      }),
  )
  .addCommand(
    new Command('delete')
      .description('Delete a message')
      .argument('<channel>', 'Channel ID or name')
      .argument('<message-id>', 'Message ID')
      .option('--force', 'Confirm deletion')
      .option('--bot <id>', 'Use specific bot')
      .option('--server <id>', 'Server ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (channel: string, messageId: string, opts: BotOption & { force?: boolean }) => {
        cliOutput(await deleteAction(channel, messageId, opts), opts.pretty)
      }),
  )
  .addCommand(
    new Command('replies')
      .description('Get thread replies')
      .argument('<channel>', 'Channel ID or name')
      .argument('<thread-id>', 'Thread ID')
      .option('--limit <n>', 'Number of replies to fetch', '50')
      .option('--bot <id>', 'Use specific bot')
      .option('--server <id>', 'Server ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (channel: string, threadId: string, opts: BotOption & { limit?: string }) => {
        cliOutput(await repliesAction(channel, threadId, opts), opts.pretty)
      }),
  )
