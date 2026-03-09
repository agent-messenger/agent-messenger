import { Command } from 'commander'

import { formatOutput } from '@/shared/utils/output'

import { DiscordBotCredentialManager } from '../credential-manager'
import type { BotOption } from './shared'
import { getClient } from './shared'

interface ActionResult {
  success?: boolean
  error?: string
  servers?: Array<{
    id: string
    name: string
    current: boolean
  }>
  id?: string
  name?: string
  icon?: string
  owner?: boolean
}

export async function listAction(options: BotOption): Promise<ActionResult> {
  try {
    const client = await getClient(options)
    const guilds = await client.listGuilds()
    const credManager = options._credManager ?? new DiscordBotCredentialManager()
    const currentServerId = await credManager.getCurrentServer()

    const servers = guilds.map((guild) => ({
      id: guild.id,
      name: guild.name,
      current: guild.id === currentServerId,
    }))

    return { servers }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export async function currentAction(options: BotOption): Promise<ActionResult> {
  try {
    const credManager = options._credManager ?? new DiscordBotCredentialManager()
    const serverId = await credManager.getCurrentServer()

    if (!serverId) {
      return { error: 'No server set. Run "server switch <server-id>" first.' }
    }

    const client = await getClient(options)
    const guild = await client.getGuild(serverId)

    return { id: guild.id, name: guild.name }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export async function switchAction(serverId: string, options: BotOption): Promise<ActionResult> {
  try {
    const client = await getClient(options)
    const guild = await client.getGuild(serverId)

    const credManager = options._credManager ?? new DiscordBotCredentialManager()
    await credManager.setCurrentServer(serverId, guild.name)

    return { id: guild.id, name: guild.name }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export async function infoAction(serverId: string, options: BotOption): Promise<ActionResult> {
  try {
    const client = await getClient(options)
    const guild = await client.getGuild(serverId)

    return { id: guild.id, name: guild.name, icon: guild.icon, owner: guild.owner }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

const cliOutput = (result: ActionResult, pretty?: boolean) => {
  console.log(formatOutput(result, pretty))
}

export const serverCommand = new Command('server')
  .description('Server commands')
  .addCommand(
    new Command('list')
      .description('List all servers')
      .option('--bot <id>', 'Use specific bot')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (opts: BotOption) => {
        cliOutput(await listAction(opts), opts.pretty)
      }),
  )
  .addCommand(
    new Command('current')
      .description('Get current server')
      .option('--bot <id>', 'Use specific bot')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (opts: BotOption) => {
        cliOutput(await currentAction(opts), opts.pretty)
      }),
  )
  .addCommand(
    new Command('switch')
      .description('Switch to a different server')
      .argument('<server>', 'Server ID')
      .option('--bot <id>', 'Use specific bot')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (serverId: string, opts: BotOption) => {
        cliOutput(await switchAction(serverId, opts), opts.pretty)
      }),
  )
  .addCommand(
    new Command('info')
      .description('Get server information')
      .argument('<server>', 'Server ID')
      .option('--bot <id>', 'Use specific bot')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (serverId: string, opts: BotOption) => {
        cliOutput(await infoAction(serverId, opts), opts.pretty)
      }),
  )
