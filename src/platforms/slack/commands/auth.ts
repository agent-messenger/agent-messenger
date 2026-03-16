import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { SlackClient, SlackError } from '../client'
import { CredentialManager } from '../credential-manager'
import { refreshCookie, tryWebTokenRefresh } from '../ensure-auth'
import { type ExtractedWorkspace, TokenExtractor } from '../token-extractor'

export function formatCredentialDebug(ws: ExtractedWorkspace, showSecrets?: boolean): string {
  const tokenDisplay = showSecrets ? ws.token : `${ws.token.substring(0, 20)}...`
  const cookieDisplay = showSecrets ? ws.cookie : ws.cookie ? 'present' : 'missing'
  return `${ws.workspace_id}: token=${tokenDisplay}, cookie=${cookieDisplay}`
}

async function extractAction(options: {
  pretty?: boolean
  debug?: boolean
  unsafelyShowSecrets?: boolean
}): Promise<void> {
  try {
    if (options.unsafelyShowSecrets) {
      options.debug = true
    }
    const debugLog = options.debug ? (msg: string) => console.error(`[debug] ${msg}`) : undefined
    const extractor = new TokenExtractor(undefined, undefined, undefined, debugLog)

    if (process.platform === 'darwin') {
      console.log('')
      console.log('  Extracting your Slack credentials...')
      console.log('')
      console.log('  Your Mac may ask for your password to access Keychain.')
      console.log('  This is required because Slack encrypts your login cookies')
      console.log('  using macOS Keychain for security.')
      console.log('')
      console.log('  What happens:')
      console.log("    1. We read the encrypted cookie from Slack's local storage")
      console.log('    2. macOS Keychain decrypts it (requires your password)')
      console.log('    3. The credentials are stored locally in ~/.config/agent-messenger/')
      console.log('')
      console.log('  Your password is never stored or transmitted anywhere.')
      console.log('')
    }

    if (options.debug) {
      console.error(`[debug] Slack directory: ${extractor.getSlackDir()}`)
    }

    const workspaces = await extractor.extract()

    if (options.debug) {
      console.error(`[debug] Found ${workspaces.length} workspace(s)`)
      for (const ws of workspaces) {
        console.error(`[debug] - ${formatCredentialDebug(ws, options.unsafelyShowSecrets)}`)
      }
    }

    if (workspaces.length === 0) {
      console.log(
        formatOutput(
          {
            error: 'No workspaces found. Make sure Slack desktop app is installed and logged in.',
            hint: options.debug ? undefined : 'Run with --debug for more info.',
          },
          options.pretty,
        ),
      )
      process.exit(1)
    }

    const credManager = new CredentialManager()
    const config = await credManager.load()
    const workspaceDomains = extractor.getWorkspaceDomains()

    const validWorkspaces = []
    const failureReasons: string[] = []
    for (const ws of workspaces) {
      if (options.debug) {
        console.error(`[debug] Testing credentials for ${ws.workspace_id}...`)
      }

      try {
        const client = new SlackClient(ws.token, ws.cookie)
        const authInfo = await client.testAuth()
        ws.workspace_id = authInfo.team_id
        ws.workspace_name = authInfo.team || ws.workspace_name
        validWorkspaces.push(ws)
        await credManager.setWorkspace(ws)

        if (options.debug) {
          console.error(`[debug] ✓ Valid: ${authInfo.team} (${authInfo.user})`)
        }
      } catch (error) {
        const code = error instanceof SlackError ? error.code : undefined
        if (code && !failureReasons.includes(code)) {
          failureReasons.push(code)
        }
        if (options.debug) {
          console.error(`[debug] ✗ Invalid: ${(error as Error).message}`)
        }

        if (options.debug) {
          const domain = workspaceDomains[ws.workspace_id]
          console.error(
            `[debug] Attempting web token refresh for ${ws.workspace_id}${domain ? ` (${domain}.slack.com)` : ''}...`,
          )
        }
        const refreshed = await tryWebTokenRefresh(ws, workspaceDomains)
        if (refreshed) {
          ws.token = refreshed.token
          ws.workspace_name = refreshed.workspace_name
          validWorkspaces.push(ws)
          await credManager.setWorkspace(ws)

          if (options.debug) {
            console.error(`[debug] ✓ Web refresh succeeded: ${refreshed.workspace_name}`)
          }
        } else if (options.debug) {
          console.error('[debug] ✗ Web refresh failed')
        }
      }
    }

    if (validWorkspaces.length === 0) {
      const errorMessage = getExtractionErrorMessage(failureReasons)
      console.log(
        formatOutput(
          {
            error: errorMessage,
            extracted_count: workspaces.length,
            hint: options.debug ? undefined : 'Run with --debug for more details.',
          },
          options.pretty,
        ),
      )
      process.exit(1)
    }

    if (!config.current_workspace && validWorkspaces.length > 0) {
      await credManager.setCurrentWorkspace(validWorkspaces[0].workspace_id)
    }

    const output = {
      workspaces: validWorkspaces.map((ws) => `${ws.workspace_id}/${ws.workspace_name}`),
      current: config.current_workspace || validWorkspaces[0].workspace_id,
    }

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function logoutAction(workspace: string | undefined, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const config = await credManager.load()

    let targetWorkspace = workspace

    if (!targetWorkspace) {
      if (!config.current_workspace) {
        console.log(formatOutput({ error: 'No current workspace set. Specify a workspace ID.' }, options.pretty))
        process.exit(1)
      }
      targetWorkspace = config.current_workspace
    }

    if (!config.workspaces[targetWorkspace]) {
      console.log(
        formatOutput(
          {
            error: `Workspace not found: ${targetWorkspace}`,
            hint: 'Run "workspace list" to see available workspaces.',
          },
          options.pretty,
        ),
      )
      process.exit(1)
    }

    await credManager.removeWorkspace(targetWorkspace)

    console.log(formatOutput({ removed: targetWorkspace, success: true }, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function statusAction(options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const ws = await credManager.getWorkspace()

    if (!ws) {
      console.log(formatOutput({ error: 'No current workspace set. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    let authInfo: { user_id: string; team_id: string; user?: string; team?: string } | null = null
    let valid = false

    try {
      const client = new SlackClient(ws.token, ws.cookie)
      authInfo = await client.testAuth()
      valid = true
    } catch {
      authInfo = await refreshCookie(ws.token, credManager)
      valid = authInfo !== null
    }

    const output = {
      workspace_id: ws.workspace_id,
      workspace_name: ws.workspace_name,
      user: authInfo?.user,
      team: authInfo?.team,
      valid,
    }

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export function getExtractionErrorMessage(failureReasons: string[]): string {
  if (failureReasons.includes('missing_cookie')) {
    return 'Cookie extraction failed. Make sure the Slack desktop app is installed and grant Keychain access when prompted.'
  }
  if (failureReasons.includes('invalid_auth')) {
    return 'Slack session has expired. Sign into the Slack desktop app, wait a few seconds, then re-run this command.'
  }
  return 'Extracted tokens are invalid. Make sure you are logged into the Slack desktop app.'
}

export const authCommand = new Command('auth')
  .description('Authentication commands')
  .addCommand(
    new Command('extract')
      .description('Extract tokens from Slack desktop app')
      .option('--pretty', 'Pretty print JSON output')
      .option('--debug', 'Show debug output for troubleshooting')
      .option('--unsafely-show-secrets', 'Show full token and cookie values in debug output')
      .action(extractAction),
  )
  .addCommand(
    new Command('logout')
      .description('Logout from workspace')
      .argument('[workspace]', 'Workspace ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(logoutAction),
  )
  .addCommand(
    new Command('status')
      .description('Show authentication status')
      .option('--pretty', 'Pretty print JSON output')
      .action(statusAction),
  )
