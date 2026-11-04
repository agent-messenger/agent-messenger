import { readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'

import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import type { KakaoMember, KakaoMentionInput, KakaoMessage, KakaoReplyTarget } from '../types'
import { withKakaoClient } from './shared'

async function listAction(
  chatId: string,
  options: { account?: string; count?: string; from?: string; pretty?: boolean },
): Promise<void> {
  try {
    const count = options.count ? Number.parseInt(options.count, 10) : 20
    const messages = await withKakaoClient(options, (client) =>
      client.getMessages(chatId, { count, from: options.from }),
    )
    console.log(formatOutput(messages, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function sendAction(
  chatId: string,
  text: string,
  options: { account?: string; pretty?: boolean; replyTo?: string; mention?: string[] },
): Promise<void> {
  try {
    const result = await withKakaoClient(options, async (client) => {
      const mentions = options.mention?.length ? await resolveMentions(client, chatId, options.mention) : undefined
      if (options.replyTo === undefined) {
        return mentions ? client.sendMessage(chatId, text, { mentions }) : client.sendMessage(chatId, text)
      }

      const target = await resolveReplyTarget(client, chatId, options.replyTo)
      return client.sendMessage(chatId, text, mentions ? { replyTo: target, mentions } : { replyTo: target })
    })
    console.log(formatOutput(result, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

// A reply attachment needs the source message's author, text, and type — not
// just its log_id — so we look it up in the chat's recent history.
async function resolveReplyTarget(
  client: {
    getMessages: (chatId: string, opts: { count: number }) => Promise<KakaoMessage[]>
  },
  chatId: string,
  logId: string,
): Promise<KakaoReplyTarget> {
  const messages = await client.getMessages(chatId, { count: 100 })
  const source = messages.find((m) => m.log_id === logId)
  if (!source) {
    throw new Error(`Reply target log-id ${logId} not found in the latest 100 messages of chat ${chatId}`)
  }
  return {
    log_id: source.log_id,
    author_id: source.author_id,
    message: source.message,
    type: source.type,
  }
}

function collect(value: string, previous: string[] = []): string[] {
  return [...previous, value]
}

// `--mention <user-id>` or `--mention <user-id>:<name>`. Bare ids are resolved
// to the member's in-chat nickname so the SDK can locate `@<nickname>` in the
// text; an explicit name skips the lookup (and covers names the member list
// does not report).
async function resolveMentions(
  client: { getMembersByIds: (chatId: string, userIds: string[]) => Promise<KakaoMember[]> },
  chatId: string,
  specs: string[],
): Promise<KakaoMentionInput[]> {
  const parsed = specs.map((spec) => {
    const sep = spec.indexOf(':')
    const userId = (sep === -1 ? spec : spec.slice(0, sep)).trim()
    const name = sep === -1 ? undefined : spec.slice(sep + 1)
    if (!/^-?\d+$/.test(userId)) {
      throw new Error(`Invalid --mention value "${spec}": expected <user-id> or <user-id>:<name>`)
    }
    if (name !== undefined && name.length === 0) {
      throw new Error(`Invalid --mention value "${spec}": name after ":" is empty`)
    }
    return { userId, name }
  })

  const unresolved = [...new Set(parsed.filter((p) => p.name === undefined).map((p) => p.userId))]
  const nicknames = new Map<string, string>()
  if (unresolved.length > 0) {
    for (const member of await client.getMembersByIds(chatId, unresolved)) {
      if (member.nickname) nicknames.set(member.user_id, member.nickname)
    }
  }

  return parsed.map(({ userId, name }) => {
    const resolved = name ?? nicknames.get(userId)
    if (resolved === undefined) {
      throw new Error(`Could not resolve a nickname for --mention ${userId} in chat ${chatId}; pass <user-id>:<name>`)
    }
    return { user_id: userId, name: resolved }
  })
}

type UploadKind = 'auto' | 'photo' | 'video' | 'audio' | 'file' | 'multi'

async function uploadAction(
  chatId: string,
  filePaths: string[],
  options: { account?: string; pretty?: boolean; as?: UploadKind; mime?: string },
): Promise<void> {
  try {
    const kind: UploadKind = options.as ?? (filePaths.length > 1 ? 'multi' : 'auto')

    const result = await withKakaoClient(options, async (client) => {
      if (kind === 'multi') {
        if (filePaths.length < 2) {
          throw new Error('--as=multi requires 2 or more files')
        }
        return client.sendMultiPhoto(
          chatId,
          filePaths.map((p) => ({ data: readFileSync(resolve(p)), filename: basename(p) })),
        )
      }

      if (filePaths.length !== 1) {
        throw new Error(`--as=${kind} accepts exactly one file path`)
      }
      const path = resolve(filePaths[0]!)
      const data = readFileSync(path)
      const filename = basename(path)

      switch (kind) {
        case 'auto':
          return client.sendAttachment(chatId, data, filename, options.mime)
        case 'photo':
          return client.sendPhoto(chatId, data, filename)
        case 'video':
          return client.sendVideo(chatId, data, filename)
        case 'audio':
          return client.sendAudio(chatId, data, filename)
        case 'file':
          return client.sendFile(chatId, data, filename, options.mime ?? 'application/octet-stream')
      }
    })
    console.log(formatOutput(result, options.pretty))
    if (!result.success) {
      process.exit(1)
    }
  } catch (error) {
    handleError(error as Error)
  }
}

async function markReadAction(
  chatId: string,
  logId: string,
  options: { account?: string; linkId?: string; pretty?: boolean },
): Promise<void> {
  try {
    const result = await withKakaoClient(options, (client) =>
      client.markRead(chatId, logId, options.linkId !== undefined ? { linkId: options.linkId } : undefined),
    )
    console.log(formatOutput(result, options.pretty))
    if (!result.success) {
      process.exit(1)
    }
  } catch (error) {
    handleError(error as Error)
  }
}

export const messageCommand = new Command('message')
  .description('KakaoTalk message commands')
  .addCommand(
    new Command('list')
      .description('List messages in a chat room')
      .argument('<chat-id>', 'Chat room ID')
      .option('--account <id>', 'Use a specific KakaoTalk account')
      .option('-n, --count <number>', 'Number of messages to fetch', '20')
      .option('--from <log-id>', 'Fetch messages starting from this log ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(listAction),
  )
  .addCommand(
    new Command('send')
      .description('Send a text message to a chat room')
      .argument('<chat-id>', 'Chat room ID')
      .argument('<text>', 'Message text')
      .option('--account <id>', 'Use a specific KakaoTalk account')
      .option('--reply-to <log-id>', 'Send as a quoted reply to this message log ID')
      .option(
        '--mention <user-id[:name]>',
        'Tag a user; the text must contain @<name> (name defaults to the member nickname). Repeatable',
        collect,
      )
      .option('--pretty', 'Pretty print JSON output')
      .action(sendAction),
  )
  .addCommand(
    new Command('upload')
      .description(
        'Send one or more files to a chat. MIME is sniffed from the filename (or --mime) and dispatched to the matching KakaoTalk message_type. Pass 2+ files (or --as=multi) for a multi-photo gallery.',
      )
      .argument('<chat-id>', 'Chat room ID')
      .argument('<file-paths...>', 'One or more file paths')
      .option('--account <id>', 'Use a specific KakaoTalk account')
      .option('--as <kind>', 'Force a specific kind: auto | photo | video | audio | file | multi')
      .option('--mime <type>', 'Override MIME type (otherwise inferred from filename)')
      .option('--pretty', 'Pretty print JSON output')
      .action(uploadAction),
  )
  .addCommand(
    new Command('mark-read')
      .description('Mark messages in a chat room as read up to a given log ID')
      .argument('<chat-id>', 'Chat room ID')
      .argument('<log-id>', 'Watermark log ID (mark messages up to and including this log_id as read)')
      .option('--account <id>', 'Use a specific KakaoTalk account')
      .option('--link-id <li>', 'Open-chat link ID (REQUIRED for open chats / 오픈채팅)')
      .option('--pretty', 'Pretty print JSON output')
      .action(markReadAction),
  )
