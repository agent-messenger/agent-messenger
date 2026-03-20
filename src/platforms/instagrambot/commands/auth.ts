import { Command } from 'commander'

import { formatOutput } from '@/shared/utils/output'

import { InstagramBotClient } from '../client'
import { InstagramBotCredentialManager } from '../credential-manager'

interface ActionOptions {
  workspace?: string
  pretty?: boolean
  _credManager?: InstagramBotCredentialManager
}

interface ActionResult {
  success?: boolean
  error?: string
  valid?: boolean
  workspace_id?: string
  workspace_name?: string
  instagram_account_id?: string
  workspaces?: Array<{
    workspace_id: string
    workspace_name: string
    instagram_account_id: string
    is_current: boolean
  }>
}

export async function setAction(pageId: string, accessToken: string, options: ActionOptions): Promise<ActionResult> {
  try {
    const client = new InstagramBotClient(pageId, accessToken)
    const page = await client.getPageInfo(pageId)

    if (!page.instagram_business_account?.id) {
      return { error: 'The page is not linked to an Instagram business account.' }
    }

    const workspaceId = page.id
    const workspaceName = options.workspace || page.name
    const instagramAccountId = page.instagram_business_account.id

    const credManager = options._credManager ?? new InstagramBotCredentialManager()
    await credManager.setCredentials({
      workspace_id: workspaceId,
      workspace_name: workspaceName,
      page_id: pageId,
      access_token: accessToken,
      instagram_account_id: instagramAccountId,
    })

    return {
      success: true,
      workspace_id: workspaceId,
      workspace_name: workspaceName,
      instagram_account_id: instagramAccountId,
    }
  } catch (error: unknown) {
    return { error: (error as Error).message }
  }
}

export async function statusAction(options: ActionOptions): Promise<ActionResult> {
  try {
    const credManager = options._credManager ?? new InstagramBotCredentialManager()
    const creds = await credManager.getCredentials(options.workspace)

    if (!creds) {
      return {
        valid: false,
        error: options.workspace
          ? `Workspace "${options.workspace}" not found. Run "auth list" to see available workspaces.`
          : 'No credentials configured. Run "auth set <page-id> <access-token>" first.',
      }
    }

    let valid = false
    let workspaceId: string | undefined
    let workspaceName: string | undefined
    let instagramAccountId: string | undefined

    try {
      const client = new InstagramBotClient(creds.page_id, creds.access_token)
      const page = await client.getPageInfo(creds.page_id)
      valid = true
      workspaceId = page.id
      workspaceName = page.name
      instagramAccountId = page.instagram_business_account?.id
    } catch {
      valid = false
      workspaceId = creds.workspace_id
      workspaceName = creds.workspace_name
      instagramAccountId = creds.instagram_account_id
    }

    return {
      valid,
      workspace_id: workspaceId,
      workspace_name: workspaceName,
      instagram_account_id: instagramAccountId,
    }
  } catch (error: unknown) {
    return { error: (error as Error).message }
  }
}

export async function clearAction(options: ActionOptions): Promise<ActionResult> {
  try {
    const credManager = options._credManager ?? new InstagramBotCredentialManager()
    await credManager.clearCredentials()
    return { success: true }
  } catch (error: unknown) {
    return { error: (error as Error).message }
  }
}

export async function listAction(options: ActionOptions): Promise<ActionResult> {
  try {
    const credManager = options._credManager ?? new InstagramBotCredentialManager()
    const all = await credManager.listAll()

    return {
      workspaces: all.map((workspace) => ({
        workspace_id: workspace.workspace_id,
        workspace_name: workspace.workspace_name,
        instagram_account_id: workspace.instagram_account_id,
        is_current: workspace.is_current,
      })),
    }
  } catch (error: unknown) {
    return { error: (error as Error).message }
  }
}

export async function useAction(workspaceId: string, options: ActionOptions): Promise<ActionResult> {
  try {
    const credManager = options._credManager ?? new InstagramBotCredentialManager()
    const found = await credManager.setCurrent(workspaceId)

    if (!found) {
      return { error: `Workspace "${workspaceId}" not found. Run "auth list" to see available workspaces.` }
    }

    const creds = await credManager.getCredentials()
    return {
      success: true,
      workspace_id: creds?.workspace_id,
      workspace_name: creds?.workspace_name,
      instagram_account_id: creds?.instagram_account_id,
    }
  } catch (error: unknown) {
    return { error: (error as Error).message }
  }
}

export async function removeAction(workspaceId: string, options: ActionOptions): Promise<ActionResult> {
  try {
    const credManager = options._credManager ?? new InstagramBotCredentialManager()
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
      .argument('<page-id>', 'Facebook Page ID linked to Instagram')
      .argument('<access-token>', 'Page access token from Meta')
      .option('--workspace <name>', 'Workspace label (defaults to page name)')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (pageId: string, accessToken: string, opts: { workspace?: string; pretty?: boolean }) => {
        cliOutput(await setAction(pageId, accessToken, opts), opts.pretty)
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
