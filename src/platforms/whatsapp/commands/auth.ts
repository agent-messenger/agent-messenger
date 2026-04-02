import { rm } from 'node:fs/promises'

import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'
import { displayQR } from '@/shared/utils/qr'
import { info } from '@/shared/utils/stderr'

import { WhatsAppClient } from '../client'
import { WhatsAppCredentialManager } from '../credential-manager'
import { createAccountId } from '../types'

interface LoginOptions {
  phone?: string
  qr?: boolean
  pretty?: boolean
}

interface StatusOptions {
  account?: string
  pretty?: boolean
}

function isInteractiveSession(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY)
}

async function loginWithPairingCode(options: LoginOptions & { phone: string }): Promise<void> {
  const manager = new WhatsAppCredentialManager()
  const accountId = createAccountId(options.phone)
  const existingPaths = manager.getAccountPaths(accountId)
  await rm(existingPaths.auth_dir, { recursive: true, force: true })
  const paths = await manager.ensureAccountPaths(accountId)
  const client = await new WhatsAppClient().login({ authDir: paths.auth_dir })

  let code: string
  let waitForAuth: () => Promise<void>

  try {
    const result = await client.connectForPairing(options.phone)
    code = result.code
    waitForAuth = result.waitForAuth
  } catch (err) {
    await client.close()
    throw err
  }

  const formatted = code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code

  console.log(
    formatOutput(
      {
        pairing_code: formatted,
        message: 'Enter this code in WhatsApp > Linked Devices > Link with phone number',
      },
      options.pretty,
    ),
  )

  try {
    await waitForAuth()
  } catch (err) {
    await client.close()
    throw err
  }

  const now = new Date().toISOString()
  await manager.setAccount({
    account_id: accountId,
    phone_number: options.phone,
    created_at: now,
    updated_at: now,
  })
  await manager.setCurrent(accountId)
  await client.close()

  console.log(
    formatOutput(
      {
        authenticated: true,
        account_id: accountId,
        phone_number: options.phone,
      },
      options.pretty,
    ),
  )
  process.exit(0)
}

async function loginWithQR(options: LoginOptions): Promise<void> {
  const manager = new WhatsAppCredentialManager()
  const accountId = `qr-${Date.now()}`
  const paths = await manager.ensureAccountPaths(accountId)
  const client = await new WhatsAppClient().login({ authDir: paths.auth_dir })
  const interactive = isInteractiveSession()

  let waitForAuth: () => Promise<void>

  try {
    const result = await client.connectForQR(async (qr) => {
      await displayQR(qr, {
        platform: 'WhatsApp',
        brandColor: '#25D366',
        scanInstruction: 'Scan with WhatsApp on your phone',
        interactive,
        formatOutput,
        pretty: options.pretty,
      })
    })
    waitForAuth = result.waitForAuth
  } catch (err) {
    await client.close()
    throw err
  }

  if (interactive) {
    info('\nWaiting for QR code scan...')
  }

  try {
    await waitForAuth()
  } catch (err) {
    await client.close()
    throw err
  }

  const now = new Date().toISOString()
  await manager.setAccount({
    account_id: accountId,
    created_at: now,
    updated_at: now,
  })
  await manager.setCurrent(accountId)
  await client.close()

  console.log(
    formatOutput(
      {
        authenticated: true,
        account_id: accountId,
      },
      options.pretty,
    ),
  )
  process.exit(0)
}

async function loginAction(options: LoginOptions): Promise<void> {
  try {
    if (options.qr) {
      await loginWithQR(options)
    } else if (options.phone) {
      await loginWithPairingCode(options as LoginOptions & { phone: string })
    } else {
      console.error('Error: Either --phone or --qr is required')
      process.exit(1)
    }
  } catch (error) {
    handleError(error as Error)
  }
}

async function statusAction(options: StatusOptions): Promise<void> {
  try {
    const manager = new WhatsAppCredentialManager()
    const account = await manager.getAccount(options.account)

    if (!account) {
      console.log(
        formatOutput(
          {
            error: options.account
              ? `WhatsApp account "${options.account}" not found.`
              : 'No WhatsApp account configured. Run "auth login --phone <phone-number>" first.',
          },
          options.pretty,
        ),
      )
      process.exit(1)
    }

    console.log(
      formatOutput(
        {
          account_id: account.account_id,
          phone_number: account.phone_number,
          name: account.name,
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
    const manager = new WhatsAppCredentialManager()
    const accounts = await manager.listAccounts()

    console.log(
      formatOutput(
        accounts.map((account) => ({
          account_id: account.account_id,
          phone_number: account.phone_number,
          name: account.name,
          created_at: account.created_at,
          updated_at: account.updated_at,
          is_current: account.is_current,
        })),
        options.pretty,
      ),
    )
  } catch (error) {
    handleError(error as Error)
  }
}

async function useAction(accountId: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const manager = new WhatsAppCredentialManager()
    const found = await manager.setCurrent(accountId)

    if (!found) {
      console.log(formatOutput({ error: `WhatsApp account "${accountId}" not found.` }, options.pretty))
      process.exit(1)
    }

    const current = await manager.getAccount()
    console.log(formatOutput({ success: true, account_id: current?.account_id }, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function logoutAction(options: { account?: string; pretty?: boolean }): Promise<void> {
  try {
    const manager = new WhatsAppCredentialManager()
    const account = await manager.getAccount(options.account)

    if (!account && !options.account) {
      console.log(formatOutput({ error: 'No WhatsApp account configured.' }, options.pretty))
      process.exit(1)
    }

    const accountId = account?.account_id ?? options.account!

    if (account) {
      const paths = manager.getAccountPaths(account.account_id)
      try {
        const client = await new WhatsAppClient().login({ authDir: paths.auth_dir })
        await client.connect()
        if (client.getSocket()) {
          await client.getSocket()!.logout('Logged out via agent-whatsapp CLI')
        }
        await client.close()
      } catch {
        // Server-side deregister failed — proceed with local cleanup
      }
    }

    await manager.removeAccount(accountId)
    console.log(formatOutput({ success: true, account_id: accountId, logged_out: true }, options.pretty))
    process.exit(0)
  } catch (error) {
    handleError(error as Error)
  }
}

export const authCommand = new Command('auth')
  .description('WhatsApp authentication commands')
  .addCommand(
    new Command('login')
      .description('Link as a companion device via pairing code (--phone) or QR code (--qr)')
      .option('--phone <number>', 'Phone number in international format (e.g. +12025551234)')
      .option('--qr', 'Link by scanning a QR code instead of entering a pairing code')
      .option('--pretty', 'Pretty print JSON output')
      .action(loginAction),
  )
  .addCommand(
    new Command('status')
      .description('Show authentication status')
      .option('--account <id>', 'Use a specific WhatsApp account')
      .option('--pretty', 'Pretty print JSON output')
      .action(statusAction),
  )
  .addCommand(
    new Command('list')
      .description('List stored WhatsApp accounts')
      .option('--pretty', 'Pretty print JSON output')
      .action(listAction),
  )
  .addCommand(
    new Command('use')
      .description('Switch the current WhatsApp account')
      .argument('<account>', 'Account identifier')
      .option('--pretty', 'Pretty print JSON output')
      .action(useAction),
  )
  .addCommand(
    new Command('logout')
      .description('Remove stored credentials and auth state')
      .option('--account <id>', 'Use a specific WhatsApp account')
      .option('--pretty', 'Pretty print JSON output')
      .action(logoutAction),
  )
