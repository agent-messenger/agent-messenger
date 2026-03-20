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

    const chatList = loginResult.chatDatas?.map((chat) => ({
      chat_id: chat.chatId,
      type: chat.type,
      members: chat.members?.length ?? 0,
      last_log_id: chat.lastLogId,
      last_message: chat.lastMessage,
      last_update: chat.lastUpdate,
    })) ?? []

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
