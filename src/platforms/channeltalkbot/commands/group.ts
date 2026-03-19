import { Command } from 'commander'

import { formatOutput } from '@/shared/utils/output'

import type { WorkspaceOption } from './shared'
import { getClient } from './shared'

interface GroupResult {
  id?: string
  channel_id?: string
  name?: string
  groups?: Array<{ id: string; channel_id: string; name: string }>
  messages?: Array<{
    id: string
    chat_id?: string
    person_type?: string
    person_id?: string
    created_at?: number
    plain_text?: string
  }>
  error?: string
}

type GroupOptions = WorkspaceOption & {
  limit?: string
  sort?: string
  since?: string
}

export async function listAction(options: GroupOptions): Promise<GroupResult> {
  try {
    const client = await getClient(options)
    const limit = options.limit ? parseInt(options.limit, 10) : 25
    if (Number.isNaN(limit) || limit < 1) {
      return { error: 'Invalid --limit value. Must be a positive integer.' }
    }
    const since = options.since

    const groups = await client.listGroups({ since, limit })

    return {
      groups: groups.map((g) => ({
        id: g.id,
        channel_id: g.channelId,
        name: g.name,
      })),
    }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export async function getAction(group: string, options: GroupOptions): Promise<GroupResult> {
  try {
    const client = await getClient(options)
    const resolved = await client.resolveGroup(group)

    return {
      id: resolved.id,
      channel_id: resolved.channelId,
      name: resolved.name,
    }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export async function messagesAction(group: string, options: GroupOptions): Promise<GroupResult> {
  try {
    const client = await getClient(options)
    const resolved = await client.resolveGroup(group)
    const limit = options.limit ? parseInt(options.limit, 10) : 25
    if (Number.isNaN(limit) || limit < 1) {
      return { error: 'Invalid --limit value. Must be a positive integer.' }
    }
    const sortOrder = options.sort || 'desc'
    const since = options.since

    const messages = await client.getGroupMessages(resolved.id, { sortOrder, since, limit })

    return {
      messages: messages.map((msg) => ({
        id: msg.id,
        chat_id: msg.chatId,
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

function cliOutput(result: GroupResult, pretty?: boolean): void {
  console.log(formatOutput(result, pretty))
  if (result.error) process.exit(1)
}

export const groupCommand = new Command('group')
  .description('Group management commands')
  .addCommand(
    new Command('list')
      .description('List groups')
      .option('--limit <n>', 'Number of groups to fetch', '25')
      .option('--since <cursor>', 'Pagination cursor')
      .option('--workspace <id>', 'Workspace ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (opts: GroupOptions) => {
        cliOutput(await listAction(opts), opts.pretty)
      }),
  )
  .addCommand(
    new Command('get')
      .description('Get a group by ID or @name')
      .argument('<group>', 'Group ID or @name')
      .option('--workspace <id>', 'Workspace ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (group: string, opts: GroupOptions) => {
        cliOutput(await getAction(group, opts), opts.pretty)
      }),
  )
  .addCommand(
    new Command('messages')
      .description('Get messages from a group')
      .argument('<group>', 'Group ID or @name')
      .option('--limit <n>', 'Number of messages to fetch', '25')
      .option('--sort <order>', 'Sort order: asc or desc', 'desc')
      .option('--since <cursor>', 'Pagination cursor')
      .option('--workspace <id>', 'Workspace ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (group: string, opts: GroupOptions) => {
        cliOutput(await messagesAction(group, opts), opts.pretty)
      }),
  )
