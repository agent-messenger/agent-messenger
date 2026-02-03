import { Command } from 'commander'
import { handleError } from '../../../shared/utils/error-handler'
import { formatOutput } from '../../../shared/utils/output'
import { SlackBotClient } from '../client'
import { SlackBotCredentialManager } from '../credential-manager'

interface ActionOptions {
  pretty?: boolean
  _credManager?: SlackBotCredentialManager
}

interface ActionResult {
  success?: boolean
  error?: string
  workspace_id?: string
  workspace_name?: string
  bot_id?: string
  user?: string
  team?: string
  valid?: boolean
}

export async function setAction(
  token: string,
  options: ActionOptions
): Promise<ActionResult> {
  try {
    // Validate token format
    if (!token.startsWith('xoxb-')) {
      return { error: 'Token must be a bot token (xoxb-). User tokens (xoxp-) are not supported.' }
    }

    const client = new SlackBotClient(token)
    const authInfo = await client.testAuth()

    const credManager = options._credManager ?? new SlackBotCredentialManager()
    await credManager.setCredentials({
      token,
      workspace_id: authInfo.team_id,
      workspace_name: authInfo.team || authInfo.team_id,
    })

    return {
      success: true,
      workspace_id: authInfo.team_id,
      workspace_name: authInfo.team || authInfo.team_id,
      bot_id: authInfo.bot_id,
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
    const creds = await credManager.getCredentials()

    if (!creds) {
      return { 
        valid: false, 
        error: 'No credentials configured. Run "auth set <token>" first.' 
      }
    }

    let valid = false
    let authInfo: { user_id: string; team_id: string; bot_id?: string; user?: string; team?: string } | null = null

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
      bot_id: authInfo?.bot_id,
      user: authInfo?.user,
      team: authInfo?.team,
    }
  } catch (error: any) {
    return { error: error.message }
  }
}

async function setActionCli(token: string, options: { pretty?: boolean }): Promise<void> {
  const result = await setAction(token, options)
  if (result.error) {
    console.log(formatOutput(result, options.pretty))
    process.exit(1)
  }
  console.log(formatOutput(result, options.pretty))
}

async function clearActionCli(options: { pretty?: boolean }): Promise<void> {
  try {
    const result = await clearAction(options)
    console.log(formatOutput(result, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function statusActionCli(options: { pretty?: boolean }): Promise<void> {
  const result = await statusAction(options)
  console.log(formatOutput(result, options.pretty))
  if (!result.valid && result.error) {
    process.exit(1)
  }
}

export const authCommand = new Command('auth')
  .description('Bot authentication commands')
  .addCommand(
    new Command('set')
      .description('Set bot token')
      .argument('<token>', 'Bot token (xoxb-...)')
      .option('--pretty', 'Pretty print JSON output')
      .action(setActionCli)
  )
  .addCommand(
    new Command('clear')
      .description('Clear stored credentials')
      .option('--pretty', 'Pretty print JSON output')
      .action(clearActionCli)
  )
  .addCommand(
    new Command('status')
      .description('Show authentication status')
      .option('--pretty', 'Pretty print JSON output')
      .action(statusActionCli)
  )
