import { createInterface } from 'node:readline/promises'

import { Command } from 'commander'

import { formatOutput } from '@/shared/utils/output'

import { BlueBubblesClient } from '../client'
import { IMessageCredentialManager } from '../credential-manager'
import { createAccountId, type IMessageAccount, IMessageError } from '../types'

interface SetOptions {
  url?: string
  password?: string
  account?: string
  label?: string
  current?: boolean
  pretty?: boolean
  _manager?: IMessageCredentialManager
}

async function validateAndBuildAccount(
  serverUrl: string,
  password: string,
  label: string | undefined,
  accountIdHint: string | undefined,
): Promise<IMessageAccount> {
  const client = await new BlueBubblesClient().login({ serverUrl, password })
  await client.connect()
  await client.getServerInfo()
  await client.close()

  const now = new Date().toISOString()
  const accountId = createAccountId(accountIdHint ?? label ?? serverUrl)

  return {
    account_id: accountId,
    provider: 'bluebubbles',
    server_url: serverUrl.replace(/\/+$/, ''),
    password,
    label: label ?? undefined,
    created_at: now,
    updated_at: now,
  }
}

async function persistAccount(
  manager: IMessageCredentialManager,
  account: IMessageAccount,
  makeCurrent: boolean,
): Promise<void> {
  await manager.setAccount(account)
  if (makeCurrent) {
    await manager.setCurrent(account.account_id)
  }
}

async function runSet(options: SetOptions): Promise<void> {
  if (!options.url || !options.password) {
    throw new IMessageError('Both --url and --password are required for "auth set".', 'no_credentials')
  }

  const manager = options._manager ?? new IMessageCredentialManager()
  const account = await validateAndBuildAccount(options.url, options.password, options.label, options.account)
  await persistAccount(manager, account, options.current ?? false)

  console.log(
    formatOutput(
      { success: true, account_id: account.account_id, server_url: account.server_url, label: account.label },
      options.pretty,
    ),
  )
  process.exit(0)
}

async function runLogin(options: { pretty?: boolean; _manager?: IMessageCredentialManager }): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    console.error('iMessage connects to your own Mac running BlueBubbles.')
    console.error('Same-Mac Docker: http://host.docker.internal:1234 — remote: http://<mac-lan-ip>:1234\n')

    const url = (await rl.question('BlueBubbles server URL: ')).trim()
    const password = (await rl.question('Server password: ')).trim()
    const label = (await rl.question('Account label (optional): ')).trim() || undefined

    const manager = options._manager ?? new IMessageCredentialManager()
    const account = await validateAndBuildAccount(url, password, label, label)
    await persistAccount(manager, account, true)

    console.log(
      formatOutput(
        { success: true, account_id: account.account_id, server_url: account.server_url, label: account.label },
        options.pretty,
      ),
    )
    process.exit(0)
  } finally {
    rl.close()
  }
}

async function runStatus(options: {
  account?: string
  pretty?: boolean
  _manager?: IMessageCredentialManager
}): Promise<void> {
  const manager = options._manager ?? new IMessageCredentialManager()
  const resolved = await manager.resolveCredentials(options.account)

  if (!resolved) {
    console.log(formatOutput({ valid: false, error: 'No credentials configured.' }, options.pretty))
    process.exit(1)
  }

  let valid = false
  let info: Awaited<ReturnType<BlueBubblesClient['getServerInfo']>> | null = null
  try {
    const client = await new BlueBubblesClient().login({
      serverUrl: resolved.server_url,
      password: resolved.password,
    })
    await client.connect()
    info = await client.getServerInfo()
    await client.close()
    valid = true
  } catch {
    valid = false
  }

  console.log(
    formatOutput(
      { valid, server_url: resolved.server_url, backend: info?.backend, version: info?.version },
      options.pretty,
    ),
  )
  if (!valid) process.exit(1)
}

async function runList(options: { pretty?: boolean; _manager?: IMessageCredentialManager }): Promise<void> {
  const manager = options._manager ?? new IMessageCredentialManager()
  const accounts = await manager.listAccounts()
  console.log(
    formatOutput(
      accounts.map((a) => ({
        account_id: a.account_id,
        server_url: a.server_url,
        label: a.label,
        is_current: a.is_current,
      })),
      options.pretty,
    ),
  )
  process.exit(0)
}

