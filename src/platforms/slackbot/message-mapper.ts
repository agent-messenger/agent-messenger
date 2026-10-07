import type { SlackMessage } from './types'

// Integration posts (alerting webhooks, CI bots) often carry an empty `text`
// and put all readable content in `attachments` / `blocks`, so both are passed
// through whenever Slack returns them.
export function mapSlackMessage(msg: any): SlackMessage {
  return {
    ts: msg.ts!,
    text: msg.text || '',
    type: msg.type || 'message',
    user: msg.user,
    username: msg.username,
    thread_ts: msg.thread_ts,
    reply_count: msg.reply_count,
    replies: msg.replies,
    edited: msg.edited
      ? {
          user: msg.edited.user || '',
          ts: msg.edited.ts || '',
        }
      : undefined,
    files: msg.files?.map((f: any) => ({
      id: f.id!,
      name: f.name!,
      title: f.title || f.name || '',
      mimetype: f.mimetype || 'application/octet-stream',
      size: f.size || 0,
      url_private: f.url_private || '',
      created: f.created || 0,
      user: f.user || '',
      channels: f.channels,
    })),
    attachments: msg.attachments?.length ? msg.attachments : undefined,
    blocks: msg.blocks?.length ? msg.blocks : undefined,
  }
}
