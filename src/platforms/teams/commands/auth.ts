import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { TeamsClient } from '../client'
import { TeamsCredentialManager } from '../credential-manager'
import { TeamsTokenExtractor } from '../token-extractor'
import type { TeamsAccount, TeamsAccountType, TeamsConfig } from '../types'

export async function extractAction(options: { pretty?: boolean; debug?: boolean; token?: string }): Promise<void> {
  try {
    if (options.token) {
      await extractManualToken(options.token, options)
      return
    }

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
      console.error('[debug] Extracting Teams tokens from all accounts...')
    }

    const extracted = await extractor.extract()

    if (extracted.length === 0) {
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

    if (options.debug) {
      console.error(`[debug] Found ${extracted.length} account(s)`)
    }

    const credManager = new TeamsCredentialManager()
    const config: TeamsConfig = { current_account: null, accounts: {} }
    const outputAccounts: Array<{
      account_type: TeamsAccountType
      user: string
      teams: string[]
    }> = []

    for (const { token, accountType } of extracted) {
      if (options.debug) {
        console.error(`[debug] Validating ${accountType} account token...`)
      }

      try {
        const client = new TeamsClient(token)
        const authInfo = await client.testAuth()
        const teams = await client.listTeams()

        if (options.debug) {
          console.error(`[debug] ✓ ${accountType}: ${authInfo.displayName} (${teams.length} team(s))`)
        }

        const teamMap: Record<string, { team_id: string; team_name: string }> = {}
        for (const team of teams) {
          teamMap[team.id] = { team_id: team.id, team_name: team.name }
        }

        const account: TeamsAccount = {
          token,
          token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          account_type: accountType,
          user_name: authInfo.displayName,
          current_team: teams[0]?.id ?? null,
          teams: teamMap,
        }

        config.accounts[accountType] = account
        if (!config.current_account) {
          config.current_account = accountType
        }

        outputAccounts.push({
          account_type: accountType,
          user: authInfo.displayName,
          teams: teams.map((t) => `${t.id}/${t.name}`),
        })
      } catch (error) {
        const errorMessage = (error as Error).message
        const is401 = errorMessage.includes('401') || errorMessage.includes('Unauthorized')
        if (options.debug) {
          console.error(`[debug] ✗ ${accountType}: ${errorMessage}`)
        }
        if (extracted.length === 1) {
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
      }
    }

    if (Object.keys(config.accounts).length === 0) {
      console.log(
        formatOutput(
          { error: 'All extracted tokens failed validation. Make sure Microsoft Teams is running and logged in.' },
          options.pretty,
        ),
      )
      process.exit(1)
    }

    await credManager.saveConfig(config)

    if (options.debug) {
      console.error('[debug] ✓ Credentials saved')
    }

    console.log(
      formatOutput(
        {
          accounts: outputAccounts,
          current_account: config.current_account,
        },
        options.pretty,
      ),
    )
  } catch (error) {
    handleError(error as Error)
  }
}

async function extractManualToken(token: string, options: { pretty?: boolean; debug?: boolean }): Promise<void> {
  if (options.debug) {
    console.error(`[debug] Using provided token: ${token.substring(0, 20)}...`)
  }

  try {
    const client = new TeamsClient(token)
    const authInfo = await client.testAuth()
    const teams = await client.listTeams()

    if (teams.length === 0) {
      console.log(
        formatOutput(
          { error: 'No teams found. Make sure you are a member of at least one Microsoft Teams team.' },
          options.pretty,
        ),
      )
      process.exit(1)
    }

    const credManager = new TeamsCredentialManager()
    const accountType: TeamsAccountType = 'work'

    const teamMap: Record<string, { team_id: string; team_name: string }> = {}
    for (const team of teams) {
      teamMap[team.id] = { team_id: team.id, team_name: team.name }
    }

    const account: TeamsAccount = {
      token,
      token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      account_type: accountType,
      user_name: authInfo.displayName,
      current_team: teams[0].id,
      teams: teamMap,
    }

    const existingConfig = await credManager.loadConfig()
    const config: TeamsConfig = existingConfig ?? { current_account: accountType, accounts: {} }
    config.accounts[accountType] = account
    if (!config.current_account) {
      config.current_account = accountType
    }
    await credManager.saveConfig(config)

    if (options.debug) {
      console.error('[debug] ✓ Credentials saved')
    }

    console.log(
      formatOutput(
        {
          accounts: [
            {
              account_type: accountType,
              user: authInfo.displayName,
              teams: teams.map((t) => `${t.id}/${t.name}`),
            },
          ],
          current_account: accountType,
        },
        options.pretty,
      ),
    )
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
}

export async function logoutAction(options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new TeamsCredentialManager()
    const config = await credManager.loadConfig()

    if (!config || Object.keys(config.accounts).length === 0) {
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

    if (!config || Object.keys(config.accounts).length === 0) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    const accountStatuses: Array<{
      account_type: string
      authenticated: boolean
      user: string | null
      teams_count: number
      token_expires_at: string | null
      token_expired: boolean
      current: boolean
    }> = []

    for (const [key, account] of Object.entries(config.accounts)) {
      const isExpired = account.token_expires_at ? new Date(account.token_expires_at).getTime() <= Date.now() : true

      let displayName: string | null = account.user_name ?? null
      let valid = false

      if (!isExpired) {
        try {
          const client = new TeamsClient(account.token, account.token_expires_at)
          const authInfo = await client.testAuth()
          displayName = authInfo.displayName
          valid = true
        } catch {
          valid = false
        }
      }

      accountStatuses.push({
        account_type: key,
        authenticated: valid,
        user: displayName,
        teams_count: Object.keys(account.teams).length,
        token_expires_at: account.token_expires_at ?? null,
        token_expired: isExpired,
        current: key === config.current_account,
      })
    }

    console.log(
      formatOutput(
        {
          current_account: config.current_account,
          accounts: accountStatuses,
        },
        options.pretty,
      ),
    )
  } catch (error) {
    handleError(error as Error)
  }
}

export async function switchAccountAction(accountType: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new TeamsCredentialManager()
    const config = await credManager.loadConfig()

    if (!config || !config.accounts[accountType]) {
      const available = config ? Object.keys(config.accounts).join(', ') : 'none'
      console.log(
        formatOutput(
          {
            error: `Account not found: ${accountType}`,
            available,
            hint: 'Run "auth extract" to discover all accounts.',
          },
          options.pretty,
        ),
      )
      process.exit(1)
    }

    await credManager.setCurrentAccount(accountType as TeamsAccountType)
    const account = config.accounts[accountType]

    console.log(
      formatOutput(
        {
          current_account: accountType,
          user: account.user_name,
          teams_count: Object.keys(account.teams).length,
        },
        options.pretty,
      ),
    )
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
  .addCommand(
    new Command('switch-account')
      .description('Switch active account (work or personal)')
      .argument('<account-type>', 'Account type: work or personal')
      .option('--pretty', 'Pretty print JSON output')
      .action(switchAccountAction),
  )
