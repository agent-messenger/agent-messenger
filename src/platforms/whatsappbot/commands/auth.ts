import { Command } from 'commander'

import { formatOutput } from '@/shared/utils/output'

import { WhatsAppBotClient } from '../client'
import { WhatsAppBotCredentialManager } from '../credential-manager'

interface ActionOptions {
  workspace?: string
  pretty?: boolean
  _credManager?: WhatsAppBotCredentialManager
}

interface ActionResult {
  success?: boolean
  error?: string
  valid?: boolean
  workspace_id?: string
  workspace_name?: string
  workspaces?: Array<{ workspace_id: string; workspace_name: string; is_current: boolean }>
}

export async function setAction(
  phoneNumberId: string,
  accessToken: string,
  options: ActionOptions,
): Promise<ActionResult> {
  try {
    const client = new WhatsAppBotClient(phoneNumberId, accessToken)
    const profile = await client.getBusinessProfile()
    const workspaceName = options.workspace || profile.about || profile.description || phoneNumberId

    const credManager = options._credManager ?? new WhatsAppBotCredentialManager()
    await credManager.setCredentials({
      workspace_id: phoneNumberId,
      workspace_name: workspaceName,
      phone_number_id: phoneNumberId,
      access_token: accessToken,
    })

    return { success: true, workspace_id: phoneNumberId, workspace_name: workspaceName }
  } catch (error: unknown) {
    return { error: (error as Error).message }
  }
}

export async function statusAction(options: ActionOptions): Promise<ActionResult> {
  try {
    const credManager = options._credManager ?? new WhatsAppBotCredentialManager()
    const creds = await credManager.getCredentials(options.workspace)

    if (!creds) {
      return {
        valid: false,
        error: options.workspace
          ? `Workspace "${options.workspace}" not found. Run "auth list" to see available workspaces.`
          : 'No credentials configured. Run "auth set <phone-number-id> <access-token>" first.',
      }
    }

    let valid = false
    let workspaceId: string | undefined
    let workspaceName: string | undefined

    try {
      const client = new WhatsAppBotClient(creds.phone_number_id, creds.access_token)
      const profile = await client.getBusinessProfile()
      valid = true
      workspaceId = creds.workspace_id
      workspaceName = profile.about || profile.description || creds.workspace_name
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
    const credManager = options._credManager ?? new WhatsAppBotCredentialManager()
    await credManager.clearCredentials()
    return { success: true }
  } catch (error: unknown) {
    return { error: (error as Error).message }
  }
}

export async function listAction(options: ActionOptions): Promise<ActionResult> {
  try {
    const credManager = options._credManager ?? new WhatsAppBotCredentialManager()
    const all = await credManager.listAll()

    return {
      workspaces: all.map((workspace) => ({
        workspace_id: workspace.workspace_id,
        workspace_name: workspace.workspace_name,
        is_current: workspace.is_current,
      })),
    }
  } catch (error: unknown) {
    return { error: (error as Error).message }
  }
}

export async function useAction(workspaceId: string, options: ActionOptions): Promise<ActionResult> {
  try {
    const credManager = options._credManager ?? new WhatsAppBotCredentialManager()
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
    const credManager = options._credManager ?? new WhatsAppBotCredentialManager()
    const removed = await credManager.removeWorkspace(workspaceId)

    if (!removed) {
      return { error: `Workspace "${workspaceId}" not found. Run "auth list" to see available workspaces.` }
    }

    return { success: true }
  } catch (error: unknown) {
    return { error: (error as Error).message }
  }
}

function cliOutput(result: ActionResult, pretty?: boolean, exitOnError = true): void {
  console.log(formatOutput(result, pretty))
  if (result.error && exitOnError) process.exit(1)
}

export const authCommand = new Command('auth')
  .description('Authentication commands')
  .addCommand(
    new Command('set')
      .description('Set workspace credentials')
      .argument('<phone-number-id>', 'WhatsApp Business phone number ID')
      .argument('<access-token>', 'Meta system user access token')
      .option('--workspace <name>', 'Workspace label (defaults to business profile about/description)')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (phoneNumberId: string, accessToken: string, opts: { workspace?: string; pretty?: boolean }) => {
        cliOutput(await setAction(phoneNumberId, accessToken, opts), opts.pretty)
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
