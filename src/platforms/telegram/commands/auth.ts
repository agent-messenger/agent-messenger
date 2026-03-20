import { Writable } from 'node:stream'
import { Command } from 'commander'
import { handleError } from '../../../shared/utils/error-handler'
import { formatOutput } from '../../../shared/utils/output'
import { getTelegramAppCredentials } from '../app-config'
import { TelegramTdlibClient } from '../client'
import { TelegramCredentialManager } from '../credential-manager'
import { provisionTelegramApp } from '../my-telegram-org'
import { createAccountId, type TelegramAccount, TelegramError } from '../types'

interface AuthOptions {
  account?: string
  apiId?: string
  apiHash?: string
  phone?: string
  code?: string
  password?: string
  email?: string
  emailCode?: string
  firstName?: string
  lastName?: string
  tdlibPath?: string
  pretty?: boolean
}

class HiddenWritable extends Writable {
  muted = false

  _write(chunk: Buffer | string, encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    if (!this.muted) {
      process.stdout.write(chunk, encoding)
    }
    callback()
  }
}

function parseApiId(apiId?: string): number | undefined {
  if (!apiId) {
    return undefined
  }

  const parsed = Number.parseInt(apiId, 10)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new TelegramError('API ID must be a positive integer.', 'invalid_api_id')
  }

  return parsed
}

function isInteractiveSession(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY)
}

async function promptLine(message: string): Promise<string | undefined> {
  const { createInterface } = await import('node:readline/promises')
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  })

  try {
    const answer = await rl.question(message)
    const normalized = answer.trim()
    return normalized || undefined
  } finally {
    rl.close()
  }
}

async function promptText(message: string, defaultValue?: string): Promise<string | undefined> {
  const suffix = defaultValue ? ` [${defaultValue}]` : ''
  const answer = await promptLine(`${message}${suffix}: `)
  return answer ?? defaultValue
}

async function promptHidden(message: string): Promise<string | undefined> {
  const { createInterface } = await import('node:readline/promises')
  const hiddenOutput = new HiddenWritable()
  const rl = createInterface({
    input: process.stdin,
    output: hiddenOutput,
    terminal: true,
  })

  try {
    hiddenOutput.muted = true
    process.stdout.write(`${message}: `)
    const answer = await rl.question('')
    process.stdout.write('\n')
    const normalized = answer.trim()
    return normalized || undefined
  } finally {
    hiddenOutput.muted = false
    rl.close()
  }
}

function shouldUseInteractivePrompts(): boolean {
  return isInteractiveSession()
}

async function fillMissingBootstrappingInputs(
  options: AuthOptions,
  existing?: TelegramAccount | null,
): Promise<AuthOptions> {
  const resolved: AuthOptions = { ...options }
  const defaults = getTelegramAppCredentials()

  if (!resolved.apiId && defaults.api_id) {
    resolved.apiId = String(defaults.api_id)
  }

  if (!resolved.apiHash && defaults.api_hash) {
    resolved.apiHash = defaults.api_hash
  }

  if (!resolved.apiId && !existing?.api_id) {
    if (shouldUseInteractivePrompts()) {
      try {
        console.error('No API credentials found. Provisioning via my.telegram.org...')
        console.error('A verification code will be sent to your Telegram account.\n')

        const phone = resolved.phone || await promptText('Phone number (e.g. +14155551234)')
        if (!phone) {
          throw new Error('Phone number is required to provision Telegram API credentials.')
        }
        if (!resolved.phone) resolved.phone = phone

        const app = await provisionTelegramApp({
          phone,
          promptForCode: async () => {
            const code = await promptText('Enter the code sent to your Telegram app')
            if (!code) {
              throw new Error('Verification code is required to provision Telegram API credentials.')
            }
            return code
          },
        })

        resolved.apiId = String(app.api_id)
        resolved.apiHash = app.api_hash
        console.error(`\n✓ API credentials obtained (api_id: ${app.api_id})`)
      } catch (error) {
        console.error(`\nAuto-provisioning failed: ${error instanceof Error ? error.message : error}`)
        console.error('Enter your API credentials manually (from https://my.telegram.org/apps):\n')
        resolved.apiId = await promptText('Telegram API ID')
        resolved.apiHash = await promptHidden('Telegram API hash')
      }
    } else {
      console.error('Telegram API credentials are not set.')
      console.error('Set AGENT_TELEGRAM_API_ID and AGENT_TELEGRAM_API_HASH environment variables.')
      console.error('Get them from https://my.telegram.org/apps')
      process.exit(1)
    }
  }

  if (!resolved.apiHash && !existing?.api_hash) {
    resolved.apiHash = await promptHidden('Telegram API hash')
  }

  if (!existing && !resolved.phone) {
    resolved.phone = await promptText('Telegram phone number in international format (e.g. +14155551234)')
  }

  return resolved
}

