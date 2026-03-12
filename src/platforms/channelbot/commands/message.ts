import { Command } from 'commander'

import { formatOutput } from '@/shared/utils/output'

import { ChannelBotClient } from '../client'
import type { WorkspaceOption } from './shared'
import { getClient, getDefaultBotName } from './shared'

interface MessageResult {
  id?: string
  chat_id?: string
  chat_type?: string
  person_type?: string
  person_id?: string
  created_at?: number
  plain_text?: string
  blocks?: Array<{ type: string; value: string }>
  messages?: Array<{
    id: string
    chat_id?: string
    chat_type?: string
    person_type?: string
    person_id?: string
    created_at?: number
    plain_text?: string
  }>
  error?: string
}

type MessageOptions = WorkspaceOption & {
  bot?: string
  type?: string
  limit?: string
  sort?: string
  since?: string
}

export async function sendAction(target: string, text: string, options: MessageOptions): Promise<MessageResult> {
  try {
    const client = await getClient(options)
    const botName = await getDefaultBotName(options)
    const blocks = ChannelBotClient.wrapTextInBlocks(text)

    const targetType = options.type || detectTargetType(target)

    const message =
      targetType === 'group'
        ? await client.sendGroupMessage(target, blocks, botName)
        : await client.sendUserChatMessage(target, blocks, botName)

    return {
      id: message.id,
      chat_id: message.chatId,
      chat_type: message.chatType,
      person_type: message.personType,
      person_id: message.personId,
      created_at: message.createdAt,
      plain_text: message.plainText,
    }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export async function listAction(target: string, options: MessageOptions): Promise<MessageResult> {
  try {
    const client = await getClient(options)
    const limit = options.limit ? parseInt(options.limit, 10) : 25
    const sortOrder = options.sort || 'desc'
    const since = options.since

    const targetType = options.type || detectTargetType(target)

    const messages =
      targetType === 'group'
        ? await client.getGroupMessages(target, { sortOrder, since, limit })
        : await client.getUserChatMessages(target, { sortOrder, since, limit })

    return {
      messages: messages.map((msg) => ({
        id: msg.id,
        chat_id: msg.chatId,
        chat_type: msg.chatType,
        person_type: msg.personType,
        person_id: msg.personId,
        created_at: msg.createdAt,
        plain_text: msg.plainText,
      })),
    }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export async function getAction(target: string, messageId: string, options: MessageOptions): Promise<MessageResult> {
  try {
    const client = await getClient(options)
    const limit = 100
    const targetType = options.type || detectTargetType(target)

    const messages =
      targetType === 'group'
        ? await client.getGroupMessages(target, { limit })
        : await client.getUserChatMessages(target, { limit })

    const message = messages.find((m) => m.id === messageId)
    if (!message) {
      return { error: `Message "${messageId}" not found` }
    }

    return {
      id: message.id,
      chat_id: message.chatId,
      chat_type: message.chatType,
      person_type: message.personType,
      person_id: message.personId,
      created_at: message.createdAt,
      plain_text: message.plainText,
      blocks: message.blocks,
    }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

function detectTargetType(target: string): 'userchat' | 'group' {
  if (target.startsWith('@')) return 'group'
  return 'userchat'
}

function cliOutput(result: MessageResult, pretty?: boolean): void {
  console.log(formatOutput(result, pretty))
  if (result.error) process.exit(1)
}

export const messageCommand = new Command('message')
  .description('Message commands')
  .addCommand(
    new Command('send')
      .description('Send a message to a UserChat or Group')
      .argument('<target>', 'UserChat ID or Group ID/@name')
      .argument('<text>', 'Message text')
      .option('--bot <name>', 'Bot name for sending')
      .option('--type <type>', 'Target type: userchat or group (auto-detected if omitted)')
      .option('--workspace <id>', 'Workspace ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (target: string, text: string, opts: MessageOptions) => {
        cliOutput(await sendAction(target, text, opts), opts.pretty)
      }),
  )
  .addCommand(
    new Command('list')
      .description('List messages from a UserChat or Group')
      .argument('<target>', 'UserChat ID or Group ID/@name')
      .option('--limit <n>', 'Number of messages to fetch', '25')
      .option('--sort <order>', 'Sort order: asc or desc', 'desc')
      .option('--since <cursor>', 'Pagination cursor')
      .option('--bot <name>', 'Bot name')
      .option('--type <type>', 'Target type: userchat or group')
      .option('--workspace <id>', 'Workspace ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (target: string, opts: MessageOptions) => {
        cliOutput(await listAction(target, opts), opts.pretty)
      }),
  )
  .addCommand(
    new Command('get')
      .description('Get a specific message by ID')
      .argument('<target>', 'UserChat ID or Group ID/@name')
      .argument('<message-id>', 'Message ID')
      .option('--type <type>', 'Target type: userchat or group')
      .option('--workspace <id>', 'Workspace ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (target: string, messageId: string, opts: MessageOptions) => {
        cliOutput(await getAction(target, messageId, opts), opts.pretty)
      }),
  )
