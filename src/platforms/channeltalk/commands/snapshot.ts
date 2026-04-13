import { Command } from 'commander'

import { formatOutput } from '@/shared/utils/output'

import { ChannelClient } from '../client'
import { getClient, getCurrentWorkspaceId } from './shared'

interface SnapshotOptions {
  workspace?: string
  pretty?: boolean
  groupsOnly?: boolean
  chatsOnly?: boolean
  limit?: number | string
}

interface SnapshotResult {
  workspace?: {
    id: string
    name: string
  }
  managers?: Array<{
    id: string
    name: string
    email?: string
    account_id?: string
    role_id?: string
  }>
  bots?: Array<{
    id: string
    name: string
    avatar_url?: string
  }>
  groups?: Array<{
    id: string
    name: string
    recent_messages: Array<{
      id: string
      person_type?: string
      plain_text?: string
      created_at?: number
    }>
  }>
  user_chats?: {
    total: number
    by_state: Record<string, number>
    recent: Array<{
      id: string
      state?: string
      assignee_id?: string
      created_at?: number
      updated_at?: number
    }>
  }
  error?: string
}

export async function snapshotAction(options: SnapshotOptions = {}): Promise<SnapshotResult> {
  try {
    const client = await getClient(options)
    const workspaceId = await getCurrentWorkspaceId(options)
    const limit = parseLimit(options.limit)

    const channel = await client.getChannel(workspaceId)
    const workspace = {
      id: channel.id,
      name: channel.name,
    }

    if (options.groupsOnly) {
      const groups = await buildGroupsSnapshot(client, workspaceId, limit)
      return { workspace, groups }
    }

    if (options.chatsOnly) {
      const userChats = await buildUserChatsSnapshot(client, workspaceId, limit)
      return { workspace, user_chats: userChats }
    }

    const [managers, bots, groups, userChats] = await Promise.all([
      client.listManagers(workspaceId, { limit: 50 }),
      client.listBots(workspaceId, { limit: 50 }),
      buildGroupsSnapshot(client, workspaceId, limit),
      buildUserChatsSnapshot(client, workspaceId, limit),
    ])

    return {
      workspace,
      managers: managers.map((manager) => ({
        id: manager.id,
        name: manager.name,
        email: manager.email,
        account_id: manager.accountId,
        role_id: manager.roleId,
      })),
      bots: bots.map((bot) => ({
        id: bot.id,
        name: bot.name,
        avatar_url: bot.avatarUrl,
      })),
      groups,
      user_chats: userChats,
    }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

function parseLimit(limit?: number | string): number {
  if (typeof limit === 'number') {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error('Invalid --limit value. Must be a positive integer.')
    }
    return limit
  }

  const parsed = limit ? Number(limit) : 5
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error('Invalid --limit value. Must be a positive integer.')
  }
  return parsed
}

async function buildGroupsSnapshot(client: Awaited<ReturnType<typeof getClient>>, workspaceId: string, limit: number) {
  const groups = await client.listGroups(workspaceId, { limit: 20 })

  return Promise.all(
    groups.map(async (group) => {
      const messages = await client.getGroupMessages(workspaceId, group.id, { limit, sortOrder: 'desc' })

      return {
        id: group.id,
        name: group.name,
        recent_messages: messages.map((message) => ({
          id: message.id,
          person_type: message.personType,
          plain_text: ChannelClient.extractText(message),
          created_at: message.createdAt,
        })),
      }
    }),
  )
}

async function buildUserChatsSnapshot(
  client: Awaited<ReturnType<typeof getClient>>,
  workspaceId: string,
  limit: number,
) {
  const [openedChats, snoozedChats, closedChats] = await Promise.all([
    client.listUserChats(workspaceId, { state: 'opened', limit: 100 }),
    client.listUserChats(workspaceId, { state: 'snoozed', limit: 100 }),
    client.listUserChats(workspaceId, { state: 'closed', limit: 100 }),
  ])

  return {
    total: openedChats.length + snoozedChats.length + closedChats.length,
    by_state: {
      opened: openedChats.length,
      snoozed: snoozedChats.length,
      closed: closedChats.length,
    },
    recent: openedChats.slice(0, limit).map((chat) => ({
      id: chat.id,
      state: chat.state,
      assignee_id: chat.assigneeId,
      created_at: chat.createdAt,
      updated_at: chat.updatedAt,
    })),
  }
}

function cliOutput(result: SnapshotResult, pretty?: boolean): void {
  console.log(formatOutput(result, pretty))
  if (result.error) {
    process.exit(1)
  }
}

export function createSnapshotCommand(): Command {
  return new Command('snapshot')
    .description('Workspace overview for AI agent context')
    .option('--groups-only', 'List groups only, skip user chats')
    .option('--chats-only', 'List user chats only, skip groups')
    .option('--limit <n>', 'Messages per group and recent opened chats', '5')
    .option('--workspace <id>', 'Workspace ID')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (options: SnapshotOptions) => {
      cliOutput(await snapshotAction(options), options.pretty)
    })
}

export const snapshotCommand = createSnapshotCommand()
