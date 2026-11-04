import { readFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'

import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { exactInteger, parseJsonPreservingIntegers } from '../protocol/exact-json'
import type { KakaoMessage, KakaoReplyTarget } from '../types'
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
  options: { account?: string; pretty?: boolean; replyTo?: string; replyToJson?: string },
): Promise<void> {
  try {
    if (options.replyTo !== undefined && options.replyToJson !== undefined) {
      throw new Error('Use either --reply-to or --reply-to-json, not both')
    }
    const directTarget = options.replyToJson !== undefined ? parseReplyTargetJson(options.replyToJson) : undefined

    const result = await withKakaoClient(options, async (client) => {
      if (directTarget) {
        return client.sendMessage(chatId, text, { replyTo: directTarget })
      }
      if (options.replyTo === undefined) {
        return client.sendMessage(chatId, text)
      }

      const target = await resolveReplyTarget(client, chatId, options.replyTo)
      return client.sendMessage(chatId, text, { replyTo: target })
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

// --reply-to-json lets a caller that already holds the target message (from a
// listener event or an earlier `message list`) skip the history lookup, which
// only sees the latest 100 messages and costs extra round trips. Integer tokens
// are parsed exactly so 64-bit ids survive.
function parseReplyTargetJson(raw: string): KakaoReplyTarget {
  let value: unknown
  try {
    value = parseJsonPreservingIntegers(raw)
  } catch {
    throw new Error('--reply-to-json must be valid JSON')
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('--reply-to-json must be a JSON object')
  }

  const { log_id, author_id, type, link_id } = value as Record<string, unknown>
  const rawMessage = (value as Record<string, unknown>).message
  if (rawMessage === undefined) {
    throw new Error('--reply-to-json is missing message')
  }
  if (rawMessage !== null && typeof rawMessage !== 'string') {
    throw new Error('--reply-to-json message must be a string')
  }
  // Media rows from `message list` can carry a null message; quote them with empty text.
  const message = rawMessage ?? ''
  if (typeof type !== 'number' || !Number.isInteger(type)) {
    throw new Error('--reply-to-json type must be an integer')
  }

  return {
    log_id: replyTargetId(log_id, 'log_id'),
    // Safe numbers stay numbers, matching `message list` output; larger ids arrive as exact strings.
    author_id:
      typeof author_id === 'number'
        ? Number(replyTargetId(author_id, 'author_id'))
        : replyTargetId(author_id, 'author_id'),
    message,
    type,
    ...(link_id !== undefined && link_id !== null ? { link_id: replyTargetId(link_id, 'link_id') } : {}),
  }
}

function replyTargetId(value: unknown, field: string): string {
  if (value === undefined || value === null) {
    throw new Error(`--reply-to-json is missing ${field}`)
  }
  try {
    return exactInteger(value).digits
  } catch {
    throw new Error(`--reply-to-json ${field} must be an integer id`)
  }
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

async function typingAction(
  chatId: string,
  options: { account?: string; linkId?: string; pretty?: boolean },
): Promise<void> {
  try {
    const result = await withKakaoClient(options, (client) =>
      client.sendTyping(chatId, options.linkId !== undefined ? { linkId: options.linkId } : undefined),
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
        '--reply-to-json <json>',
        'Send as a quoted reply to this target {log_id, author_id, message, type, link_id?} without a history lookup',
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
  .addCommand(
    new Command('typing')
      .description('Send a single typing-indicator pulse to a chat room (shows the "..." dots for ~5s)')
      .argument('<chat-id>', 'Chat room ID')
      .option('--account <id>', 'Use a specific KakaoTalk account')
      .option('--link-id <li>', 'Open-chat link ID (open chats only)')
      .option('--pretty', 'Pretty print JSON output')
      .action(typingAction),
  )
