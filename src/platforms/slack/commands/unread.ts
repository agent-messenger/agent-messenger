import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { SlackClient } from '../client'
import { CredentialManager } from '../credential-manager'

export async function countsAction(options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const workspace = await credManager.getWorkspace()

    if (!workspace) {
      console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new SlackClient(workspace.token, workspace.cookie)
    const counts = await client.getUnreadCounts()

    const output = {
      total_unread: counts.total_unread,
      total_mentions: counts.total_mentions,
      channels: counts.channels.map((ch) => ({
        id: ch.id,
        name: ch.name,
        unread_count: ch.unread_count,
        mention_count: ch.mention_count,
      })),
    }

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export async function threadsAction(channel: string, threadTs: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const workspace = await credManager.getWorkspace()

    if (!workspace) {
      console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new SlackClient(workspace.token, workspace.cookie)
    channel = await client.resolveChannel(channel)
    const threadView = await client.getThreadView(channel, threadTs)

    const output = {
      channel_id: threadView.channel_id,
      thread_ts: threadView.thread_ts,
      unread_count: threadView.unread_count,
      last_read: threadView.last_read,
      subscribed: threadView.subscribed,
    }

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export async function markAction(channel: string, ts: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const workspace = await credManager.getWorkspace()

    if (!workspace) {
      console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new SlackClient(workspace.token, workspace.cookie)
    channel = await client.resolveChannel(channel)
    await client.markRead(channel, ts)

    console.log(formatOutput({ marked_read: true, channel, ts }, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const unreadCommand = new Command('unread')
  .description('Unread message commands')
  .addCommand(
    new Command('counts')
      .description('Get unread counts for all channels')
      .option('--pretty', 'Pretty print JSON output')
      .action(countsAction),
  )
  .addCommand(
    new Command('threads')
      .description('Get thread subscription details')
      .argument('<channel>', 'Channel ID or name')
      .argument('<thread_ts>', 'Thread timestamp')
      .option('--pretty', 'Pretty print JSON output')
      .action(threadsAction),
  )
  .addCommand(
    new Command('mark')
      .description('Mark channel as read up to timestamp')
      .argument('<channel>', 'Channel ID or name')
      .argument('<ts>', 'Message timestamp to mark as read')
      .option('--pretty', 'Pretty print JSON output')
      .action(markAction),
  )
