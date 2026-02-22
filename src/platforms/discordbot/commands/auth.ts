import { Command } from 'commander'
import { formatOutput } from '@/shared/utils/output'
import { DiscordBotClient } from '../client'
import { DiscordBotCredentialManager } from '../credential-manager'

interface ActionOptions {
  pretty?: boolean
  bot?: string
  _credManager?: DiscordBotCredentialManager
}

interface ActionResult {
  success?: boolean
  error?: string
  bot_id?: string
  bot_name?: string
  server_id?: string
  server_name?: string
  valid?: boolean
  bots?: Array<{
    bot_id: string
    bot_name: string
    is_current: boolean
  }>
}

export async function setAction(token: string, options: ActionOptions): Promise<ActionResult> {
  try {
    const client = new DiscordBotClient(token)
    const authInfo = await client.testAuth()

    if (!authInfo.bot) {
      return { error: 'Token is not a bot token. Use agent-discord for user tokens.' }
    }

    const botId = options.bot || authInfo.id || 'default'
    const botName = authInfo.username || botId

    const guilds = await client.listGuilds()
    const firstGuild = guilds[0]

    const credManager = options._credManager ?? new DiscordBotCredentialManager()
    await credManager.setCredentials({
      token,
      bot_id: botId,
      bot_name: botName,
      server_id: firstGuild?.id,
      server_name: firstGuild?.name,
    })

    return {
      success: true,
      bot_id: botId,
      bot_name: botName,
      server_id: firstGuild?.id,
      server_name: firstGuild?.name,
    }
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function clearAction(options: ActionOptions): Promise<ActionResult> {
  try {
    const credManager = options._credManager ?? new DiscordBotCredentialManager()
    await credManager.clearCredentials()
    return { success: true }
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function statusAction(options: ActionOptions): Promise<ActionResult> {
  try {
    const credManager = options._credManager ?? new DiscordBotCredentialManager()
    const creds = await credManager.getCredentials(options.bot)

    if (!creds) {
      return {
        valid: false,
        error: options.bot
          ? `Bot "${options.bot}" not found. Run "auth list" to see available bots.`
          : 'No credentials configured. Run "auth set <token>" first.',
      }
    }

    let valid = false
    let authInfo: { id: string; username: string; bot?: boolean } | null = null

    try {
      const client = new DiscordBotClient(creds.token)
      authInfo = await client.testAuth()
      valid = authInfo.bot === true
    } catch {
      valid = false
    }

    return {
      valid,
      bot_id: authInfo?.id ?? creds.bot_id,
      bot_name: authInfo?.username ?? creds.bot_name,
      server_id: creds.server_id,
      server_name: creds.server_name,
    }
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function listAction(options: ActionOptions): Promise<ActionResult> {
  try {
    const credManager = options._credManager ?? new DiscordBotCredentialManager()
    const all = await credManager.listAll()

    return {
      bots: all.map((b) => ({
        bot_id: b.bot_id,
        bot_name: b.bot_name,
        is_current: b.is_current,
      })),
    }
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function useAction(botId: string, options: ActionOptions): Promise<ActionResult> {
  try {
    const credManager = options._credManager ?? new DiscordBotCredentialManager()
    const found = await credManager.setCurrent(botId)

    if (!found) {
      return { error: `Bot "${botId}" not found. Run "auth list" to see available bots.` }
    }

    const creds = await credManager.getCredentials()
    return {
      success: true,
      bot_id: creds?.bot_id,
      bot_name: creds?.bot_name,
      server_id: creds?.server_id,
      server_name: creds?.server_name,
    }
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function removeAction(botId: string, options: ActionOptions): Promise<ActionResult> {
  try {
    const credManager = options._credManager ?? new DiscordBotCredentialManager()
    const removed = await credManager.removeBot(botId)

    if (!removed) {
      return { error: `Bot "${botId}" not found. Run "auth list" to see available bots.` }
    }

    return { success: true }
  } catch (error: any) {
    return { error: error.message }
  }
}

function cliOutput(result: ActionResult, pretty?: boolean, exitOnError = true): void {
  console.log(formatOutput(result, pretty))
  if (result.error && exitOnError) process.exit(1)
}

export const authCommand = new Command('auth')
  .description('Bot authentication commands')
  .addCommand(
    new Command('set')
      .description('Set bot token')
      .argument('<token>', 'Bot token')
      .option('--bot <id>', 'Bot identifier for switching later')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (token: string, opts: { bot?: string; pretty?: boolean }) => {
        cliOutput(await setAction(token, opts), opts.pretty)
      }),
  )
  .addCommand(
    new Command('clear')
      .description('Clear all stored credentials')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (opts: { pretty?: boolean }) => {
        cliOutput(await clearAction(opts), opts.pretty)
      }),
  )
  .addCommand(
    new Command('status')
      .description('Show authentication status')
      .option('--bot <id>', 'Check specific bot (default: current)')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (opts: { bot?: string; pretty?: boolean }) => {
        const result = await statusAction(opts)
        console.log(formatOutput(result, opts.pretty))
        if (!result.valid) process.exit(1)
      }),
  )
  .addCommand(
    new Command('list')
      .description('List all stored bots')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (opts: { pretty?: boolean }) => {
        cliOutput(await listAction(opts), opts.pretty)
      }),
  )
  .addCommand(
    new Command('use')
      .description('Switch active bot')
      .argument('<bot>', 'Bot ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (botId: string, opts: { pretty?: boolean }) => {
        cliOutput(await useAction(botId, opts), opts.pretty)
      }),
  )
  .addCommand(
    new Command('remove')
      .description('Remove a stored bot')
      .argument('<bot>', 'Bot ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (botId: string, opts: { pretty?: boolean }) => {
        cliOutput(await removeAction(botId, opts), opts.pretty)
      }),
  )
