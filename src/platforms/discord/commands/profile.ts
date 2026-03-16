import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { DiscordClient } from '../client'
import { DiscordCredentialManager } from '../credential-manager'

async function getAction(userId: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new DiscordCredentialManager()
    const config = await credManager.load()

    if (!config.token) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new DiscordClient(config.token)
    const profile = await client.getUserProfile(userId)

    const output = {
      user: {
        id: profile.user.id,
        username: profile.user.username,
        global_name: profile.user.global_name,
        avatar: profile.user.avatar,
        bot: profile.user.bot,
        bio: profile.user.bio,
      },
      connected_accounts: profile.connected_accounts.map((acc) => ({
        type: acc.type,
        id: acc.id,
        name: acc.name,
        verified: acc.verified,
      })),
      premium_since: profile.premium_since,
      mutual_guilds: profile.mutual_guilds,
    }

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const profileCommand = new Command('profile')
  .description('User profile commands')
  .addCommand(
    new Command('get')
      .description('Get user profile')
      .argument('<user-id>', 'User ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(getAction),
  )
