import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import type { WorkspaceOption } from './shared'
import { getClient } from './shared'

interface SnapshotOption extends WorkspaceOption {
  groupsOnly?: boolean
  chatsOnly?: boolean
  limit?: number
}

interface SnapshotResult {
  workspace?: {
    id: string
    name: string
    homepage_url?: string
    description?: string
  }
  groups?: Array<{
    id: string
    name: string
    messages?: Array<{
      id: string
      person_type?: string
      plain_text?: string
      created_at?: number
    }>
  }>
  user_chats?: {
    total_opened: number
    total_snoozed: number
    total_closed: number
    recent_opened: Array<{
      id: string
      name?: string
      user_id?: string
      last_message?: {
        id: string
        plain_text?: string
        created_at?: number
      }
    }>
  }
  managers?: Array<{ id: string; name: string; description?: string }>
  bots?: Array<{ id: string; name: string }>
  error?: string
}

export async function snapshotAction(options: SnapshotOption): Promise<SnapshotResult> {
  try {
    const client = await getClient(options)
    const limit = options.limit ?? 5

    const channel = await client.getChannel()
    const workspace = {
      id: channel.id,
      name: channel.name,
      homepage_url: channel.homepageUrl,
      description: channel.description,
    }

    if (options.groupsOnly) {
      const groups = await client.listGroups({ limit: 20 })
      const groupsWithMessages = await Promise.all(
        groups.map(async (g) => {
          const messages = await client.getGroupMessages(g.id, { limit, sortOrder: 'desc' })
          return {
            id: g.id,
            name: g.name,
            messages: messages.map((m) => ({
              id: m.id,
              person_type: m.personType,
              plain_text: m.plainText,
              created_at: m.createdAt,
            })),
          }
        }),
      )
      return { workspace, groups: groupsWithMessages }
    }

    if (options.chatsOnly) {
      const [openedChats, snoozedChats, closedChats] = await Promise.all([
        client.listUserChats({ state: 'opened', limit: 10, sortOrder: 'desc' }),
        client.listUserChats({ state: 'snoozed', limit: 1 }),
        client.listUserChats({ state: 'closed', limit: 1 }),
      ])

      const recentOpened = await Promise.all(
        openedChats.slice(0, 5).map(async (chat) => {
          const messages = await client.getUserChatMessages(chat.id, { limit: 1, sortOrder: 'desc' })
          return {
            id: chat.id,
            name: chat.name,
            user_id: chat.userId,
            last_message: messages[0]
              ? {
                  id: messages[0].id,
                  plain_text: messages[0].plainText,
                  created_at: messages[0].createdAt,
                }
              : undefined,
          }
        }),
      )

      return {
        workspace,
        user_chats: {
          total_opened: openedChats.length,
          total_snoozed: snoozedChats.length,
          total_closed: closedChats.length,
          recent_opened: recentOpened,
        },
      }
    }

    const [groups, openedChats, snoozedChats, closedChats, managers, bots] = await Promise.all([
      client.listGroups({ limit: 20 }),
      client.listUserChats({ state: 'opened', limit: 10, sortOrder: 'desc' }),
      client.listUserChats({ state: 'snoozed', limit: 1 }),
      client.listUserChats({ state: 'closed', limit: 1 }),
      client.listManagers({ limit: 50 }),
      client.listBots({ limit: 50 }),
    ])

    const groupsWithMessages = await Promise.all(
      groups.map(async (g) => {
        const messages = await client.getGroupMessages(g.id, { limit, sortOrder: 'desc' })
        return {
          id: g.id,
          name: g.name,
          messages: messages.map((m) => ({
            id: m.id,
            person_type: m.personType,
            plain_text: m.plainText,
            created_at: m.createdAt,
          })),
        }
      }),
    )

    const recentOpened = await Promise.all(
      openedChats.slice(0, 5).map(async (chat) => {
        const messages = await client.getUserChatMessages(chat.id, { limit: 1, sortOrder: 'desc' })
        return {
          id: chat.id,
          name: chat.name,
          user_id: chat.userId,
          last_message: messages[0]
            ? {
                id: messages[0].id,
                plain_text: messages[0].plainText,
                created_at: messages[0].createdAt,
              }
            : undefined,
        }
      }),
    )

    return {
      workspace,
      groups: groupsWithMessages,
      user_chats: {
        total_opened: openedChats.length,
        total_snoozed: snoozedChats.length,
        total_closed: closedChats.length,
        recent_opened: recentOpened,
      },
      managers: managers.map((m) => ({ id: m.id, name: m.name, description: m.description })),
      bots: bots.map((b) => ({ id: b.id, name: b.name })),
    }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export const snapshotCommand = new Command('snapshot')
  .description('Workspace overview for AI agent context')
  .option('--groups-only', 'List groups only, skip user chats')
  .option('--chats-only', 'List user chats only, skip groups')
  .option('--limit <n>', 'Messages per group/chat (default: 5)', '5')
  .option('--workspace <id>', 'Workspace ID')
  .option('--bot <name>', 'Bot name')
  .option('--pretty', 'Pretty print JSON output')
  .action(async (options) => {
    try {
      const result = await snapshotAction({
        ...options,
        limit: parseInt(options.limit, 10),
      })
      console.log(formatOutput(result, options.pretty))
    } catch (error) {
      handleError(error as Error)
    }
  })
