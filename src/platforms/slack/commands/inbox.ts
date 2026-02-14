import { Command } from 'commander'
import { handleError } from '../../../shared/utils/error-handler'
import { formatOutput } from '../../../shared/utils/output'
import { SlackClient } from '../client'
import { CredentialManager } from '../credential-manager'

const DEFAULT_INBOX_TYPES = 'thread_reply,message_reaction,at_user,at_channel,keyword'

export async function unreadAction(options: {
  pretty?: boolean
  limit?: string
  types?: string
}): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const ws = await credManager.getWorkspace()

    if (!ws) {
      console.log(formatOutput({ error: 'No workspace configured. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new SlackClient(ws.token, ws.cookie)

    const limit = options.limit ? parseInt(options.limit, 10) : 50
    const types = options.types || DEFAULT_INBOX_TYPES

    // Slack client inbox feed. Shape:
    // { items: [{ is_unread, feed_ts, item: { type, message: { ts, channel, thread_ts, author_user_id }}}] }
    const resp = (await (client as any).client.apiCall('activity.feed', {
      mode: 'priority_unreads_v1',
      types,
      limit,
    })) as any

    if (!resp?.ok) {
      console.log(formatOutput({ error: resp?.error || 'Unknown error' }, options.pretty))
      process.exit(1)
    }

    const channels = await client.listChannels()
    const idToName = new Map(channels.map((c) => [c.id, c.name]))

    const rawItems: any[] = resp.items || []
    const unread = rawItems.filter((it) => it?.is_unread)

    const items = [] as Array<{
      type: string
      channel_id: string
      channel_name: string
      ts: string
      thread_ts?: string
      author_user_id?: string
      text: string
      permalink?: string
    }>

    for (const it of unread) {
      const type = it?.item?.type || ''
      const msg = it?.item?.message
      const channelId = msg?.channel || ''
      const ts = msg?.ts || ''
      const threadTs = msg?.thread_ts
      const authorUserId = msg?.author_user_id

      if (!channelId || !ts) continue

      let text = ''

      // Slack thread replies often do NOT appear in conversations.history unless broadcast.
      // For thread replies, prefer conversations.replies(thread_ts) and match by ts.
      if (threadTs) {
        try {
          const rep = await client.getThreadReplies(channelId, threadTs, { limit: 200 })
          const matched = rep.messages.find((m) => m.ts === ts)
          if (matched?.text) text = matched.text
        } catch {
          // fall through
        }
      }

      // Fallback: channel history (works for top-level messages).
      if (!text) {
        const m = await client.getMessage(channelId, ts)
        text = m?.text || ''
      }

      const permalink = await client.getPermalink(channelId, ts).catch(() => '')

      items.push({
        type,
        channel_id: channelId,
        channel_name: idToName.get(channelId) || '',
        ts,
        thread_ts: threadTs,
        author_user_id: authorUserId,
        text,
        permalink,
      })
    }

    // Newest first
    items.sort((a, b) => parseFloat(b.ts) - parseFloat(a.ts))

    console.log(
      formatOutput(
        {
          count: items.length,
          items,
        },
        options.pretty,
      ),
    )
  } catch (error) {
    handleError(error as Error)
  }
}

export const inboxCommand = new Command('inbox')
  .description('Slack Inbox commands (workspace-wide)')
  .addCommand(
    new Command('unread')
      .description('List unread items from your Slack Inbox (activity.feed)')
      .option('--pretty', 'Pretty print JSON output')
      .option('--limit <n>', 'Max inbox items to fetch from Slack (default: 50)')
      .option(
        '--types <types>',
        'Comma-separated inbox types (default: thread_reply,message_reaction,at_user,at_channel,keyword)',
      )
      .action(unreadAction),
  )
