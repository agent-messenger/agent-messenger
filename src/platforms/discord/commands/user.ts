import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { DiscordClient } from '../client'
import { DiscordCredentialManager } from '../credential-manager'
import type { DiscordUser } from '../types'

async function listAction(options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new DiscordCredentialManager()
    const config = await credManager.load()

    if (!config.token) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    if (!config.current_server) {
      console.log(formatOutput({ error: 'No current server set. Run "server switch <id>" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new DiscordClient(config.token)
    const users = await client.listUsers(config.current_server)

    const output = users.map((user) => ({
      id: user.id,
      username: user.username,
      global_name: user.global_name,
      avatar: user.avatar,
      bot: user.bot,
    }))

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function infoAction(userId: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new DiscordCredentialManager()
    const config = await credManager.load()

    if (!config.token) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new DiscordClient(config.token)

    // Check if requesting current user - use @me endpoint (works with user tokens)
    const me = await client.testAuth()
    let user: DiscordUser

    if (userId === me.id) {
      user = me
    } else {
      // For other users, try the regular endpoint (requires bot token)
      user = await client.getUser(userId)
    }

    const output = {
      id: user.id,
      username: user.username,
      global_name: user.global_name,
      avatar: user.avatar,
      bot: user.bot,
    }

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function meAction(options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new DiscordCredentialManager()
    const config = await credManager.load()

    if (!config.token) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new DiscordClient(config.token)
    const user = await client.testAuth()

    const output = {
      id: user.id,
      username: user.username,
      global_name: user.global_name,
      avatar: user.avatar,
      bot: user.bot,
    }

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const userCommand = new Command('user')
  .description('User commands')
  .addCommand(
    new Command('list')
      .description('List server members')
      .option('--pretty', 'Pretty print JSON output')
      .action(listAction),
  )
  .addCommand(
    new Command('info')
      .description('Get user info')
      .argument('<user-id>', 'User ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(infoAction),
  )
  .addCommand(
    new Command('me')
      .description('Show current authenticated user')
      .option('--pretty', 'Pretty print JSON output')
      .action(meAction),
  )