async function promptNextLoginInput(result: { next_action?: string }, options: AuthOptions): Promise<AuthOptions> {
  const resolved: AuthOptions = { ...options }

  switch (result.next_action) {
    case 'provide_phone_number':
      resolved.phone = await promptText('Telegram phone number in international format', resolved.phone)
      break
    case 'provide_code':
      resolved.code = await promptText('Telegram login code')
      break
    case 'provide_password':
      resolved.password = await promptHidden('Telegram 2FA password')
      break
    case 'provide_email':
      resolved.email = await promptText('Telegram login email')
      break
    case 'provide_email_code':
      resolved.emailCode = await promptText('Telegram email code')
      break
    case 'provide_registration':
      resolved.firstName = await promptText('Telegram first name')
      resolved.lastName = await promptText('Telegram last name', resolved.lastName ?? '')
      break
    default:
      break
  }

  return resolved
}

async function buildAccount(manager: TelegramCredentialManager, options: AuthOptions): Promise<TelegramAccount> {
  const existing =
    (options.account ? await manager.getAccount(options.account) : null) ??
    (!options.account &&
    !options.apiId &&
    !options.apiHash &&
    !options.phone &&
    (options.code || options.password || options.email || options.emailCode || options.firstName)
      ? await manager.getAccount()
      : null)

  const accountId = options.account
    ? createAccountId(options.account)
    : options.phone
      ? createAccountId(options.phone)
      : (existing?.account_id ?? 'default')
  const now = new Date().toISOString()

  const account: TelegramAccount = {
    account_id: accountId,
    api_id: parseApiId(options.apiId) ?? existing?.api_id ?? 0,
    api_hash: options.apiHash ?? existing?.api_hash ?? '',
    phone_number: options.phone ?? existing?.phone_number,
    tdlib_path: options.tdlibPath ?? existing?.tdlib_path,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  }

  if (!account.api_id || !account.api_hash) {
    throw new TelegramError(
      'Telegram API credentials are required. Run auth login with --api-id and --api-hash from https://my.telegram.org.',
      'missing_api_credentials',
    )
  }

  await manager.setAccount(account)
  await manager.setCurrent(account.account_id)
  return account
}

function registerSignalCleanup(client: TelegramTdlibClient): () => void {
  let closing = false

  const onSignal = (signal: NodeJS.Signals) => {
    if (closing) {
      return
    }

    closing = true
    const exitCode = signal === 'SIGINT' ? 130 : 143

    client
      .close()
      .catch(() => undefined)
      .finally(() => {
        process.exit(exitCode)
      })
  }

  process.on('SIGINT', onSignal)
  process.on('SIGTERM', onSignal)

  return () => {
    process.off('SIGINT', onSignal)
    process.off('SIGTERM', onSignal)
  }
}

export async function loginAction(options: AuthOptions): Promise<void> {
  const manager = new TelegramCredentialManager()
  const existing = options.account ? await manager.getAccount(options.account) : await manager.getAccount()
  const interactive = shouldUseInteractivePrompts()
  let resolvedOptions = interactive
    ? await fillMissingBootstrappingInputs(options, existing)
    : options

  const account = await buildAccount(manager, resolvedOptions)
  const client = await TelegramTdlibClient.create(account, await manager.ensureAccountPaths(account.account_id))
  const unregisterSignalCleanup = registerSignalCleanup(client)
  let exitCode = 0
  let thrownError: Error | null = null
  let migratedAccount: TelegramAccount | null = null

  try {
    let result = await client.login({
      phone_number: resolvedOptions.phone,
      code: resolvedOptions.code,
      password: resolvedOptions.password,
      email: resolvedOptions.email,
      email_code: resolvedOptions.emailCode,
      first_name: resolvedOptions.firstName,
      last_name: resolvedOptions.lastName,
    })

    while (!result.authenticated && interactive && result.next_action) {
      resolvedOptions = await promptNextLoginInput(result, resolvedOptions)
      result = await client.login({
        phone_number: resolvedOptions.phone,
        code: resolvedOptions.code,
        password: resolvedOptions.password,
        email: resolvedOptions.email,
        email_code: resolvedOptions.emailCode,
        first_name: resolvedOptions.firstName,
        last_name: resolvedOptions.lastName,
      })
    }

    console.log(formatOutput(result, options.pretty))
    if (result.authenticated && !options.account && account.account_id === 'default' && result.user?.phone_number) {
      migratedAccount = {
        ...account,
        account_id: createAccountId(`+${result.user.phone_number}`),
        phone_number: `+${result.user.phone_number}`,
        updated_at: new Date().toISOString(),
      }
    }
    if (!result.authenticated) {
      exitCode = 1
    }
  } catch (error) {
    thrownError = error as Error
  } finally {
    unregisterSignalCleanup()
    await client.close({ waitForClosed: true, timeoutMs: 5000 }).catch(() => undefined)
  }

  if (thrownError) {
    handleError(thrownError)
  }

  if (migratedAccount) {
    await manager.migrateAccount('default', migratedAccount)
  }

  if (exitCode !== 0) {
    process.exit(exitCode)
  }
}

