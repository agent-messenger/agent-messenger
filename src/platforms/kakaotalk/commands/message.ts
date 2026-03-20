import { Long } from 'bson'
import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { ensureKakaoAuth } from '../ensure-auth'
import { LocoSession } from '../protocol/session'

function toLong(v: unknown): string {
  if (v && typeof v === 'object' && 'high' in v && 'low' in v) {
    const { high, low } = v as { high: number; low: number }
    return ((BigInt(high >>> 0) << 32n) | BigInt(low >>> 0)).toString()
  }
  return String(v ?? 0)
}

function parseLong(s: string): Long {
  const big = BigInt(s)
  const low = Number(big & 0xffffffffn)
  const high = Number((big >> 32n) & 0xffffffffn)
  return new Long(low, high)
}

async function listAction(
  chatId: string,
  options: { count?: string; from?: string; pretty?: boolean },
): Promise<void> {
  const account = await ensureKakaoAuth()
  const session = new LocoSession()

  try {
    const loginResult = await session.login(
      account.oauth_token,
      account.user_id,
      account.device_uuid ?? `agent-messenger-${account.user_id}`,
    )

    type ChatData = Record<string, unknown>
    const rawChats = (loginResult.chatDatas ?? []) as ChatData[]
    const chat = rawChats.find((c) => String(c.c) === chatId)
    const lastLogId = chat?.ll as { high: number; low: number } | undefined
    const lastSeenLogId = chat?.s as { high: number; low: number } | undefined
    const maxLogId = lastLogId ? new Long(lastLogId.low, lastLogId.high) : undefined

    const count = options.count ? Number.parseInt(options.count, 10) : 20
    const cursor = options.from ? parseLong(options.from) : undefined

    // SYNCMSG returns messages with logId > cur, up to max.
    // Paginate from cur=0 through batches, dedup, take last N.
    const cid = parseLong(chatId)
    const startCursor = cursor ?? Long.fromNumber(0)
    const allMessages: Array<Record<string, unknown>> = []
    const seenLogIds = new Set<string>()
    let cur = startCursor

    for (;;) {
      const response = await session.syncMessages(cid, 80, cur, maxLogId)
      const batch = (response.body.chatLogs ?? []) as Array<Record<string, unknown>>
      if (batch.length === 0) break

      for (const log of batch) {
        const lid = toLong(log.logId)
        if (!seenLogIds.has(lid)) {
          seenLogIds.add(lid)
          allMessages.push(log)
        }
      }

      const minLog = batch.reduce<Long | null>((min, l) => {
        const lid = l.logId as { high: number; low: number }
        const long = new Long(lid.low, lid.high)
        return !min || long.lessThan(min) ? long : min
      }, null)

      if (!minLog || minLog.equals(cur) || response.body.isOK) break
      cur = minLog
    }

    allMessages.sort((a, b) => (a.sendAt as number) - (b.sendAt as number))

    const messages = allMessages.slice(-count).map((log) => ({
      log_id: toLong(log.logId),
      type: log.type,
      author_id: log.authorId,
      message: log.message,
      sent_at: log.sendAt,
    }))

    console.log(formatOutput(messages, options.pretty))
  } catch (error) {
    handleError(error as Error)
  } finally {
    session.close()
  }
}

async function sendAction(
  chatId: string,
  text: string,
  options: { pretty?: boolean },
): Promise<void> {
  const account = await ensureKakaoAuth()
  const session = new LocoSession()

  try {
    await session.login(
      account.oauth_token,
      account.user_id,
      account.device_uuid ?? `agent-messenger-${account.user_id}`,
    )

    const response = await session.sendMessage(Number(chatId), text)

    console.log(
      formatOutput(
        {
          success: response.statusCode === 0,
          status_code: response.statusCode,
          chat_id: chatId,
          log_id: response.body.logId,
          sent_at: response.body.sendAt,
        },
        options.pretty,
      ),
    )
  } catch (error) {
    handleError(error as Error)
  } finally {
    session.close()
  }
}

export const messageCommand = new Command('message')
  .description('KakaoTalk message commands')
  .addCommand(
    new Command('list')
      .description('List messages in a chat room')
      .argument('<chat-id>', 'Chat room ID')
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
      .option('--pretty', 'Pretty print JSON output')
      .action(sendAction),
  )
