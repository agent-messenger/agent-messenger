import { Command, InvalidArgumentError } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { DiscordClient } from '../client'
import { DiscordCredentialManager } from '../credential-manager'
import type { DiscordDMChannel } from '../types'

function parseLimit(value: string): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new InvalidArgumentError('Must be a positive integer.')
  }
  return parsed
}

function channelTypeLabel(type: number): string {
  return type === 1 ? 'DM' : 'Group DM'
}

export async function listAction(options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new DiscordCredentialManager()
    const config = await credManager.load()

    if (!config.token) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = await new DiscordClient().login({ token: config.token })
    const channels = await client.listDMChannels()

    const output = channels.map((channel: DiscordDMChannel) => ({
      id: channel.id,
      type: channelTypeLabel(channel.type),
      name: channel.name || null,
      recipients: channel.recipients.map((user) => ({
        id: user.id,
        username: user.username,
      })),
      last_message_id: channel.last_message_id || null,
    }))

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export async function createAction(userId: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new DiscordCredentialManager()
    const config = await credManager.load()

    if (!config.token) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = await new DiscordClient().login({ token: config.token })
    const channel = await client.createDM(userId)

    const output = {
      id: channel.id,
      type: channelTypeLabel(channel.type),
      name: channel.name || null,
      recipients: channel.recipients.map((user) => ({
        id: user.id,
        username: user.username,
      })),
    }

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export async function unreadAction(options: { limit?: number; pretty?: boolean }): Promise<void> {
  try {
    const credManager = new DiscordCredentialManager()
    const config = await credManager.load()

    if (!config.token) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = await new DiscordClient().login({ token: config.token })
    const result = await client.getUnreadDMs({ limit: options.limit })

    const output = {
      channels: result.channels.map((channel) => ({
        id: channel.id,
        type: channelTypeLabel(channel.type),
        name: channel.name,
        recipients: channel.recipients.map((user) => ({
          id: user.id,
          username: user.username,
        })),
        last_message_id: channel.lastMessageId,
        unread_count: channel.unreadCount,
      })),
      count: result.count,
      total_unread: result.totalUnread,
      complete: result.complete,
    }

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const dmCommand = new Command('dm')
  .description('DM channel commands')
  .addCommand(
    new Command('list')
      .description('List DM channels')
      .option('--pretty', 'Pretty print JSON output')
      .action(listAction),
  )
  .addCommand(
    new Command('create')
      .description('Create a DM channel')
      .argument('<user-id>', 'User ID to create DM with')
      .option('--pretty', 'Pretty print JSON output')
      .action(createAction),
  )
  .addCommand(
    new Command('unread')
      .description('List unread DM and group-DM channels, newest first')
      .option('--limit <n>', 'Max number of channels to return', parseLimit)
      .option('--pretty', 'Pretty print JSON output')
      .action((options) => {
        unreadAction({
          limit: options.limit,
          pretty: options.pretty,
        })
      }),
  )
