import { Command } from 'commander'

import { formatOutput } from '@/shared/utils/output'

import { ChannelClient } from '../client'
import { getClient, getCurrentWorkspaceId } from './shared'

interface ActionOptions {
  workspace?: string
  pretty?: boolean
}

type GroupOptions = ActionOptions & {
  limit?: string
  sort?: string
}

interface GroupSummary {
  id: string
  channel_id: string
  name: string
  title?: string
  scope?: string
  active?: boolean
  created_at?: number
  updated_at?: number
}

interface GroupResult {
  id?: string
  channel_id?: string
  name?: string
  title?: string
  scope?: string
  active?: boolean
  created_at?: number
  updated_at?: number
  groups?: GroupSummary[]
  messages?: Array<{
    id: string
    channel_id?: string
    chat_id?: string
    chat_type?: string
    person_type?: string
    person_id?: string
    created_at?: number
    plain_text?: string
  }>
  error?: string
}

export async function listAction(options: GroupOptions = {}): Promise<GroupResult> {
  try {
    const client = await getClient(options)
    const channelId = await getCurrentWorkspaceId(options)
    const limit = parseLimit(options.limit)
    const groups = await client.listGroups(channelId, { limit })

    return {
      groups: groups.map((group) => ({
        id: group.id,
        channel_id: group.channelId,
        name: group.name,
        title: group.title,
        scope: group.scope,
        active: group.active,
        created_at: group.createdAt,
        updated_at: group.updatedAt,
      })),
    }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export async function getAction(groupId: string, options: ActionOptions = {}): Promise<GroupResult> {
  try {
    const client = await getClient(options)
    const channelId = await getCurrentWorkspaceId(options)
    const group = await client.getGroup(channelId, groupId)

    return {
      id: group.id,
      channel_id: group.channelId,
      name: group.name,
      title: group.title,
      scope: group.scope,
      active: group.active,
      created_at: group.createdAt,
      updated_at: group.updatedAt,
    }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export async function messagesAction(groupId: string, options: GroupOptions = {}): Promise<GroupResult> {
  try {
    const client = await getClient(options)
    const channelId = await getCurrentWorkspaceId(options)
    const limit = parseLimit(options.limit)
    const sortOrder = options.sort || 'desc'
    const messages = await client.getGroupMessages(channelId, groupId, { sortOrder, limit })

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

function parseLimit(limit?: string): number {
  const parsed = limit ? Number.parseInt(limit, 10) : 25
  if (Number.isNaN(parsed) || parsed < 1) {
    throw new Error('Invalid --limit value. Must be a positive integer.')
  }
  return parsed
}

function cliOutput(result: GroupResult, pretty?: boolean): void {
  console.log(formatOutput(result, pretty))
  if (result.error) {
    process.exit(1)
  }
}

export function createGroupCommand(): Command {
  return new Command('group')
    .description('Group commands')
    .addCommand(
      new Command('list')
        .description('List groups in the current channel')
        .option('--limit <n>', 'Number of groups to fetch', '25')
        .option('--workspace <id>', 'Workspace ID')
        .option('--pretty', 'Pretty print JSON output')
        .action(async (opts: GroupOptions) => {
          cliOutput(await listAction(opts), opts.pretty)
        }),
    )
    .addCommand(
      new Command('get')
        .description('Get a specific group')
        .argument('<group-id>', 'Group ID')
        .option('--workspace <id>', 'Workspace ID')
        .option('--pretty', 'Pretty print JSON output')
        .action(async (groupId: string, opts: ActionOptions) => {
          cliOutput(await getAction(groupId, opts), opts.pretty)
        }),
    )
    .addCommand(
      new Command('messages')
        .description('Get messages from a group')
        .argument('<group-id>', 'Group ID')
        .option('--limit <n>', 'Number of messages to fetch', '25')
        .option('--sort <order>', 'Sort order: asc or desc', 'desc')
        .option('--workspace <id>', 'Workspace ID')
        .option('--pretty', 'Pretty print JSON output')
        .action(async (groupId: string, opts: GroupOptions) => {
          cliOutput(await messagesAction(groupId, opts), opts.pretty)
        }),
    )
}

export const groupCommand = createGroupCommand()
