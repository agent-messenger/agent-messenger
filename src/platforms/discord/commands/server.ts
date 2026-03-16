import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { DiscordClient } from '../client'
import { DiscordCredentialManager } from '../credential-manager'

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

    const client = new DiscordClient(config.token)
    const server = await client.getServer(serverId)

    const output = {
      id: server.id,
      name: server.name,
      icon: server.icon,
      owner: server.owner,
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
