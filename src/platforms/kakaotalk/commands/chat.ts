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

    rawChats.sort((a, b) => ((b.o as number) ?? 0) - ((a.o as number) ?? 0))

    const chatList = rawChats.map((chat) => {
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
    })

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
