import { Command } from 'commander'

import { formatOutput } from '@/shared/utils/output'

import { ChannelClient } from '../client'
import { ChannelCredentialManager } from '../credential-manager'
import { ensureChannelAuth } from '../ensure-auth'

interface ActionOptions {
  workspace?: string
  pretty?: boolean
  _credManager?: ChannelCredentialManager
}

interface WorkspaceSummary {
  workspace_id: string
  workspace_name: string
  is_current?: boolean
}

interface ExtractResult {
  success: true
  workspaces: Array<{ workspace_id: string; workspace_name: string }>
  current_workspace_id: string
}

interface StatusResult {
  valid: boolean
  workspace_id?: string
  workspace_name?: string
  account_name?: string
  error?: string
}

interface SuccessResult {
  success: true
  workspace_id?: string
}

interface ErrorResult {
  error: string
}

type ActionResult = ExtractResult | StatusResult | SuccessResult | ErrorResult | WorkspaceSummary[]

type ChannelClientLike = Pick<ChannelClient, 'getAccount'>
type ChannelCredentialManagerLike = Pick<
  ChannelCredentialManager,
  'getCredentials' | 'listAll' | 'clearCredentials' | 'setCurrent' | 'removeWorkspace'
>

let createChannelClient = (accountCookie: string, sessionCookie: string): ChannelClientLike =>
  new ChannelClient(accountCookie, sessionCookie)

let createCredentialManager = (): ChannelCredentialManagerLike => new ChannelCredentialManager()

export function setChannelAuthCommandDependenciesForTesting(dependencies: {
  createChannelClient?: (accountCookie: string, sessionCookie: string) => ChannelClientLike
  createCredentialManager?: () => ChannelCredentialManagerLike
}): void {
  if (dependencies.createChannelClient) {
    createChannelClient = dependencies.createChannelClient
  }
  if (dependencies.createCredentialManager) {
    createCredentialManager = dependencies.createCredentialManager
  }
}

export function resetChannelAuthCommandDependenciesForTesting(): void {
  createChannelClient = (accountCookie: string, sessionCookie: string): ChannelClientLike =>
    new ChannelClient(accountCookie, sessionCookie)
  createCredentialManager = (): ChannelCredentialManagerLike => new ChannelCredentialManager()
}

export async function extractAction(options: ActionOptions = {}): Promise<ExtractResult | ErrorResult> {
  try {
    const credManager = options._credManager ?? createCredentialManager()
    await ensureChannelAuth()

    const workspaces = await credManager.listAll()
    const current = await credManager.getCredentials()

    if (workspaces.length === 0 || !current) {
      return {
        error: 'No credentials. Make sure Channel Talk desktop app is installed and logged in.',
      }
    }

    return {
      success: true,
      workspaces: workspaces.map((workspace) => ({
        workspace_id: workspace.workspace_id,
        workspace_name: workspace.workspace_name,
      })),
      current_workspace_id: current.workspace_id,
    }
  } catch (error: unknown) {
    return { error: (error as Error).message }
  }
}

export async function statusAction(options: ActionOptions = {}): Promise<StatusResult> {
  try {
    const credManager = options._credManager ?? createCredentialManager()
    const creds = await credManager.getCredentials(options.workspace)

    if (!creds) {
      return {
        valid: false,
        error: options.workspace
          ? `Workspace "${options.workspace}" not found. Run "auth list" to see available workspaces.`
          : 'No credentials. Run "agent-channel auth extract" first.',
      }
    }

    const storedWorkspace = (await credManager.listAll()).find((workspace) => workspace.workspace_id === creds.workspace_id)

    try {
      const client = createChannelClient(creds.account_cookie, creds.session_cookie)
      const account = await client.getAccount()

      return {
        valid: true,
        workspace_id: creds.workspace_id,
        workspace_name: creds.workspace_name,
        account_name: account.name,
      }
    } catch (error: unknown) {
      return {
        valid: false,
        workspace_id: creds.workspace_id,
        workspace_name: creds.workspace_name,
        account_name: storedWorkspace?.account_name,
        error: (error as Error).message,
      }
    }
  } catch (error: unknown) {
    return { valid: false, error: (error as Error).message }
  }
}

export async function clearAction(options: ActionOptions = {}): Promise<SuccessResult | ErrorResult> {
  try {
    const credManager = options._credManager ?? createCredentialManager()
    await credManager.clearCredentials()
    return { success: true }
  } catch (error: unknown) {
    return { error: (error as Error).message }
  }
}

export async function listAction(options: ActionOptions = {}): Promise<WorkspaceSummary[] | ErrorResult> {
  try {
    const credManager = options._credManager ?? createCredentialManager()
    const all = await credManager.listAll()

    return all.map((workspace) => ({
      workspace_id: workspace.workspace_id,
      workspace_name: workspace.workspace_name,
      is_current: workspace.is_current,
    }))
  } catch (error: unknown) {
    return { error: (error as Error).message }
  }
}

export async function useAction(workspaceId: string, options: ActionOptions = {}): Promise<SuccessResult | ErrorResult> {
  try {
    const credManager = options._credManager ?? createCredentialManager()
    const found = await credManager.setCurrent(workspaceId)

    if (!found) {
      return { error: `Workspace "${workspaceId}" not found. Run "auth list" to see available workspaces.` }
    }

    return {
      success: true,
      workspace_id: workspaceId,
    }
  } catch (error: unknown) {
    return { error: (error as Error).message }
  }
}

export async function removeAction(workspaceId: string, options: ActionOptions = {}): Promise<SuccessResult | ErrorResult> {
  try {
    const credManager = options._credManager ?? createCredentialManager()
    const removed = await credManager.removeWorkspace(workspaceId)

    if (!removed) {
      return { error: `Workspace "${workspaceId}" not found. Run "auth list" to see available workspaces.` }
    }

    return {
      success: true,
      workspace_id: workspaceId,
    }
  } catch (error: unknown) {
    return { error: (error as Error).message }
  }
}

function cliOutput(result: ActionResult, pretty?: boolean, exitOnError = true): void {
  console.log(formatOutput(result, pretty))

  if (exitOnError && !Array.isArray(result) && 'error' in result && result.error) {
    process.exit(1)
  }
}

export function createAuthCommand(): Command {
  return new Command('auth')
    .description('Authentication commands')
    .addCommand(
      new Command('extract')
        .description('Extract cookies from Channel Talk desktop app')
        .option('--pretty', 'Pretty print JSON output')
        .action(async (opts: { pretty?: boolean }) => {
          cliOutput(await extractAction(opts), opts.pretty)
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
          if (!result.valid) {
            process.exit(1)
          }
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
}

export const authCommand = createAuthCommand()
