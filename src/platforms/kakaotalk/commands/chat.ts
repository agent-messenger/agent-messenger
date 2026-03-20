import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { ensureKakaoAuth } from '../ensure-auth'
import { LocoSession } from '../protocol/session'

async function listAction(options: { pretty?: boolean }): Promise<void> {
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

    const toLong = (v: unknown): string => {
      if (v && typeof v === 'object' && 'high' in v && 'low' in v) {
        const { high, low } = v as { high: number; low: number }
        return ((BigInt(high >>> 0) << 32n) | BigInt(low >>> 0)).toString()
      }
      return String(v ?? 0)
    }

    const chatList = rawChats.map((chat) => ({
      chat_id: String(chat.c),
      type: chat.t,
      active_members: chat.a,
      last_seen_log_id: toLong(chat.s),
      last_log_id: toLong(chat.ll),
      joined_at: chat.o,
      push_enabled: chat.p,
    }))

    console.log(formatOutput(chatList, options.pretty))
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
      .option('--pretty', 'Pretty print JSON output')
      .action(listAction),
  )
