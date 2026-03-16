import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { CredentialManager } from '../credential-manager'

async function listAction(options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const config = await credManager.load()
    const workspaces = Object.values(config.workspaces)

    const output = workspaces.map((ws) => ({
      id: ws.workspace_id,
      name: ws.workspace_name,
      current: ws.workspace_id === config.current_workspace,
    }))

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function switchAction(id: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const config = await credManager.load()

    if (!config.workspaces[id]) {
      console.log(
        formatOutput(
          { error: `Workspace not found: ${id}`, hint: 'Run "workspace list" to see available workspaces.' },
          options.pretty,
        ),
      )
      process.exit(1)
    }

    await credManager.setCurrentWorkspace(id)
    console.log(formatOutput({ current: id }, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function currentAction(options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const workspace = await credManager.getWorkspace()

    if (!workspace) {
      console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const output = {
      workspace_id: workspace.workspace_id,
      workspace_name: workspace.workspace_name,
    }

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function removeAction(id: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const config = await credManager.load()

    if (!config.workspaces[id]) {
      console.log(
        formatOutput(
          { error: `Workspace not found: ${id}`, hint: 'Run "workspace list" to see available workspaces.' },
          options.pretty,
        ),
      )
      process.exit(1)
    }

    await credManager.removeWorkspace(id)
    console.log(formatOutput({ removed: id }, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const workspaceCommand = new Command('workspace')
  .description('Workspace management commands')
  .addCommand(
    new Command('list')
      .description('List all workspaces')
      .option('--pretty', 'Pretty print JSON output')
      .action(listAction),
  )
  .addCommand(
    new Command('switch')
      .description('Switch to workspace')
      .argument('<id>', 'Workspace ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(switchAction),
  )
  .addCommand(
    new Command('current')
      .description('Show current workspace')
      .option('--pretty', 'Pretty print JSON output')
      .action(currentAction),
  )
  .addCommand(
    new Command('remove')
      .description('Remove workspace')
      .argument('<id>', 'Workspace ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(removeAction),
  )
