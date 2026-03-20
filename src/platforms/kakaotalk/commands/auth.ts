import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { CredentialManager } from '../credential-manager'
import { KakaoTokenExtractor } from '../token-extractor'

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
    const extractor = new KakaoTokenExtractor(undefined, debugLog)

    if (process.platform === 'darwin') {
      console.log('')
      console.log('  Extracting your KakaoTalk credentials...')
      console.log('')
      console.log('  This reads the cached auth token from the KakaoTalk desktop app.')
      console.log('  No password or Keychain access is needed.')
      console.log('')
    }

    const token = await extractor.extract()

    if (!token) {
      console.log(
        formatOutput(
          {
            error: 'No credentials found. Make sure KakaoTalk desktop app is installed and logged in.',
            hint: options.debug ? undefined : 'Run with --debug for more info.',
          },
          options.pretty,
        ),
      )
      process.exit(1)
    }

    if (options.debug) {
      const display = options.unsafelyShowSecrets
        ? token.oauth_token
        : `${token.oauth_token.substring(0, 12)}...`
      console.error(`[debug] oauth_token: ${display}`)
      console.error(`[debug] user_id: ${token.user_id}`)
    }

    const credManager = new CredentialManager()
    const accountId = token.user_id || 'default'
    const now = new Date().toISOString()

    await credManager.setAccount({
      account_id: accountId,
      oauth_token: token.oauth_token,
      user_id: token.user_id,
      refresh_token: token.refresh_token,
      device_uuid: token.device_uuid,
      created_at: now,
      updated_at: now,
    })

    const config = await credManager.load()
    if (!config.current_account) {
      await credManager.setCurrentAccount(accountId)
    }

    console.log(
      formatOutput(
        {
          account_id: accountId,
          user_id: token.user_id,
          extracted: true,
        },
        options.pretty,
      ),
    )
  } catch (error) {
    handleError(error as Error)
  }
}

async function statusAction(options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const account = await credManager.getAccount()

    if (!account) {
      console.log(
        formatOutput(
          { error: 'No account configured. Run "auth extract" first.' },
          options.pretty,
        ),
      )
      process.exit(1)
    }

    console.log(
      formatOutput(
        {
          account_id: account.account_id,
          user_id: account.user_id,
          has_refresh_token: !!account.refresh_token,
          has_device_uuid: !!account.device_uuid,
          created_at: account.created_at,
          updated_at: account.updated_at,
        },
        options.pretty,
      ),
    )
  } catch (error) {
    handleError(error as Error)
  }
}

async function logoutAction(account: string | undefined, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const config = await credManager.load()

    const targetAccount = account ?? config.current_account

    if (!targetAccount) {
      console.log(
        formatOutput(
          { error: 'No current account set. Specify an account ID.' },
          options.pretty,
        ),
      )
      process.exit(1)
    }

    if (!config.accounts[targetAccount]) {
      console.log(
        formatOutput(
          {
            error: `Account not found: ${targetAccount}`,
            hint: 'Run "auth status" to see current account.',
          },
          options.pretty,
        ),
      )
      process.exit(1)
    }

    await credManager.removeAccount(targetAccount)
    console.log(formatOutput({ removed: targetAccount, success: true }, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const authCommand = new Command('auth')
  .description('KakaoTalk authentication commands')
  .addCommand(
    new Command('extract')
      .description('Extract credentials from KakaoTalk desktop app')
      .option('--pretty', 'Pretty print JSON output')
      .option('--debug', 'Show debug output for troubleshooting')
      .option('--unsafely-show-secrets', 'Show full token values in debug output')
      .action(extractAction),
  )
  .addCommand(
    new Command('status')
      .description('Show authentication status')
      .option('--pretty', 'Pretty print JSON output')
      .action(statusAction),
  )
  .addCommand(
    new Command('logout')
      .description('Remove stored credentials')
      .argument('[account]', 'Account ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(logoutAction),
  )
