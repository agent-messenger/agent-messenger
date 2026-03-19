import { Command } from 'commander'

import { formatOutput } from '@/shared/utils/output'

import { ChannelClient } from '../client'
import type { ChannelSearchHit, ChannelMessage, MessageBlock } from '../types'
import { getClient, getCurrentWorkspaceId } from './shared'

type ChatType = 'group' | 'user-chat' | 'direct-chat'
type SearchScope = 'team-chat' | 'user-chat'

const VALID_SEARCH_SCOPES: readonly SearchScope[] = ['team-chat', 'user-chat'] as const

interface ActionOptions {
  workspace?: string
  pretty?: boolean
}

type MessageOptions = ActionOptions & {
  limit?: string
  sort?: string
}

type SearchOptions = ActionOptions & {
  scope?: string
  limit?: string
}

interface MessageSummary {
  id: string
  channel_id?: string
  chat_id?: string
  chat_type?: string
  person_type?: string
  person_id?: string
  created_at?: number
  plain_text?: string
}

interface MessageResult {
  id?: string
  channel_id?: string
  chat_id?: string
  chat_type?: string
  person_type?: string
  person_id?: string
  created_at?: number
  plain_text?: string
  blocks?: MessageBlock[]
  messages?: MessageSummary[]
  error?: string
}

