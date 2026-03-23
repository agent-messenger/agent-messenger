import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { KakaoTalkClient } from '../client'
import { ensureKakaoAuth } from '../ensure-auth'

async function listAction(options: {
  all?: boolean
  search?: string
  pretty?: boolean
}): Promise<void> {
  const account = await ensureKakaoAuth()
  let client: KakaoTalkClient | undefined
  try {
    client = new KakaoTalkClient(
      account.oauth_token,
      account.user_id,
      account.device_uuid,
    )
    const chats = await client.getChats({
      all: options.all,
      search: options.search,
    })
    console.log(formatOutput(chats, options.pretty))
  } catch (error) {
    handleError(error as Error)
  } finally {
    client?.close()
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
