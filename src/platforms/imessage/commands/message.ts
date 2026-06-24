import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import type { BlueBubblesClient } from '../client'
import { IMessageError, type IMessageMessageSummary } from '../types'
import { parseLimitOption, withIMessageClient } from './shared'

async function listAction(
  chat: string,
  options: { account?: string; pretty?: boolean; limit?: string },
): Promise<void> {
  try {
    const limit = parseLimitOption(options.limit, 25)
    const messages = await withIMessageClient(options, (client) => client.getMessages(chat, limit))
    console.log(formatOutput(messages, options.pretty))
    process.exit(0)
  } catch (error) {
    handleError(error as Error)
  }
}

async function sendAction(chat: string, text: string, options: { account?: string; pretty?: boolean }): Promise<void> {
  try {
    const message = await withIMessageClient(options, (client) => client.sendMessage(chat, text))
    console.log(formatOutput(message, options.pretty))
    process.exit(0)
  } catch (error) {
    handleError(error as Error)
  }
}

function parseInterval(raw: string | undefined): number {
  const value = (raw ?? '5s').trim().toLowerCase()
  const match = /^(\d+)(ms|s)?$/.exec(value)
  if (!match) {
    throw new IMessageError('--interval must look like "5s", "1500ms", or "3".', 'invalid_limit')
  }
  const amount = Number.parseInt(match[1], 10)
  const ms = match[2] === 'ms' ? amount : amount * 1000
  if (ms < 1000) {
    throw new IMessageError('--interval must be at least 1s to avoid overloading BlueBubbles.', 'invalid_limit')
  }
  return ms
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

async function pollOnce(
  client: BlueBubblesClient,
  chatGuid: string | undefined,
  watermark: number,
  seen: Set<string>,
): Promise<{ emitted: IMessageMessageSummary[]; watermark: number }> {
  const count = await client.countMessages(watermark, chatGuid)
  if (count <= 0) return { emitted: [], watermark }

  const fetched = chatGuid
    ? await client.getMessages(chatGuid, Math.min(count, 100))
    : await recentAcrossChats(client, count)

  const emitted: IMessageMessageSummary[] = []
  let nextWatermark = watermark
  for (const msg of fetched) {
    const ts = Date.parse(msg.timestamp)
    if (ts <= watermark || seen.has(msg.id)) continue
    seen.add(msg.id)
    emitted.push(msg)
    if (ts > nextWatermark) nextWatermark = ts
  }
  return { emitted, watermark: nextWatermark }
}

async function recentAcrossChats(client: BlueBubblesClient, limit: number): Promise<IMessageMessageSummary[]> {
  const chats = await client.listChats(Math.min(Math.max(limit, 10), 100))
  const collected: IMessageMessageSummary[] = []
  for (const chat of chats) {
    if (chat.last_message) collected.push(chat.last_message)
  }
  return collected.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
}

async function watchAction(options: {
  account?: string
  pretty?: boolean
  chat?: string
  interval?: string
  since?: string
  jsonl?: boolean
}): Promise<void> {
  try {
    const intervalMs = parseInterval(options.interval)
    const chatGuid = options.chat && options.chat !== 'all' ? options.chat : undefined
    let watermark = options.since ? Date.parse(options.since) : Date.now()
    if (Number.isNaN(watermark)) {
      throw new IMessageError('--since must be an ISO timestamp.', 'invalid_limit')
    }
    const seen = new Set<string>()
    let running = true

    const stop = (): void => {
      running = false
    }
    process.on('SIGINT', stop)
    process.on('SIGTERM', stop)

    await withIMessageClient(options, async (client) => {
      while (running) {
        const result = await pollOnce(client, chatGuid, watermark, seen)
        watermark = result.watermark
        for (const msg of result.emitted) {
          if (options.jsonl) {
            console.log(JSON.stringify(msg))
          } else {
            console.log(formatOutput(msg, options.pretty))
          }
        }
        if (!running) break
        await sleep(intervalMs)
      }
    })
    process.exit(0)
  } catch (error) {
    handleError(error as Error)
  }
}

export const messageCommand = new Command('message')
  .description('iMessage message commands')
  .addCommand(
    new Command('list')
      .description('List messages from a chat')
      .argument('<chat>', 'Chat GUID')
      .option('--limit <n>', 'Number of messages to fetch', '25')
      .option('--account <id>', 'Use a specific iMessage account')
      .option('--pretty', 'Pretty print JSON output')
      .action(listAction),
  )
  .addCommand(
    new Command('send')
      .description('Send a text message to a chat')
      .argument('<chat>', 'Chat GUID')
      .argument('<text>', 'Message text')
      .option('--account <id>', 'Use a specific iMessage account')
      .option('--pretty', 'Pretty print JSON output')
      .action(sendAction),
  )
  .addCommand(
    new Command('watch')
      .description('Stream new messages via polling (outbound-only, container-friendly)')
      .option('--chat <guid|all>', 'Watch a specific chat or "all"', 'all')
      .option('--interval <duration>', 'Poll interval (e.g. 5s, 1500ms)', '5s')
      .option('--since <iso>', 'Replay messages after this ISO timestamp (default: from now)')
      .option('--jsonl', 'Emit one JSON object per line')
      .option('--account <id>', 'Use a specific iMessage account')
      .option('--pretty', 'Pretty print JSON output')
      .action(watchAction),
  )

export { parseInterval, pollOnce }
