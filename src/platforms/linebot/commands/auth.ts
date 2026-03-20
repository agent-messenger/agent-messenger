import { Command } from 'commander'

import { formatOutput } from '@/shared/utils/output'

import { LineBotClient } from '../client'
import { LineBotCredentialManager } from '../credential-manager'

interface ActionOptions {
  workspace?: string
  pretty?: boolean
  _credManager?: LineBotCredentialManager
}

interface ActionResult {
  success?: boolean
  error?: string
  valid?: boolean
  channel_id?: string
  channel_name?: string
  bot_user_id?: string
  workspaces?: Array<{ channel_id: string; channel_name: string; is_current: boolean }>
}

export async function setAction(channelAccessToken: string, options: ActionOptions): Promise<ActionResult> {
  try {
    const client = new LineBotClient(channelAccessToken)
    const botInfo = await client.getBotInfo()

    const channelId = botInfo.userId
    const channelName = options.workspace || botInfo.displayName

    const credManager = options._credManager ?? new LineBotCredentialManager()
    await credManager.setCredentials({
      channel_id: channelId,
      channel_name: channelName,
      channel_access_token: channelAccessToken,
    })

    return {
      success: true,
      channel_id: channelId,
      channel_name: channelName,
      bot_user_id: botInfo.userId,
    }
  } catch (error: unknown) {
    return { error: (error as Error).message }
  }
}

export async function statusAction(options: ActionOptions): Promise<ActionResult> {
  try {
    const credManager = options._credManager ?? new LineBotCredentialManager()
    const creds = await credManager.getCredentials(options.workspace)

    if (!creds) {
      return {
        valid: false,
        error: options.workspace
          ? `Workspace "${options.workspace}" not found. Run "auth list" to see available workspaces.`
          : 'No credentials configured. Run "auth set <channel-access-token>" first.',
      }
    }

    let valid = false
    let channelId: string | undefined
    let channelName: string | undefined

    try {
      const client = new LineBotClient(creds.channel_access_token)
      const botInfo = await client.getBotInfo()
      valid = true
      channelId = botInfo.userId
      channelName = botInfo.displayName
    } catch {
      channelId = creds.channel_id
      channelName = creds.channel_name
    }

    return { valid, channel_id: channelId, channel_name: channelName }
  } catch (error: unknown) {
    return { error: (error as Error).message }
  }
}

export async function clearAction(options: ActionOptions): Promise<ActionResult> {
  try {
    const credManager = options._credManager ?? new LineBotCredentialManager()
    await credManager.clearCredentials()
    return { success: true }
  } catch (error: unknown) {
    return { error: (error as Error).message }
  }
}

export async function listAction(options: ActionOptions): Promise<ActionResult> {
  try {
    const credManager = options._credManager ?? new LineBotCredentialManager()
    const all = await credManager.listAll()

    return {
      workspaces: all.map((workspace) => ({
        channel_id: workspace.channel_id,
        channel_name: workspace.channel_name,
        is_current: workspace.is_current,
      })),
    }
  } catch (error: unknown) {
    return { error: (error as Error).message }
  }
}

export async function useAction(channelId: string, options: ActionOptions): Promise<ActionResult> {
  try {
    const credManager = options._credManager ?? new LineBotCredentialManager()
    const found = await credManager.setCurrent(channelId)

    if (!found) {
      return { error: `Workspace "${channelId}" not found. Run "auth list" to see available workspaces.` }
    }

    const creds = await credManager.getCredentials()
    return {
      success: true,
      channel_id: creds?.channel_id,
      channel_name: creds?.channel_name,
    }
  } catch (error: unknown) {
    return { error: (error as Error).message }
  }
}

export async function removeAction(channelId: string, options: ActionOptions): Promise<ActionResult> {
  try {
    const credManager = options._credManager ?? new LineBotCredentialManager()
    const removed = await credManager.removeWorkspace(channelId)

    if (!removed) {
      return { error: `Workspace "${channelId}" not found. Run "auth list" to see available workspaces.` }
    }

    return { success: true }
  } catch (error: unknown) {
    return { error: (error as Error).message }
  }
}

function cliOutput(result: ActionResult, pretty?: boolean): void {
  console.log(formatOutput(result, pretty))
  if (result.error) process.exit(1)
}

export const authCommand = new Command('auth')
  .description('Authentication commands')
  .addCommand(
    new Command('set')
      .description('Set channel access token')
      .argument('<channel-access-token>', 'Channel access token from LINE console')
      .option('--workspace <name>', 'Workspace label (defaults to LINE bot display name)')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (channelAccessToken: string, opts: { workspace?: string; pretty?: boolean }) => {
        cliOutput(await setAction(channelAccessToken, opts), opts.pretty)
      }),
  )
  .addCommand(
    new Command('status')
      .description('Show authentication status')
      .option('--workspace <id>', 'Check specific workspace (default: current)')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (opts: { workspace?: string; pretty?: boolean }) => {
        const result = await statusAction(opts)
        console.log(formatOutput(result, opts.pretty))
        if (!result.valid) process.exit(1)
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
    new Command('list')
      .description('List all stored workspaces')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (opts: { pretty?: boolean }) => {
        cliOutput(await listAction(opts), opts.pretty)
      }),
  )
  .addCommand(
    new Command('use')
      .description('Switch active workspace')
      .argument('<channel-id>', 'Channel ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (channelId: string, opts: { pretty?: boolean }) => {
        cliOutput(await useAction(channelId, opts), opts.pretty)
      }),
  )
  .addCommand(
    new Command('remove')
      .description('Remove a stored workspace')
      .argument('<channel-id>', 'Channel ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (channelId: string, opts: { pretty?: boolean }) => {
        cliOutput(await removeAction(channelId, opts), opts.pretty)
      }),
  )
