import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { DiscordClient } from '../client'
import { DiscordCredentialManager } from '../credential-manager'

/** Discord raises both allowances with the server's boost level. */
const STATIC_EMOJI_SLOTS_BY_TIER = [50, 100, 150, 250]
const STICKER_SLOTS_BY_TIER = [5, 15, 30, 60]

export async function listAction(options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new DiscordCredentialManager()
    const config = await credManager.load()
    const servers = Object.values(config.servers)

    const output = servers.map((server) => ({
      id: server.server_id,
      name: server.server_name,
      current: server.server_id === config.current_server,
    }))

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export async function infoAction(serverId: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new DiscordCredentialManager()
    const config = await credManager.load()

    if (!config.token) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const client = await new DiscordClient().login({ token: config.token })
    const server = await client.getServer(serverId)

    const tier = server.premium_tier ?? 0
    const emojis = server.emojis ?? []
    const stickers = server.stickers ?? []
    const staticEmojiCount = emojis.filter((emoji) => !emoji.animated).length

    const output = {
      id: server.id,
      name: server.name,
      icon: server.icon,
      owner_id: server.owner_id,
      premium_tier: tier,
      premium_subscription_count: server.premium_subscription_count ?? 0,
      emoji_count: emojis.length,
      sticker_count: stickers.length,
      static_emoji_slots: STATIC_EMOJI_SLOTS_BY_TIER[tier] ?? STATIC_EMOJI_SLOTS_BY_TIER[0],
      static_emoji_slots_remaining: Math.max(
        0,
        (STATIC_EMOJI_SLOTS_BY_TIER[tier] ?? STATIC_EMOJI_SLOTS_BY_TIER[0]) - staticEmojiCount,
      ),
      sticker_slots: STICKER_SLOTS_BY_TIER[tier] ?? STICKER_SLOTS_BY_TIER[0],
      sticker_slots_remaining: Math.max(0, (STICKER_SLOTS_BY_TIER[tier] ?? STICKER_SLOTS_BY_TIER[0]) - stickers.length),
    }

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export async function switchAction(serverId: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new DiscordCredentialManager()
    const config = await credManager.load()

    if (!config.servers[serverId]) {
      console.log(
        formatOutput(
          { error: `Server not found: ${serverId}`, hint: 'Run "server list" to see available servers.' },
          options.pretty,
        ),
      )
      process.exit(1)
    }

    await credManager.setCurrentServer(serverId)
    console.log(formatOutput({ current: serverId }, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export async function currentAction(options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new DiscordCredentialManager()
    const config = await credManager.load()

    if (!config.current_server) {
      console.log(formatOutput({ error: 'No current server set. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const server = config.servers[config.current_server]

    if (!server) {
      console.log(
        formatOutput(
          {
            error: 'Current server not found in configuration.',
            hint: 'Run "auth extract" to refresh, or "server switch <server-id>".',
          },
          options.pretty,
        ),
      )
      process.exit(1)
    }

    const output = {
      server_id: server.server_id,
      server_name: server.server_name,
    }

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const serverCommand = new Command('server')
  .description('Server management commands')
  .addCommand(
    new Command('list')
      .description('List all servers')
      .option('--pretty', 'Pretty print JSON output')
      .action(listAction),
  )
  .addCommand(
    new Command('info')
      .description('Get server info')
      .argument('<server-id>', 'Server ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(infoAction),
  )
  .addCommand(
    new Command('switch')
      .description('Switch to server')
      .argument('<server-id>', 'Server ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(switchAction),
  )
  .addCommand(
    new Command('current')
      .description('Show current server')
      .option('--pretty', 'Pretty print JSON output')
      .action(currentAction),
  )
