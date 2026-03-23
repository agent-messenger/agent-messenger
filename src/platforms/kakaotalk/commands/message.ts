import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { KakaoTalkClient } from '../client'
import { ensureKakaoAuth } from '../ensure-auth'

async function listAction(
  chatId: string,
  options: { count?: string; from?: string; pretty?: boolean },
): Promise<void> {
  const account = await ensureKakaoAuth()
  const client = new KakaoTalkClient(
    account.oauth_token,
    account.user_id,
    account.device_uuid,
  )

  try {
    const count = options.count ? Number.parseInt(options.count, 10) : 20
    const messages = await client.getMessages(chatId, {
      count,
      from: options.from,
    })
    console.log(formatOutput(messages, options.pretty))
  } catch (error) {
    handleError(error as Error)
  } finally {
    client.close()
  }
}

async function sendAction(
  chatId: string,
  text: string,
  options: { pretty?: boolean },
): Promise<void> {
  const account = await ensureKakaoAuth()
  const client = new KakaoTalkClient(
    account.oauth_token,
    account.user_id,
    account.device_uuid,
  )

  try {
    const result = await client.sendMessage(chatId, text)
    console.log(formatOutput(result, options.pretty))
  } catch (error) {
    handleError(error as Error)
  } finally {
    client.close()
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
