import { Command } from 'commander'

import { collectBrowserProfileOption } from '@/shared/chromium'
import { handleError } from '@/shared/utils/error-handler'
import { isInteractive } from '@/shared/utils/interactive'
import { formatOutput } from '@/shared/utils/output'
import { debug, info } from '@/shared/utils/stderr'

import { TeamsClient } from '../client'
import { TeamsCredentialManager } from '../credential-manager'
import { completeDeviceCode, loginWithDeviceCode, PendingApprovalError, startDeviceCode } from '../device-login'
import { probeAccountType } from '../realm-discovery'
import { TeamsCachedKeyRejectedError, TeamsTokenExtractor, resolveTeamsTokenSource } from '../token-extractor'
import type { TeamsAccount, TeamsAccountType, TeamsConfig } from '../types'

interface LoginOptions {
  pretty?: boolean
  debug?: boolean
  deviceCode?: string
  clientId?: string
  accountType?: string
  email?: string
}

export async function loginAction(options: LoginOptions): Promise<void> {
  try {
    const explicitAccountType = resolveLoginAccountType(options.accountType)
    if (options.deviceCode) {
      await finishDeviceCode(options, explicitAccountType)
      return
    }
    if (!isInteractive()) {
      const accountType = options.email
        ? await resolveAccountTypeFromEmail(options, explicitAccountType)
        : explicitAccountType
      await startNonInteractiveLogin(options.clientId, accountType)
      return
    }

    const debugLog = options.debug ? (msg: string) => debug(`[debug] ${msg}`) : undefined
    const accountType = await resolveAccountTypeFromEmail(options, explicitAccountType)
    const result = await loginWithDeviceCode({
      clientId: options.clientId,
      accountType,
      onCode: async ({ verificationUri, userCode }) => {
        info(`\nTo sign in, open ${verificationUri} and enter code ${userCode}\n`)
        info(`Waiting for approval of code ${userCode}...`)
      },
      onPending: () => info('Approved. Finishing sign-in...'),
      debug: debugLog,
    })

    console.log(
      formatOutput(
        {
          authenticated: true,
          account_type: result.accountType,
          user: result.userName,
          teams: result.teams.map((t) => `${t.id}/${t.name}`),
          current: result.current,
        },
        options.pretty,
      ),
    )
  } catch (error) {
    handleError(error as Error)
  }
}

function resolveLoginAccountType(value: string | undefined): TeamsAccountType {
  if (value === undefined) return 'work'
  if (value === 'work' || value === 'personal') return value
  throw new Error('Invalid account type. Use "work" or "personal".')
}

// When the user did not force --account-type, look the account up by email so a
// personal account is routed to the personal flow up front instead of failing
// after approval. Any misstep falls back to the caller's default account type.
async function resolveAccountTypeFromEmail(
  options: LoginOptions,
  fallback: TeamsAccountType,
): Promise<TeamsAccountType> {
  if (options.accountType !== undefined) return fallback

  const email = options.email ?? (isInteractive() ? await promptEmail() : undefined)
  if (!email) return fallback

  const probed = await probeAccountType(email)
  if (!probed) return fallback
  if (probed === 'personal') {
    info('Detected a personal Microsoft account. Using personal sign-in.')
  }
  return probed
}

async function promptEmail(): Promise<string | undefined> {
  const { createInterface } = await import('node:readline/promises')
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
  try {
    const answer = await rl.question('Microsoft email (press Enter to skip): ')
    return answer.trim() || undefined
  } finally {
    rl.close()
  }
}

async function startNonInteractiveLogin(
  clientIdOverride: string | undefined,
  accountType: TeamsAccountType,
): Promise<void> {
  const { info: device, clientId } = await startDeviceCode(clientIdOverride, accountType)
  const clientIdFlag = clientIdOverride ? ` --client-id ${clientIdOverride}` : ''
  const accountTypeFlag = accountType === 'personal' ? ' --account-type personal' : ''
  console.log(
    formatOutput({
      next_action: 'authorize',
      account_type: accountType,
      verification_uri: device.verificationUri,
      verification_uri_complete: device.verificationUriComplete,
      user_code: device.userCode,
      device_code: device.deviceCode,
      client_id: clientId,
      expires_at: Date.now() + device.expiresIn * 1000,
      message: `Show the user \`verification_uri\` and \`user_code\` (or \`verification_uri_complete\`) and ask them to approve in a browser. After they approve, run \`agent-teams auth login --device-code <device_code>${clientIdFlag}${accountTypeFlag}\` to finish.`,
    }),
  )
  process.exit(0)
}

