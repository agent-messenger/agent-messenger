import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { withKakaoClient } from './shared'

async function listAction(
  chatId: string,
  options: {
    account?: string
    pretty?: boolean
  },
): Promise<void> {
  try {
    const members = await withKakaoClient(options, (client) => client.getMembers(chatId))
    console.log(formatOutput(members, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function kickAction(
  chatId: string,
  userId: string,
  options: {
    account?: string
    force?: boolean
    pretty?: boolean
  },
): Promise<void> {
  // Kicking cannot be undone and also blocks the member from rejoining, so a
  // scripted call must opt in explicitly. Without --force, print what would
  // happen and exit without connecting.
  if (!options.force) {
    console.log(
      formatOutput(
        {
          warning: 'Kicking is irreversible and blocks the member from rejoining. Use --force to confirm.',
          action: 'kick',
          chat_id: chatId,
          user_id: userId,
        },
        options.pretty,
      ),
    )
    process.exit(1)
  }

  try {
    const result = await withKakaoClient(options, (client) => client.kickMember(chatId, userId))
    console.log(formatOutput(result, options.pretty))
    if (!result.success) {
      process.exit(1)
    }
  } catch (error) {
    handleError(error as Error)
  }
}

async function kickListAction(
  chatId: string,
  options: {
    account?: string
    pretty?: boolean
  },
): Promise<void> {
  try {
    const result = await withKakaoClient(options, (client) => client.getKickList(chatId))
    console.log(formatOutput(result, options.pretty))
    if (!result.success) {
      process.exit(1)
    }
  } catch (error) {
    handleError(error as Error)
  }
}

async function unkickAction(
  chatId: string,
  userId: string,
  options: {
    account?: string
    pretty?: boolean
  },
): Promise<void> {
  try {
    const result = await withKakaoClient(options, (client) => client.unkickMember(chatId, userId))
    console.log(formatOutput(result, options.pretty))
    if (!result.success) {
      process.exit(1)
    }
  } catch (error) {
    handleError(error as Error)
  }
}

export const memberCommand = new Command('member')
  .description('KakaoTalk member commands')
  .addCommand(
    new Command('list')
      .description('List members of a chat room')
      .argument('<chat-id>', 'Chat room ID')
      .option('--account <id>', 'Use a specific KakaoTalk account')
      .option('--pretty', 'Pretty print JSON output')
      .action(listAction),
  )
  .addCommand(
    new Command('kick')
      .description('Kick a member from an open chat (irreversible; requires host or co-host)')
      .argument('<chat-id>', 'Open chat room ID')
      .argument('<user-id>', 'User ID to kick')
      .option('--force', 'Confirm the kick')
      .option('--account <id>', 'Use a specific KakaoTalk account')
      .option('--pretty', 'Pretty print JSON output')
      .action(kickAction),
  )
  .addCommand(
    new Command('kick-list')
      .description('List members kicked from an open chat (blocked from rejoining)')
      .argument('<chat-id>', 'Open chat room ID')
      .option('--account <id>', 'Use a specific KakaoTalk account')
      .option('--pretty', 'Pretty print JSON output')
      .action(kickListAction),
  )
  .addCommand(
    new Command('unkick')
      .description('Remove a member from an open chat kick list so they can rejoin')
      .argument('<chat-id>', 'Open chat room ID')
      .argument('<user-id>', 'User ID to remove from the kick list')
      .option('--account <id>', 'Use a specific KakaoTalk account')
      .option('--pretty', 'Pretty print JSON output')
      .action(unkickAction),
  )
