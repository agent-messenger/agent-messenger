import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { DiscordClient } from '../client'
import { DiscordCredentialManager } from '../credential-manager'

export async function listAction(options: { limit?: number; guild?: string; pretty?: boolean }): Promise<void> {
  try {
    const credManager = new DiscordCredentialManager()
    const config = await credManager.load()

    if (!config.token) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = new DiscordClient(config.token)
    const mentions = await client.getMentions({
      limit: options.limit,
      guildId: options.guild,
    })

    const output = mentions.map((mention) => ({
      id: mention.id,
      channel_id: mention.channel_id,
      author: mention.author.username,
      content: mention.content,
      timestamp: mention.timestamp,
      mention_everyone: mention.mention_everyone,
      mentioned_users: mention.mentions.map((u) => u.username),
      guild_id: mention.guild_id || null,
    }))

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const mentionCommand = new Command('mention').description('Mention commands').addCommand(
  new Command('list')
    .description('List mentions')
    .option('--limit <n>', 'Number of mentions to fetch', '25')
    .option('--guild <guild-id>', 'Filter by guild ID')
    .option('--pretty', 'Pretty print JSON output')
    .action((options) => {
      listAction({
        limit: options.limit ? parseInt(options.limit, 10) : undefined,
        guild: options.guild,
        pretty: options.pretty,
      })
    }),
)
