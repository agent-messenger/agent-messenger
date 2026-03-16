import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { DiscordClient } from '../client'
import { DiscordCredentialManager } from '../credential-manager'

async function searchAction(
  guildId: string,
  query: string,
  options: { limit?: string; pretty?: boolean },
): Promise<void> {
  try {
    const credManager = new DiscordCredentialManager()
    const config = await credManager.load()

    if (!config.token) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new DiscordClient(config.token)
    const limit = options.limit ? parseInt(options.limit, 10) : 10
    const members = await client.searchMembers(guildId, query, limit)

    const output = members.map((member) => ({
      user: {
        id: member.user.id,
        username: member.user.username,
        global_name: member.user.global_name,
        avatar: member.user.avatar,
        bot: member.user.bot,
      },
      nick: member.nick,
      roles: member.roles,
      joined_at: member.joined_at,
      deaf: member.deaf,
      mute: member.mute,
      flags: member.flags,
    }))

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const memberCommand = new Command('member')
  .description('Member commands')
  .addCommand(
    new Command('search')
      .description('Search guild members')
      .argument('<guild-id>', 'Guild ID')
      .argument('<query>', 'Search query')
      .option('--limit <number>', 'Maximum number of results (default: 10)')
      .option('--pretty', 'Pretty print JSON output')
      .action(searchAction),
  )
