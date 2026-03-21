import { Long } from 'bson'
import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { ensureKakaoAuth } from '../ensure-auth'
import { LocoSession } from '../protocol/session'
import type { ChatListResponse } from '../protocol/types'

type ChatData = Record<string, unknown>

function bsonToLong(v: unknown): Long | undefined {
  if (v && typeof v === 'object' && 'high' in v && 'low' in v) {
    const { high, low } = v as { high: number; low: number }
    return new Long(low, high)
  }
  return undefined
}

function formatChat(chat: ChatData) {
  const memberNames = (chat.k ?? []) as string[]
  const lastLog = chat.l as Record<string, unknown> | null
  const displayName = memberNames.join(', ') || null

  return {
    chat_id: String(chat.c),
    type: chat.t,
    display_name: displayName,
    active_members: chat.a,
    unread_count: chat.n,
    last_message: lastLog ? {
      author_id: lastLog.authorId,
      message: lastLog.message,
      sent_at: lastLog.sendAt,
    } : null,
  }
}

function matchesSearch(chat: ChatData, term: string): boolean {
  const names = (chat.k ?? []) as string[]
  const lower = term.toLowerCase()
  return names.some((n) => n.toLowerCase().includes(lower))
}

function collectChats(
  chatDatas: ChatData[],
  into: ChatData[],
  seen: Set<string>,
): void {
  for (const chat of chatDatas) {
    const id = String(chat.c)
    if (!seen.has(id)) {
      seen.add(id)
      into.push(chat)
    }
  }
}

const MAX_PAGES = 50

async function listAction(options: {
  all?: boolean
  search?: string
  pretty?: boolean
}): Promise<void> {
  const account = await ensureKakaoAuth()
  const session = new LocoSession()

  try {
    const loginResult = await session.login(
      account.oauth_token,
      account.user_id,
      account.device_uuid ?? `agent-messenger-${account.user_id}`,
    )

    const allChats: ChatData[] = []
    const seenChatIds = new Set<string>()

    collectChats(
      (loginResult.chatDatas ?? []) as ChatData[],
      allChats,
      seenChatIds,
    )

    if (options.all || options.search) {
      let cursor: ChatListResponse = loginResult
      let pages = 0

      while (!cursor.eof && pages < MAX_PAGES) {
        const lastTokenId = bsonToLong(cursor.lastTokenId)
        const lastChatId = bsonToLong(cursor.lastChatId)

        const response = await session.getChatList(lastTokenId, lastChatId)
        const body = response.body as unknown as ChatListResponse
        const chatDatas = (body.chatDatas ?? []) as ChatData[]

        if (chatDatas.length === 0) break

        collectChats(chatDatas, allChats, seenChatIds)
        cursor = body
        pages++

        if (options.search) {
          const found = allChats.some((c) => matchesSearch(c, options.search!))
          if (found) break
        }
      }
    }

    allChats.sort((a, b) => ((b.o as number) ?? 0) - ((a.o as number) ?? 0))

    let results = allChats
    if (options.search) {
      results = allChats.filter((c) => matchesSearch(c, options.search!))
    }

    console.log(formatOutput(results.map(formatChat), options.pretty))
  } catch (error) {
    handleError(error as Error)
  } finally {
    session.close()
  }
}

export const chatCommand = new Command('chat')
  .description('KakaoTalk chat commands')
  .addCommand(
    new Command('list')
      .description('List chat rooms')
      .option('--all', 'Fetch all chats (paginate beyond login snapshot)')
      .option('--search <name>', 'Search for a chat by display name')
      .option('--pretty', 'Pretty print JSON output')
      .action(listAction),
  )