async function finishDeviceCode(options: LoginOptions, accountType: TeamsAccountType): Promise<void> {
  const { getTeamsAppClientId } = await import('../app-config')
  const clientId = options.clientId ?? getTeamsAppClientId(accountType).clientId
  try {
    const result = await completeDeviceCode(options.deviceCode!, clientId, undefined, accountType)
    console.log(
      formatOutput(
        {
          authenticated: true,
          account_type: result.accountType,
          user: result.userName,
          teams: result.teams.map((t) => `${t.id}/${t.name}`),
          current: result.current,
        },
        options.pretty,
      ),
    )
  } catch (error) {
    if (error instanceof PendingApprovalError) {
      const clientIdFlag = options.clientId ? ` --client-id ${options.clientId}` : ''
      const accountTypeFlag = options.accountType ? ` --account-type ${accountType}` : ''
      console.log(
        formatOutput(
          {
            next_action: 'still_pending',
            device_code: options.deviceCode,
            message: `User has not approved yet. Confirm they completed authorization in the browser, then run \`agent-teams auth login --device-code <device_code>${clientIdFlag}${accountTypeFlag}\` again.`,
          },
          options.pretty,
        ),
      )
      process.exit(0)
    }
    console.log(
      formatOutput(
        {
          next_action: 'restart',
          error: (error as Error).message,
          message: 'This device code is no longer valid. Run `agent-teams auth login` to start over.',
        },
        options.pretty,
      ),
    )
    process.exit(1)
  }
}

interface ValidatedTeamsToken {
  client: TeamsClient
  accountType: TeamsAccountType
  authInfo: { id: string; displayName: string }
}

async function validateTokenWithProbe(
  token: string,
  accountType: TeamsAccountType,
  accountTypeKnown: boolean,
  debugLog?: (msg: string) => void,
): Promise<ValidatedTeamsToken> {
  const primaryTypes: TeamsAccountType[] = [accountType]
  if (!accountTypeKnown) {
    primaryTypes.push(accountType === 'work' ? 'personal' : 'work')
  }

  let lastError: Error | null = null
  for (const candidateType of primaryTypes) {
    try {
      const client = await new TeamsClient().login({ token, accountType: candidateType })
      const authInfo = await client.testAuth()
      if (candidateType !== accountType) {
        debugLog?.(`[debug] Reclassified ${accountType} → ${candidateType} via API probe`)
      }
      return { client, accountType: candidateType, authInfo }
    } catch (error) {
      lastError = error as Error
      debugLog?.(`[debug] Probe ${candidateType} failed: ${lastError.message}`)
    }
  }
  throw lastError ?? new Error('Token validation failed')
}

