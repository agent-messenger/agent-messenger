import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { ensureKakaoAuth } from '../ensure-auth'
import { LocoSession } from '../protocol/session'

async function listAction(
  chatId: string,
  options: { count?: string; from?: string; pretty?: boolean },
): Promise<void> {
  const account = await ensureKakaoAuth()
  const session = new LocoSession()

  try {
    await session.login(
      account.oauth_token,
      account.user_id,
      account.device_uuid ?? `agent-messenger-${account.user_id}`,
    )

    const count = options.count ? Number.parseInt(options.count, 10) : 20
    const fromLogId = options.from ? Number.parseInt(options.from, 10) : 0

    const response = await session.syncMessages(Number(chatId), count, fromLogId)
    const messages = (response.body.chatLogs as Array<Record<string, unknown>> | undefined)?.map((log) => ({
      log_id: log.logId,
      type: log.type,
      author_id: log.authorId,
      message: log.message,
      sent_at: log.sendAt,
      chat_id: log.chatId,
    })) ?? []

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