export async function statusAction(options: { account?: string; pretty?: boolean }): Promise<void> {
  const manager = new TelegramCredentialManager()
  const account = await manager.getAccount(options.account)

  if (!account) {
    console.log(
      formatOutput(
        {
          error: options.account
            ? `Telegram account "${options.account}" not found.`
            : 'No Telegram account configured. Run "agent-telegram auth login" first.',
        },
        options.pretty,
      ),
    )
    process.exit(1)
  }

  const client = await TelegramTdlibClient.create(account, await manager.ensureAccountPaths(account.account_id))
  const unregisterSignalCleanup = registerSignalCleanup(client)
  let exitCode = 0
  let thrownError: Error | null = null

  try {
    const result = await client.getAuthStatus()
    console.log(formatOutput(result, options.pretty))
    if (!result.authenticated) {
      exitCode = 1
    }
  } catch (error) {
    thrownError = error as Error
  } finally {
    unregisterSignalCleanup()
    await client.close({ waitForClosed: false, timeoutMs: 1500 }).catch(() => undefined)
  }

  if (thrownError) {
    handleError(thrownError)
  }

  if (exitCode !== 0) {
    process.exit(exitCode)
  }
}

export async function listAction(options: { pretty?: boolean }): Promise<void> {
  try {
    const manager = new TelegramCredentialManager()
    const accounts = await manager.listAccounts()

    console.log(
      formatOutput(
        accounts.map((account) => ({
          account_id: account.account_id,
          phone_number: account.phone_number,
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

export async function useAction(accountId: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const manager = new TelegramCredentialManager()
    const found = await manager.setCurrent(accountId)

    if (!found) {
      console.log(formatOutput({ error: `Telegram account "${accountId}" not found.` }, options.pretty))
      process.exit(1)
    }

    const current = await manager.getAccount()
    console.log(formatOutput({ success: true, account_id: current?.account_id }, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export async function logoutAction(options: { account?: string; pretty?: boolean }): Promise<void> {
  const manager = new TelegramCredentialManager()
  const account = await manager.getAccount(options.account)

  if (!account) {
    console.log(
      formatOutput(
        {
          error: options.account
            ? `Telegram account "${options.account}" not found.`
            : 'No Telegram account configured. Run "agent-telegram auth login" first.',
        },
        options.pretty,
      ),
    )
    process.exit(1)
  }

  const client = await TelegramTdlibClient.create(account, await manager.ensureAccountPaths(account.account_id))
  const unregisterSignalCleanup = registerSignalCleanup(client)
  let thrownError: Error | null = null

  try {
    await client.logOut()
    console.log(formatOutput({ success: true, account_id: account.account_id, logged_out: true }, options.pretty))
  } catch (error) {
    thrownError = error as Error
  } finally {
    unregisterSignalCleanup()
    await client.close({ waitForClosed: true, timeoutMs: 5000 }).catch(() => undefined)
  }

  if (thrownError) {
    handleError(thrownError)
  }
}

export async function removeAction(accountId: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const manager = new TelegramCredentialManager()
    const removed = await manager.removeAccount(accountId)

    if (!removed) {
      console.log(formatOutput({ error: `Telegram account "${accountId}" not found.` }, options.pretty))
      process.exit(1)
    }

    console.log(formatOutput({ success: true, removed: createAccountId(accountId) }, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const authCommand = new Command('auth')
  .description('Telegram authentication commands')
  .addCommand(
    new Command('login')
      .description('Start or continue Telegram login; prompts for any missing values in an interactive terminal')
      .option('--account <id>', 'Account identifier (defaults to the phone number)')
      .option('--api-id <id>', 'Telegram API ID from https://my.telegram.org')
      .option('--api-hash <hash>', 'Telegram API hash from https://my.telegram.org')
      .option('--phone <number>', 'Phone number in international format, for example +821012345678')
      .option('--code <code>', 'Authentication code from Telegram')
      .option('--password <password>', 'Two-step verification password')
      .option('--email <address>', 'Login email address if requested by Telegram')
      .option('--email-code <code>', 'Email authentication code')
      .option('--first-name <name>', 'First name for registration')
      .option('--last-name <name>', 'Last name for registration')
      .option('--tdlib-path <path>', 'Full path to libtdjson shared library')
      .option('--pretty', 'Pretty print JSON output')
      .action(loginAction),
  )
  .addCommand(
    new Command('status')
      .description('Show current Telegram authentication status')
      .option('--account <id>', 'Use a specific Telegram account')
      .option('--pretty', 'Pretty print JSON output')
      .action(statusAction),
  )
  .addCommand(
    new Command('list')
      .description('List stored Telegram accounts')
      .option('--pretty', 'Pretty print JSON output')
      .action(listAction),
  )
  .addCommand(
    new Command('use')
      .description('Switch the current Telegram account')
      .argument('<account>', 'Account identifier')
      .option('--pretty', 'Pretty print JSON output')
      .action(useAction),
  )
  .addCommand(
    new Command('logout')
      .description('Log out of the current Telegram account')
      .option('--account <id>', 'Use a specific Telegram account')
      .option('--pretty', 'Pretty print JSON output')
      .action(logoutAction),
  )
  .addCommand(
    new Command('remove')
      .description('Remove a stored Telegram account and its local TDLib data')
      .argument('<account>', 'Account identifier')
      .option('--pretty', 'Pretty print JSON output')
      .action(removeAction),
  )
