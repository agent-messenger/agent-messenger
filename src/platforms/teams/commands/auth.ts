import { Command } from 'commander'
import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'
import { TeamsClient } from '../client'
import { TeamsCredentialManager } from '../credential-manager'
import { TeamsTokenExtractor } from '../token-extractor'

export async function extractAction(options: { pretty?: boolean; debug?: boolean; token?: string }): Promise<void> {
  try {
    let token: string

    if (options.token) {
      token = options.token
      if (options.debug) {
        console.error(`[debug] Using provided token: ${token.substring(0, 20)}...`)
      }
    } else {
      const extractor = new TeamsTokenExtractor()

      if (process.platform === 'darwin') {
        console.log('')
        console.log('  Extracting your Microsoft Teams credentials...')
        console.log('')
        console.log('  Your Mac may ask for your password to access Keychain.')
        console.log('  This is required because Teams encrypts your login token')
        console.log('  using macOS Keychain for security.')
        console.log('')
        console.log('  What happens:')
        console.log("    1. We read the encrypted token from Teams' cookies")
        console.log('    2. macOS Keychain decrypts it (requires your password)')
        console.log('    3. The token is stored locally in ~/.config/agent-messenger/')
        console.log('')
        console.log('  Your password is never stored or transmitted anywhere.')
        console.log('')
      }

      if (options.debug) {
        console.error(`[debug] Extracting Teams token...`)
      }

      const extracted = await extractor.extract()

      if (!extracted) {
        console.log(
          formatOutput(
            {
              error: 'No Teams token found. Make sure Microsoft Teams desktop app is installed and logged in.',
              hint: 'Run with --token <token> to manually provide a token, or --debug for more info.',
            },
            options.pretty,
          ),
        )
        process.exit(1)
      }
      token = extracted.token
    }

    if (options.debug) {
      console.error(`[debug] Token extracted: ${token.substring(0, 20)}...`)
    }

    try {
      const client = new TeamsClient(token)

      if (options.debug) {
        console.error(`[debug] Testing token validity...`)
      }

      const authInfo = await client.testAuth()

      if (options.debug) {
        console.error(`[debug] ✓ Token valid for user: ${authInfo.displayName}`)
        console.error(`[debug] Discovering teams...`)
      }

      const teams = await client.listTeams()

      if (options.debug) {
        console.error(`[debug] ✓ Found ${teams.length} team(s)`)
      }

      if (teams.length === 0) {
        console.log(
          formatOutput(
            {
              error: 'No teams found. Make sure you are a member of at least one Microsoft Teams team.',
            },
            options.pretty,
          ),
        )
        process.exit(1)
      }

      const credManager = new TeamsCredentialManager()
      const teamMap: Record<string, { team_id: string; team_name: string }> = {}

      for (const team of teams) {
        teamMap[team.id] = {
          team_id: team.id,
          team_name: team.name,
        }
      }

      const config = {
        token: token,
        current_team: teams[0].id,
        teams: teamMap,
        token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      }

      await credManager.saveConfig(config)

      if (options.debug) {
        console.error(`[debug] ✓ Credentials saved`)
      }

      const output = {
        teams: teams.map((t) => `${t.id}/${t.name}`),
        current: teams[0].id,
      }

      console.log(formatOutput(output, options.pretty))
    } catch (error) {
      const errorMessage = (error as Error).message
      const is401 = errorMessage.includes('401') || errorMessage.includes('Unauthorized')
      console.log(
        formatOutput(
          {
            error: `Token validation failed: ${errorMessage}`,
            hint: is401
              ? 'Token expired. Open Microsoft Teams, send a message to refresh your session, then run "auth extract" again.'
              : 'Make sure Microsoft Teams desktop app is running and you are logged in.',
          },
          options.pretty,
        ),
      )
      process.exit(1)
    }
  } catch (error) {
    handleError(error as Error)
  }
}

export async function logoutAction(options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new TeamsCredentialManager()
    const config = await credManager.loadConfig()

    if (!config?.token) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    await credManager.clearCredentials()

    console.log(formatOutput({ removed: 'teams', success: true }, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export async function statusAction(options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new TeamsCredentialManager()
    const config = await credManager.loadConfig()

    if (!config?.token) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    let authInfo: { id: string; displayName: string } | null = null
    let valid = false
    const isExpired = await credManager.isTokenExpired()

    if (!isExpired) {
      try {
        const client = new TeamsClient(config.token, config.token_expires_at)
        authInfo = await client.testAuth()
        valid = true
      } catch {
        valid = false
      }
    }

    const output = {
      authenticated: valid,
      user: authInfo?.displayName,
      current_team: config.current_team,
      teams_count: Object.keys(config.teams).length,
      token_expires_at: config.token_expires_at ?? null,
      token_expired: isExpired,
    }

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const authCommand = new Command('auth')
  .description('Authentication commands')
  .addCommand(
    new Command('extract')
      .description('Extract token from Microsoft Teams desktop app')
      .option('--pretty', 'Pretty print JSON output')
      .option('--debug', 'Show debug output for troubleshooting')
      .option('--token <token>', 'Manually provide a token (bypasses auto-extraction)')
      .action(extractAction),
  )
  .addCommand(
    new Command('logout')
      .description('Logout from Microsoft Teams')
      .option('--pretty', 'Pretty print JSON output')
      .action(logoutAction),
  )
  .addCommand(
    new Command('status')
      .description('Show authentication status')
      .option('--pretty', 'Pretty print JSON output')
      .action(statusAction),
  )