export async function extractAction(options: {
  pretty?: boolean
  debug?: boolean
  token?: string
  browserProfile?: string[]
  source?: string
}): Promise<void> {
  try {
    if (options.token) {
      await extractManualToken(options.token, options)
      return
    }

    const tokenSource = resolveTeamsTokenSource(options.source ?? process.env.AGENT_TEAMS_AUTH_SOURCE)
    if (tokenSource === 'desktop' && options.browserProfile?.length) {
      throw new Error('--browser-profile cannot be used with the desktop-only Teams token source.')
    }
    const debugLog = options.debug ? (msg: string) => debug(`[debug] ${msg}`) : undefined
    const extractor = new TeamsTokenExtractor(undefined, undefined, debugLog, options.browserProfile, tokenSource)

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
      debug('[debug] Extracting Teams tokens from all accounts...')
    }

    const extracted = await extractor.extract()

    if (extracted.length === 0) {
      if (extractor.didCachedKeyFail()) throw new TeamsCachedKeyRejectedError()
      console.log(
        formatOutput(
          {
            error: getNoTeamsTokenFoundMessage(tokenSource),
            hint: 'Run with --token <token> to manually provide a token, or --debug for more info.',
          },
          options.pretty,
        ),
      )
      process.exit(1)
    }

    if (options.debug) {
      debug(`[debug] Found ${extracted.length} account(s)`)
    }

    const credManager = new TeamsCredentialManager()
    const config: TeamsConfig = { current_account: null, accounts: {} }
    const outputAccounts: Array<{
      account_type: TeamsAccountType
      user: string
      teams: string[]
    }> = []

    for (const { token, accountType: extractedType, accountTypeKnown } of extracted) {
      if (options.debug) {
        const label = accountTypeKnown ? extractedType : `${extractedType} (probing)`
        debug(`[debug] Validating ${label} account token...`)
      }

      try {
        const debugLog = options.debug ? (msg: string) => debug(msg) : undefined
        const { client, accountType, authInfo } = await validateTokenWithProbe(
          token,
          extractedType,
          accountTypeKnown,
          debugLog,
        )
        const teams = await client.listTeams()

        if (options.debug) {
          debug(`[debug] ✓ ${accountType}: ${authInfo.displayName} (${teams.length} team(s))`)
        }

        if (config.accounts[accountType]) {
          if (options.debug) {
            debug(`[debug] Skipping duplicate ${accountType} account`)
          }
          continue
        }

        const teamMap: Record<string, { team_id: string; team_name: string }> = {}
        for (const team of teams) {
          teamMap[team.id] = { team_id: team.id, team_name: team.name }
        }

        const account: TeamsAccount = {
          token,
          token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          region: client.getRegion(),
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
          debug(`[debug] ✗ ${extractedType}: ${errorMessage}`)
        }
        if (extracted.length === 1) {
          console.log(
            formatOutput(
              {
                error: `Token validation failed: ${errorMessage}`,
                hint: is401
                  ? 'Token expired. Open Microsoft Teams in the desktop app or a supported Chromium browser, send a message to refresh your session, then run "auth extract" again.'
                  : 'Make sure Microsoft Teams is running and you are logged in via the desktop app or a supported Chromium browser.',
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
          {
            error:
              'All extracted tokens failed validation. Make sure Microsoft Teams is running and you are logged in via the desktop app or a supported Chromium browser.',
          },
          options.pretty,
        ),
      )
      process.exit(1)
    }

    await credManager.saveConfig(config)

    if (options.debug) {
      debug('[debug] ✓ Credentials saved')
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
    debug(`[debug] Using provided token: ${token.substring(0, 20)}...`)
  }

  try {
    const client = await new TeamsClient().login({ token })
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
      region: client.getRegion(),
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
      debug('[debug] ✓ Credentials saved')
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
            ? 'Token expired. Open Microsoft Teams in the desktop app or a supported Chromium browser, send a message to refresh your session, then run "auth extract" again.'
            : 'Make sure Microsoft Teams is running and you are logged in via the desktop app or a supported Chromium browser.',
        },
        options.pretty,
      ),
    )
    process.exit(1)
  }
}

export function getNoTeamsTokenFoundMessage(source: 'all' | 'desktop' = 'all'): string {
  return source === 'desktop'
    ? 'No Teams token found. Make sure both required accounts are open and signed in through the Microsoft Teams desktop app.'
    : 'No Teams token found. Make sure you are logged in to Microsoft Teams via the desktop app or a supported Chromium browser.'
}

export async function logoutAction(options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new TeamsCredentialManager()
    const config = await credManager.loadConfig()

    if (!config || Object.keys(config.accounts).length === 0) {
      console.log(
        formatOutput({ error: 'Not authenticated. Run "auth login" or "auth extract" first.' }, options.pretty),
      )
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
      console.log(
        formatOutput({ error: 'Not authenticated. Run "auth login" or "auth extract" first.' }, options.pretty),
      )
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
          const client = await new TeamsClient().login({
            token: account.token,
            tokenExpiresAt: account.token_expires_at ?? undefined,
            accountType: account.account_type,
            region: account.region,
          })
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
    new Command('login')
      .description('Sign in via device code (no desktop app needed). Detects the account type from your email.')
      .option('--pretty', 'Pretty print JSON output')
      .option('--debug', 'Show debug output for troubleshooting')
      .option('--device-code <code>', 'Finish a non-interactive login started earlier')
      .option('--client-id <id>', 'Override the AAD client ID')
      .option('--account-type <type>', 'Force account type: work or personal (skips email detection)')
      .option('--email <email>', 'Microsoft email, used to auto-detect work vs personal')
      .action(loginAction),
  )
  .addCommand(
    new Command('extract')
      .description('Extract token from Microsoft Teams desktop app or a supported Chromium browser')
      .option('--pretty', 'Pretty print JSON output')
      .option('--debug', 'Show debug output for troubleshooting')
      .option('--source <source>', 'Token source: all or desktop')
      .option('--token <token>', 'Manually provide a token (bypasses auto-extraction)')
      .option(
        '--browser-profile <path>',
        'Additional Chromium profile/user-data directory to scan (repeatable, comma-separated supported)',
        collectBrowserProfileOption,
        [],
      )
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
