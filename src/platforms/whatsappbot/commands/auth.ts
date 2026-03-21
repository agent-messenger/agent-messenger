import { Command } from 'commander'

import { formatOutput } from '@/shared/utils/output'

import { WhatsAppBotClient } from '../client'
import { WhatsAppBotCredentialManager } from '../credential-manager'

interface ActionOptions {
  account?: string
  pretty?: boolean
  _credManager?: WhatsAppBotCredentialManager
}

interface ActionResult {
  success?: boolean
  error?: string
  valid?: boolean
  phone_number_id?: string
  account_name?: string
  accounts?: Array<{ phone_number_id: string; account_name: string; is_current: boolean }>
}

export async function setAction(
  phoneNumberId: string,
  accessToken: string,
  options: ActionOptions,
): Promise<ActionResult> {
  try {
    const client = new WhatsAppBotClient(phoneNumberId, accessToken)
    const result = await client.verifyToken()

    const accountName = result.verified_name

    const credManager = options._credManager ?? new WhatsAppBotCredentialManager()
    await credManager.setCredentials({
      phone_number_id: phoneNumberId,
      account_name: accountName,
      access_token: accessToken,
    })

    return { success: true, phone_number_id: phoneNumberId, account_name: accountName }
  } catch (error: unknown) {
    return { error: (error as Error).message }
  }
}

export async function statusAction(options: ActionOptions): Promise<ActionResult> {
  try {
    const credManager = options._credManager ?? new WhatsAppBotCredentialManager()
    const creds = await credManager.getCredentials(options.account)

    if (!creds) {
      return {
        valid: false,
        error: options.account
          ? `Account "${options.account}" not found. Run "auth list" to see available accounts.`
          : 'No credentials configured. Run "auth set <phone-number-id> <access-token>" first.',
      }
    }

    let valid = false
    let phoneNumberId: string | undefined
    let accountName: string | undefined

    try {
      const client = new WhatsAppBotClient(creds.phone_number_id, creds.access_token)
      const result = await client.verifyToken()
      valid = true
      phoneNumberId = creds.phone_number_id
      accountName = result.verified_name
    } catch {
      valid = false
      phoneNumberId = creds.phone_number_id
      accountName = creds.account_name
    }

    return { valid, phone_number_id: phoneNumberId, account_name: accountName }
  } catch (error: unknown) {
    return { error: (error as Error).message }
  }
}

export async function clearAction(options: ActionOptions): Promise<ActionResult> {
  try {
    const credManager = options._credManager ?? new WhatsAppBotCredentialManager()
    await credManager.clearCredentials()
    return { success: true }
  } catch (error: unknown) {
    return { error: (error as Error).message }
  }
}

export async function listAction(options: ActionOptions): Promise<ActionResult> {
  try {
    const credManager = options._credManager ?? new WhatsAppBotCredentialManager()
    const all = await credManager.listAll()

    return {
      accounts: all.map((a) => ({
        phone_number_id: a.phone_number_id,
        account_name: a.account_name,
        is_current: a.is_current,
      })),
    }
  } catch (error: unknown) {
    return { error: (error as Error).message }
  }
}

export async function useAction(accountId: string, options: ActionOptions): Promise<ActionResult> {
  try {
    const credManager = options._credManager ?? new WhatsAppBotCredentialManager()
    const found = await credManager.setCurrent(accountId)

    if (!found) {
      return { error: `Account "${accountId}" not found. Run "auth list" to see available accounts.` }
    }

    const creds = await credManager.getCredentials()
    return {
      success: true,
      phone_number_id: creds?.phone_number_id,
      account_name: creds?.account_name,
    }
  } catch (error: unknown) {
    return { error: (error as Error).message }
  }
}

export async function removeAction(accountId: string, options: ActionOptions): Promise<ActionResult> {
  try {
    const credManager = options._credManager ?? new WhatsAppBotCredentialManager()
    const removed = await credManager.removeAccount(accountId)

    if (!removed) {
      return { error: `Account "${accountId}" not found. Run "auth list" to see available accounts.` }
    }

    return { success: true }
  } catch (error: unknown) {
    return { error: (error as Error).message }
  }
}

function cliOutput(result: ActionResult, pretty?: boolean, exitOnError = true): void {
  console.log(formatOutput(result, pretty))
  if (result.error && exitOnError) process.exit(1)
}

export const authCommand = new Command('auth')
  .description('Authentication commands')
  .addCommand(
    new Command('set')
      .description('Set account credentials')
      .argument('<phone-number-id>', 'WhatsApp Business phone number ID')
      .argument('<access-token>', 'Access token from Meta Business settings')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (phoneNumberId: string, accessToken: string, opts: { pretty?: boolean }) => {
        cliOutput(await setAction(phoneNumberId, accessToken, opts), opts.pretty)
      }),
  )
  .addCommand(
    new Command('status')
      .description('Show authentication status')
      .option('--account <id>', 'Check specific account (default: current)')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (opts: { account?: string; pretty?: boolean }) => {
        const result = await statusAction(opts)
        console.log(formatOutput(result, opts.pretty))
        if (!result.valid) process.exit(1)
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
      .description('List all stored accounts')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (opts: { pretty?: boolean }) => {
        cliOutput(await listAction(opts), opts.pretty)
      }),
  )
  .addCommand(
    new Command('use')
      .description('Switch active account')
      .argument('<account-id>', 'Account ID (phone number ID)')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (accountId: string, opts: { pretty?: boolean }) => {
        cliOutput(await useAction(accountId, opts), opts.pretty)
      }),
  )
  .addCommand(
    new Command('remove')
      .description('Remove a stored account')
      .argument('<account-id>', 'Account ID (phone number ID)')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (accountId: string, opts: { pretty?: boolean }) => {
        cliOutput(await removeAction(accountId, opts), opts.pretty)
      }),
  )
