import { Command } from 'commander'

import { formatOutput } from '@/shared/utils/output'

import { SlackBotClient } from '../client'
import { SlackBotCredentialManager } from '../credential-manager'

interface ActionOptions {
  pretty?: boolean
  bot?: string
  name?: string
  _credManager?: SlackBotCredentialManager
}

interface ActionResult {
  success?: boolean
  error?: string
  workspace_id?: string
  workspace_name?: string
  bot_id?: string
  bot_name?: string
  user?: string
  team?: string
  valid?: boolean
  bots?: Array<{
    workspace_id: string
    workspace_name: string
    bot_id: string
    bot_name: string
    is_current: boolean
  }>
}

export async function setAction(token: string, options: ActionOptions): Promise<ActionResult> {
  try {
    if (!token.startsWith('xoxb-')) {
      return { error: 'Token must be a bot token (xoxb-). User tokens (xoxp-) are not supported.' }
    }

    const client = new SlackBotClient(token)
    const authInfo = await client.testAuth()

    const botId = options.bot || authInfo.bot_id || authInfo.user || 'default'
    const botName = options.name || authInfo.user || botId

    const credManager = options._credManager ?? new SlackBotCredentialManager()
    await credManager.setCredentials({
      token,
      workspace_id: authInfo.team_id,
      workspace_name: authInfo.team || authInfo.team_id,
      bot_id: botId,
      bot_name: botName,
    })

    return {
      success: true,
      workspace_id: authInfo.team_id,
      workspace_name: authInfo.team || authInfo.team_id,
      bot_id: botId,
      bot_name: botName,
      user: authInfo.user,
      team: authInfo.team,
    }
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function clearAction(options: ActionOptions): Promise<ActionResult> {
  try {
    const credManager = options._credManager ?? new SlackBotCredentialManager()
    await credManager.clearCredentials()
    return { success: true }
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function statusAction(options: ActionOptions): Promise<ActionResult> {
  try {
    const credManager = options._credManager ?? new SlackBotCredentialManager()
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
    let authInfo: {
      user_id: string
      team_id: string
      bot_id?: string
      user?: string
      team?: string
    } | null = null

    try {
      const client = new SlackBotClient(creds.token)
      authInfo = await client.testAuth()
      valid = true
    } catch {
      valid = false
    }

    return {
      valid,
      workspace_id: creds.workspace_id,
      workspace_name: creds.workspace_name,
      bot_id: creds.bot_id,
      bot_name: creds.bot_name,
      user: authInfo?.user,
      team: authInfo?.team,
    }
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function listAction(options: ActionOptions): Promise<ActionResult> {
  try {
    const credManager = options._credManager ?? new SlackBotCredentialManager()
    const all = await credManager.listAll()

    return {
      bots: all.map((b) => ({
        workspace_id: b.workspace_id,
        workspace_name: b.workspace_name,
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
    const credManager = options._credManager ?? new SlackBotCredentialManager()
    const found = await credManager.setCurrent(botId)

    if (!found) {
      return { error: `Bot "${botId}" not found. Run "auth list" to see available bots.` }
    }

    const creds = await credManager.getCredentials()
    return {
      success: true,
      workspace_id: creds?.workspace_id,
      workspace_name: creds?.workspace_name,
      bot_id: creds?.bot_id,
      bot_name: creds?.bot_name,
    }
  } catch (error: any) {
    return { error: error.message }
  }
}

export async function removeAction(botId: string, options: ActionOptions): Promise<ActionResult> {
  try {
    const credManager = options._credManager ?? new SlackBotCredentialManager()
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
      .argument('<token>', 'Bot token (xoxb-...)')
      .option('--bot <id>', 'Bot identifier for switching later')
      .option('--name <name>', 'Human-readable bot name')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (token: string, opts: { bot?: string; name?: string; pretty?: boolean }) => {
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
      .argument('<bot>', 'Bot ID or workspace_id/bot_id')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (botId: string, opts: { pretty?: boolean }) => {
        cliOutput(await useAction(botId, opts), opts.pretty)
      }),
  )
  .addCommand(
    new Command('remove')
      .description('Remove a stored bot')
      .argument('<bot>', 'Bot ID or workspace_id/bot_id')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (botId: string, opts: { pretty?: boolean }) => {
        cliOutput(await removeAction(botId, opts), opts.pretty)
      }),
  )
