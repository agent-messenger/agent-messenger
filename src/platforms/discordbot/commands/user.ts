import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { DiscordBotCredentialManager } from '../credential-manager'
import type { BotOption } from './shared'
import { getClient } from './shared'

interface ActionResult {
  success?: boolean
  error?: string
  users?: Array<{
    id: string
    username: string
    global_name?: string
    avatar?: string
    bot?: boolean
  }>
  id?: string
  username?: string
  global_name?: string
  avatar?: string
  bot?: boolean
}

export async function listAction(options: BotOption): Promise<ActionResult> {
  try {
    const serverId =
      options.server || (await (options._credManager ?? new DiscordBotCredentialManager()).getCurrentServer())
    if (!serverId) {
      return { error: 'No server set. Run "server switch <server-id>" first.' }
    }

    const client = await getClient(options)
    const users = await client.listUsers(serverId)

    return {
      users: users.map((u) => ({
        id: u.id,
        username: u.username,
        global_name: u.global_name,
        avatar: u.avatar,
        bot: u.bot,
      })),
    }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export async function infoAction(userId: string, options: BotOption): Promise<ActionResult> {
  try {
    const client = await getClient(options)
    const user = await client.getUser(userId)

    return {
      id: user.id,
      username: user.username,
      global_name: user.global_name,
      avatar: user.avatar,
      bot: user.bot,
    }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export const userCommand = new Command('user')
  .description('User commands')
  .addCommand(
    new Command('list')
      .description('List users in current server')
      .option('--server <id>', 'Use specific server')
      .option('--bot <id>', 'Use specific bot')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (options: BotOption) => {
        try {
          const result = await listAction(options)
          console.log(formatOutput(result, options.pretty))
        } catch (error) {
          handleError(error as Error)
        }
      }),
  )
  .addCommand(
    new Command('info')
      .description('Get user info')
      .argument('<user-id>', 'User ID')
      .option('--bot <id>', 'Use specific bot')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (userIdArg: string, options: BotOption) => {
        try {
          const result = await infoAction(userIdArg, options)
          console.log(formatOutput(result, options.pretty))
        } catch (error) {
          handleError(error as Error)
        }
      }),
  )
