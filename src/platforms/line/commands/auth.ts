import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'
import { displayQR } from '@/shared/utils/qr'
import { info } from '@/shared/utils/stderr'

import { LineClient } from '../client'
import { LineCredentialManager } from '../credential-manager'
import type { LineDevice } from '../types'

function isInteractiveSession(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY)
}

function getDefaultDevice(): LineDevice {
  return 'ANDROIDSECONDARY'
}

async function loginAction(options: {
  email?: string
  password?: string
  token?: string
  device?: string
  pretty?: boolean
}): Promise<void> {
  try {
    const credManager = new LineCredentialManager()
    const client = new LineClient(credManager)
    const device: LineDevice = (options.device as LineDevice | undefined) ?? getDefaultDevice()
    const interactive = isInteractiveSession()

    if (options.token) {
      const now = new Date().toISOString()
      const tempCredentials = {
        account_id: 'pending',
        auth_token: options.token,
        device,
        created_at: now,
        updated_at: now,
      }
      await client.login(tempCredentials)
      const profile = await client.getProfile()
      const credentials = { ...tempCredentials, account_id: profile.mid, display_name: profile.display_name }
      await credManager.setAccount(credentials)
      console.log(
        formatOutput(
          {
            authenticated: true,
            account_id: profile.mid,
            display_name: profile.display_name,
            device,
          },
          options.pretty,
        ),
      )
    } else if (options.email && options.password) {
      const result = await client.loginWithEmail({
        email: options.email,
        password: options.password,
        device,
        onPincode: (pin) => {
          if (interactive) {
            info(`\nEnter this PIN in the LINE mobile app: ${pin}\n`)
          }
        },
      })
      console.log(formatOutput(result, options.pretty))
    } else {
      const result = await client.loginWithQR({
        device,
        onQRUrl: async (url) => {
          await displayQR(url, {
            platform: 'LINE',
            brandColor: '#06C755',
            scanInstruction: 'Scan with the LINE mobile app',
            interactive,
            formatOutput,
            pretty: options.pretty,
          })
        },
        onPincode: (pin) => {
          info(`\nEnter this PIN in the LINE mobile app: ${pin}\n`)
        },
      })
      console.log(formatOutput(result, options.pretty))
    }
  } catch (error) {
    handleError(error as Error)
  }
}

async function statusAction(options: { pretty?: boolean; account?: string }): Promise<void> {
  try {
    const credManager = new LineCredentialManager()
    const account = await credManager.getAccount(options.account)

    if (!account) {
      console.log(formatOutput({ error: 'No LINE account configured' }, options.pretty))
      return
    }

    console.log(
      formatOutput(
        {
          account_id: account.account_id,
          device: account.device,
          display_name: account.display_name,
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

async function listAction(options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new LineCredentialManager()
    const accounts = await credManager.listAccounts()
    console.log(formatOutput(accounts, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function useAction(accountId: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new LineCredentialManager()
    await credManager.setCurrentAccount(accountId)
    console.log(formatOutput({ current_account: accountId }, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function logoutAction(accountId: string | undefined, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new LineCredentialManager()
    if (accountId) {
      await credManager.removeAccount(accountId)
      console.log(formatOutput({ success: true, message: `Removed account ${accountId}` }, options.pretty))
    } else {
      await credManager.clearAll()
      console.log(formatOutput({ success: true, message: 'Logged out' }, options.pretty))
    }
  } catch (error) {
    handleError(error as Error)
  }
}

export const authCommand = new Command('auth')
  .description('LINE authentication commands')
  .addCommand(
    new Command('login')
      .description('Login to LINE via QR code (default), email/password, or auth token')
      .option('--email <email>', 'Email address for email/password login')
      .option('--password <password>', 'Password for email login')
      .option('--token <token>', 'Login with existing auth token directly')
      .option(
        '--device <type>',
        'Device type (default: ANDROIDSECONDARY). Secondary device that coexists with LINE desktop. Use DESKTOPMAC/DESKTOPWIN to replace desktop session.',
      )
      .option('--pretty', 'Pretty print JSON output')
      .action(loginAction),
  )
  .addCommand(
    new Command('status')
      .description('Show authentication status')
      .option('--account <id>', 'Account ID (optional, defaults to current account)')
      .option('--pretty', 'Pretty print JSON output')
      .action(statusAction),
  )
  .addCommand(
    new Command('list')
      .description('List all stored LINE accounts')
      .option('--pretty', 'Pretty print JSON output')
      .action(listAction),
  )
  .addCommand(
    new Command('use')
      .description('Set the active LINE account')
      .argument('<account-id>', 'Account ID to use as current')
      .option('--pretty', 'Pretty print JSON output')
      .action(useAction),
  )
  .addCommand(
    new Command('logout')
      .description('Remove stored credentials (all accounts if no ID given)')
      .argument('[account-id]', 'Account ID to remove (omit to clear all)')
      .option('--pretty', 'Pretty print JSON output')
      .action(logoutAction),
  )