async function runUse(
  accountId: string,
  options: { pretty?: boolean; _manager?: IMessageCredentialManager },
): Promise<void> {
  const manager = options._manager ?? new IMessageCredentialManager()
  const found = await manager.setCurrent(accountId)
  if (!found) {
    console.log(formatOutput({ error: `Account "${accountId}" not found. Run "auth list".` }, options.pretty))
    process.exit(1)
  }
  console.log(formatOutput({ success: true, account_id: createAccountId(accountId) }, options.pretty))
  process.exit(0)
}

async function runRemove(
  accountId: string,
  options: { pretty?: boolean; _manager?: IMessageCredentialManager },
): Promise<void> {
  const manager = options._manager ?? new IMessageCredentialManager()
  const removed = await manager.removeAccount(accountId)
  if (!removed) {
    console.log(formatOutput({ error: `Account "${accountId}" not found. Run "auth list".` }, options.pretty))
    process.exit(1)
  }
  console.log(formatOutput({ success: true }, options.pretty))
  process.exit(0)
}

async function runLogout(options: { pretty?: boolean; _manager?: IMessageCredentialManager }): Promise<void> {
  const manager = options._manager ?? new IMessageCredentialManager()
  await manager.clearCredentials()
  console.log(formatOutput({ success: true }, options.pretty))
  process.exit(0)
}

function reportError(error: unknown, pretty?: boolean): never {
  const payload = error instanceof IMessageError ? error.toJSON() : { error: (error as Error).message }
  console.log(formatOutput(payload, pretty))
  process.exit(1)
}

export const authCommand = new Command('auth')
  .description('Authentication commands')
  .addCommand(
    new Command('login')
      .description('Interactively configure and validate a BlueBubbles connection')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (opts: { pretty?: boolean }) => {
        try {
          await runLogin(opts)
        } catch (error) {
          reportError(error, opts.pretty)
        }
      }),
  )
  .addCommand(
    new Command('set')
      .description('Set BlueBubbles credentials non-interactively (validated before saving)')
      .requiredOption('--url <url>', 'BlueBubbles server URL (e.g. http://host.docker.internal:1234)')
      .requiredOption('--password <password>', 'BlueBubbles server password')
      .option('--account <id>', 'Account id/alias')
      .option('--label <label>', 'Human-friendly label')
      .option('--current', 'Set as the active account')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (opts: SetOptions) => {
        try {
          await runSet(opts)
        } catch (error) {
          reportError(error, opts.pretty)
        }
      }),
  )
  .addCommand(
    new Command('status')
      .description('Show authentication status')
      .option('--account <id>', 'Check a specific account (default: current)')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (opts: { account?: string; pretty?: boolean }) => {
        try {
          await runStatus(opts)
        } catch (error) {
          reportError(error, opts.pretty)
        }
      }),
  )
  .addCommand(
    new Command('list')
      .description('List configured accounts')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (opts: { pretty?: boolean }) => {
        try {
          await runList(opts)
        } catch (error) {
          reportError(error, opts.pretty)
        }
      }),
  )
  .addCommand(
    new Command('use')
      .description('Switch the active account')
      .argument('<account-id>', 'Account id')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (accountId: string, opts: { pretty?: boolean }) => {
        try {
          await runUse(accountId, opts)
        } catch (error) {
          reportError(error, opts.pretty)
        }
      }),
  )
  .addCommand(
    new Command('remove')
      .description('Remove a configured account')
      .argument('<account-id>', 'Account id')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (accountId: string, opts: { pretty?: boolean }) => {
        try {
          await runRemove(accountId, opts)
        } catch (error) {
          reportError(error, opts.pretty)
        }
      }),
  )
  .addCommand(
    new Command('logout')
      .description('Clear all stored credentials')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (opts: { pretty?: boolean }) => {
        try {
          await runLogout(opts)
        } catch (error) {
          reportError(error, opts.pretty)
        }
      }),
  )

export { runSet, runLogin, runStatus, runList, runUse, runRemove, runLogout }
