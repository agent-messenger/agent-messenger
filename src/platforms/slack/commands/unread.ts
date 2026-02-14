import { Command } from 'commander'
import { handleError } from '../../../shared/utils/error-handler'
import { formatOutput } from '../../../shared/utils/output'
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

    // Fill channel names via conversations.list (client.counts often returns only channel IDs).
    const channels = await client.listChannels()
    const idToName = new Map(channels.map((c) => [c.id, c.name]))

    const output = {
      total_unread_channels: counts.total_unread_channels,
      total_mentions: counts.total_mentions,
      channels: counts.channels.map((ch) => ({
        id: ch.id,
        name: ch.name || idToName.get(ch.id) || '',
        has_unreads: ch.has_unreads,
        mention_count: ch.mention_count,
        last_read: ch.last_read,
        latest: ch.latest,
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
    await client.markRead(channel, ts)

    console.log(formatOutput({ marked_read: true, channel, ts }, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export async function latestAction(options: {
  pretty?: boolean
  limit?: string
  perChannel?: string
  includeEmpty?: boolean
}): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const workspace = await credManager.getWorkspace()

    if (!workspace) {
      console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new SlackClient(workspace.token, workspace.cookie)

    const limit = options.limit ? parseInt(options.limit, 10) : 10
    const perChannel = options.perChannel ? parseInt(options.perChannel, 10) : 5

    const counts = await client.getUnreadCounts()
    const channels = await client.listChannels()
    const idToName = new Map(channels.map((c) => [c.id, c.name]))

    const unreadChannels = counts.channels
      .filter((ch) => ch.has_unreads && ch.last_read)
      .map((ch) => ({
        id: ch.id,
        name: ch.name || idToName.get(ch.id) || '',
        last_read: ch.last_read as string,
      }))

    const items: Array<{
      channel_id: string
      channel_name: string
      ts: string
      text: string
      user?: string
      username?: string
      thread_ts?: string
      permalink?: string
    }> = []

    for (const ch of unreadChannels) {
      const history = await client.client.conversations.history({
        channel: ch.id,
        oldest: ch.last_read,
        inclusive: false,
        limit: perChannel,
      })

      const messages = (history.messages || []).filter((m: any) => {
        if (options.includeEmpty) return true
        return Boolean(m?.text && String(m.text).trim().length > 0)
      })

      for (const m of messages) {
        const ts = m.ts as string
        const permalink = await client.getPermalink(ch.id, ts).catch(() => '')
        items.push({
          channel_id: ch.id,
          channel_name: ch.name,
          ts,
          text: m.text || '',
          user: m.user,
          username: m.username,
          thread_ts: m.thread_ts,
          permalink,
        })
      }
    }

    // Newest first
    items.sort((a, b) => parseFloat(b.ts) - parseFloat(a.ts))

    console.log(
      formatOutput(
        {
          count: Math.min(limit, items.length),
          items: items.slice(0, limit),
          unread_channels: unreadChannels.length,
        },
        options.pretty,
      ),
    )
  } catch (error) {
    handleError(error as Error)
  }
}

export const unreadCommand = new Command('unread')
  .description('Unread message commands')
  .addCommand(
    new Command('counts')
      .description('Get unread state for all channels (via Slack client.counts)')
      .option('--pretty', 'Pretty print JSON output')
      .action(countsAction),
  )
  .addCommand(
    new Command('latest')
      .description('List latest unread messages across the entire workspace')
      .option('--pretty', 'Pretty print JSON output')
      .option('--limit <n>', 'Max messages to return (default: 10)')
      .option('--per-channel <n>', 'Max unread messages to fetch per unread channel (default: 5)')
      .option('--include-empty', 'Include empty-text messages (some bots/postbacks)')
      .action(latestAction),
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
