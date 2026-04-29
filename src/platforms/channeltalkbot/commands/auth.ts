import { Command } from 'commander'

import { cliOutput } from '@/shared/utils/cli-output'
import { formatOutput } from '@/shared/utils/output'

import { ChannelBotClient } from '../client'
import { ChannelBotCredentialManager } from '../credential-manager'

interface ActionOptions {
  workspace?: string
  pretty?: boolean
  _credManager?: ChannelBotCredentialManager
}

interface ActionResult {
  success?: boolean
  error?: string
  valid?: boolean
  workspace_id?: string
  workspace_name?: string
  workspaces?: Array<{ workspace_id: string; workspace_name: string; is_current: boolean }>
  default_bot?: string
}

export async function setAction(
  accessKey: string,
  accessSecret: string,
  options: ActionOptions,
): Promise<ActionResult> {
  try {
    const client = await new ChannelBotClient().login({ accessKey, accessSecret })
    const channel = await client.getChannel()

    const workspaceId = channel.id
    const workspaceName = options.workspace || channel.name

    const credManager = options._credManager ?? new ChannelBotCredentialManager()
    await credManager.setCredentials({
      workspace_id: workspaceId,
      workspace_name: workspaceName,
      access_key: accessKey,
      access_secret: accessSecret,
    })

    return { success: true, workspace_id: workspaceId, workspace_name: workspaceName }
  } catch (error: unknown) {
    return { error: (error as Error).message }
  }
}

export async function statusAction(options: ActionOptions): Promise<ActionResult> {
  try {
    const credManager = options._credManager ?? new ChannelBotCredentialManager()
    const creds = await credManager.getCredentials(options.workspace)

    if (!creds) {
      return {
        valid: false,
        error: options.workspace
          ? `Workspace "${options.workspace}" not found. Run "auth list" to see available workspaces.`
          : 'No credentials configured. Run "auth set <access-key> <access-secret>" first.',
      }
    }

    let valid = false
    let workspaceId: string | undefined
    let workspaceName: string | undefined

    try {
      const client = await new ChannelBotClient().login({
        accessKey: creds.access_key,
        accessSecret: creds.access_secret,
      })
      const channel = await client.getChannel()
      valid = true
      workspaceId = channel.id
      workspaceName = channel.name
    } catch {
      valid = false
      workspaceId = creds.workspace_id
      workspaceName = creds.workspace_name
    }

    return { valid, workspace_id: workspaceId, workspace_name: workspaceName }
  } catch (error: unknown) {
    return { error: (error as Error).message }
  }
}

export async function clearAction(options: ActionOptions): Promise<ActionResult> {
  try {
    const credManager = options._credManager ?? new ChannelBotCredentialManager()
    await credManager.clearCredentials()
    return { success: true }
  } catch (error: unknown) {
    return { error: (error as Error).message }
  }
}

export async function listAction(options: ActionOptions): Promise<ActionResult> {
  try {
    const credManager = options._credManager ?? new ChannelBotCredentialManager()
    const all = await credManager.listAll()

    return {
      workspaces: all.map((w) => ({
        workspace_id: w.workspace_id,
        workspace_name: w.workspace_name,
        is_current: w.is_current,
      })),
    }
  } catch (error: unknown) {
    return { error: (error as Error).message }
  }
}

export async function useAction(workspaceId: string, options: ActionOptions): Promise<ActionResult> {
  try {
    const credManager = options._credManager ?? new ChannelBotCredentialManager()
    const found = await credManager.setCurrent(workspaceId)

    if (!found) {
      return { error: `Workspace "${workspaceId}" not found. Run "auth list" to see available workspaces.` }
    }

    const creds = await credManager.getCredentials()
    return {
      success: true,
      workspace_id: creds?.workspace_id,
      workspace_name: creds?.workspace_name,
    }
  } catch (error: unknown) {
    return { error: (error as Error).message }
  }
}

export async function removeAction(workspaceId: string, options: ActionOptions): Promise<ActionResult> {
  try {
    const credManager = options._credManager ?? new ChannelBotCredentialManager()
    const removed = await credManager.removeWorkspace(workspaceId)

    if (!removed) {
      return { error: `Workspace "${workspaceId}" not found. Run "auth list" to see available workspaces.` }
    }

    return { success: true }
  } catch (error: unknown) {
    return { error: (error as Error).message }
  }
}

export async function botAction(name: string, options: ActionOptions): Promise<ActionResult> {
  try {
    const credManager = options._credManager ?? new ChannelBotCredentialManager()
    await credManager.setDefaultBot(name)
    return { success: true, default_bot: name }
  } catch (error: unknown) {
    return { error: (error as Error).message }
  }
}

export const authCommand = new Command('auth')
  .description('Authentication commands')
  .addCommand(
    new Command('set')
      .description('Set workspace credentials')
      .argument('<access-key>', 'Access key from Channel Talk settings')
      .argument('<access-secret>', 'Access secret from Channel Talk settings')
      .option('--workspace <name>', 'Workspace label (defaults to channel name)')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (accessKey: string, accessSecret: string, opts: { workspace?: string; pretty?: boolean }) => {
        cliOutput(await setAction(accessKey, accessSecret, opts), opts.pretty)
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
      .argument('<workspace-id>', 'Workspace ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (workspaceId: string, opts: { pretty?: boolean }) => {
        cliOutput(await useAction(workspaceId, opts), opts.pretty)
      }),
  )
  .addCommand(
    new Command('remove')
      .description('Remove a stored workspace')
      .argument('<workspace-id>', 'Workspace ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (workspaceId: string, opts: { pretty?: boolean }) => {
        cliOutput(await removeAction(workspaceId, opts), opts.pretty)
      }),
  )
  .addCommand(
    new Command('bot')
      .description('Set default bot name for sending messages')
      .argument('<name>', 'Bot name')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (name: string, opts: { pretty?: boolean }) => {
        cliOutput(await botAction(name, opts), opts.pretty)
      }),
  )