export async function sendAction(
  chatType: ChatType,
  chatId: string,
  text: string,
  options: ActionOptions = {},
): Promise<MessageResult> {
  try {
    const client = await getClient(options)
    const channelId = await getCurrentWorkspaceId(options)
    const blocks = ChannelClient.wrapTextInBlocks(text)

    const message = await sendMessageByChatType(client, channelId, chatType, chatId, blocks)

    return toMessageResult(message)
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export async function listAction(chatType: ChatType, chatId: string, options: MessageOptions = {}): Promise<MessageResult> {
  try {
    const client = await getClient(options)
    const channelId = await getCurrentWorkspaceId(options)
    const limit = parseLimit(options.limit)
    const sortOrder = options.sort || 'desc'

    const messages = await listMessagesByChatType(client, channelId, chatType, chatId, {
      limit,
      sortOrder,
    })

    return {
      messages: messages.map((message) => ({
        id: message.id,
        channel_id: message.channelId,
        chat_id: message.chatId,
        chat_type: message.chatType,
        person_type: message.personType,
        person_id: message.personId,
        created_at: message.createdAt,
        plain_text: ChannelClient.extractText(message),
      })),
    }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export async function getAction(
  chatType: ChatType,
  chatId: string,
  messageId: string,
  options: ActionOptions = {},
): Promise<MessageResult> {
  try {
    const client = await getClient(options)
    const channelId = await getCurrentWorkspaceId(options)
    const messages = await listMessagesByChatType(client, channelId, chatType, chatId, {
      limit: 100,
      sortOrder: 'desc',
    })
    const message = messages.find((m) => m.id === messageId)
    if (!message) {
      return { error: `Message "${messageId}" not found in the latest 100 messages` }
    }
    return toMessageResult(message)
  } catch (error) {
    return { error: (error as Error).message }
  }
}

interface SearchResultItem {
  id: string
  channel_id?: string
  chat_type?: string
  chat_id?: string
  person_type?: string
  person_id?: string
  created_at?: number
  plain_text?: string
  highlight?: string[]
}

interface SearchResult {
  results?: SearchResultItem[]
  error?: string
}

export async function searchAction(query: string, options: SearchOptions = {}): Promise<SearchResult> {
  try {
    const client = await getClient(options)
    const channelId = await getCurrentWorkspaceId(options)
    const limit = options.limit ? parseLimit(options.limit) : undefined
    const scope = parseScope(options.scope)

    const response =
      scope === 'user-chat'
        ? await client.searchUserChatMessages(channelId, query, { limit })
        : await client.searchTeamChatMessages(channelId, query, { limit })

    return {
      results: response.hits.map((hit: ChannelSearchHit) => ({
        id: hit.source.id,
        channel_id: hit.source.channelId,
        chat_type: hit.source.chatType,
        chat_id: hit.source.chatId,
        person_type: hit.source.personType,
        person_id: hit.source.personId,
        created_at: hit.source.createdAt,
        plain_text: ChannelClient.extractText(hit.source as ChannelMessage),
        highlight: hit.highlight?.plainText?.fragments,
      })),
    }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

function parseScope(scope?: string): SearchScope {
  if (!scope) return 'team-chat'
  if (VALID_SEARCH_SCOPES.includes(scope as SearchScope)) return scope as SearchScope
  throw new Error(`Invalid --scope value "${scope}". Must be one of: ${VALID_SEARCH_SCOPES.join(', ')}`)
}

function parseLimit(limit?: string): number {
  const parsed = limit ? Number(limit) : 25
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error('Invalid --limit value. Must be a positive integer.')
  }
  return parsed
}

async function sendMessageByChatType(
  client: Awaited<ReturnType<typeof getClient>>,
  channelId: string,
  chatType: ChatType,
  chatId: string,
  blocks: MessageBlock[],
) {
  switch (chatType) {
    case 'group':
      return client.sendGroupMessage(channelId, chatId, blocks)
    case 'user-chat':
      return client.sendUserChatMessage(channelId, chatId, blocks)
    case 'direct-chat':
      return client.sendDirectChatMessage(channelId, chatId, blocks)
    default:
      throw new Error(`Invalid chat type: ${chatType as string}. Must be one of: group, user-chat, direct-chat`)
  }
}

async function listMessagesByChatType(
  client: Awaited<ReturnType<typeof getClient>>,
  channelId: string,
  chatType: ChatType,
  chatId: string,
  params: { sortOrder: string; limit: number },
) {
  switch (chatType) {
    case 'group':
      return client.getGroupMessages(channelId, chatId, params)
    case 'user-chat':
      return client.getUserChatMessages(channelId, chatId, params)
    case 'direct-chat':
      return client.getDirectChatMessages(channelId, chatId, params)
    default:
      throw new Error(`Invalid chat type: ${chatType as string}. Must be one of: group, user-chat, direct-chat`)
  }
}

function toMessageResult(message: {
  id: string
  channelId?: string
  chatId?: string
  chatType?: string
  personType?: string
  personId?: string
  createdAt?: number
  plainText?: string
  blocks?: MessageBlock[]
}): MessageResult {
  return {
    id: message.id,
    channel_id: message.channelId,
    chat_id: message.chatId,
    chat_type: message.chatType,
    person_type: message.personType,
    person_id: message.personId,
    created_at: message.createdAt,
    plain_text: message.plainText,
    blocks: message.blocks,
  }
}

function cliOutput(result: { error?: string }, pretty?: boolean): void {
  console.log(formatOutput(result, pretty))
  if (result.error) {
    process.exit(1)
  }
}

export function createMessageCommand(): Command {
  return new Command('message')
    .description('Message commands')
    .addCommand(
      new Command('send')
        .description('Send a message to a group, user chat, or direct chat')
        .argument('<chat-type>', 'Chat type: group, user-chat, or direct-chat')
        .argument('<chat-id>', 'Chat ID')
        .argument('<text>', 'Message text')
        .option('--workspace <id>', 'Workspace ID')
        .option('--pretty', 'Pretty print JSON output')
        .action(async (chatType: ChatType, chatId: string, text: string, opts: ActionOptions) => {
          cliOutput(await sendAction(chatType, chatId, text, opts), opts.pretty)
        }),
    )
    .addCommand(
      new Command('list')
        .description('List messages from a group, user chat, or direct chat')
        .argument('<chat-type>', 'Chat type: group, user-chat, or direct-chat')
        .argument('<chat-id>', 'Chat ID')
        .option('--limit <n>', 'Number of messages to fetch', '25')
        .option('--sort <order>', 'Sort order: asc or desc', 'desc')
        .option('--workspace <id>', 'Workspace ID')
        .option('--pretty', 'Pretty print JSON output')
        .action(async (chatType: ChatType, chatId: string, opts: MessageOptions) => {
          cliOutput(await listAction(chatType, chatId, opts), opts.pretty)
        }),
    )
    .addCommand(
      new Command('get')
        .description('Get a specific message by ID')
        .argument('<chat-type>', 'Chat type: group, user-chat, or direct-chat')
        .argument('<chat-id>', 'Chat ID')
        .argument('<message-id>', 'Message ID')
        .option('--workspace <id>', 'Workspace ID')
        .option('--pretty', 'Pretty print JSON output')
        .action(async (chatType: ChatType, chatId: string, messageId: string, opts: ActionOptions) => {
          cliOutput(await getAction(chatType, chatId, messageId, opts), opts.pretty)
        }),
    )
    .addCommand(
      new Command('search')
        .description('Search messages across team chats or user chats')
        .argument('<query>', 'Search query')
        .option('--scope <scope>', 'Search scope: team-chat or user-chat (default: team-chat)')
        .option('--limit <n>', 'Number of results')
        .option('--workspace <id>', 'Workspace ID')
        .option('--pretty', 'Pretty print JSON output')
        .action(async (query: string, opts: SearchOptions) => {
          cliOutput(await searchAction(query, opts), opts.pretty)
        }),
    )
}

export const messageCommand = createMessageCommand()
