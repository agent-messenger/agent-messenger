import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { Writable } from 'node:stream'

import { Command } from 'commander'
import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'
import { InstagramClient, generateAndroidDeviceId, generateDeviceString } from '../client'
import { InstagramCredentialManager } from '../credential-manager'
import { InstagramTokenExtractor } from '../token-extractor'
import { createAccountId } from '../types'

function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY)
}

async function promptText(message: string): Promise<string | undefined> {
  const { createInterface } = await import('node:readline/promises')
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
  try {
    const answer = await rl.question(`${message}: `)
    return answer.trim() || undefined
  } finally {
    rl.close()
  }
}

async function promptHidden(message: string): Promise<string | undefined> {
  const { createInterface } = await import('node:readline/promises')
  const hiddenOutput = new (class extends Writable {
    muted = false
    _write(chunk: Buffer | string, encoding: BufferEncoding, cb: (error?: Error | null) => void): void {
      if (!this.muted) process.stdout.write(chunk, encoding)
      cb()
    }
  })()
  const rl = createInterface({ input: process.stdin, output: hiddenOutput, terminal: true })
  try {
    hiddenOutput.muted = true
    process.stdout.write(`${message}: `)
    const answer = await rl.question('')
    process.stdout.write('\n')
    return answer.trim() || undefined
  } finally {
    hiddenOutput.muted = false
    rl.close()
  }
}

async function saveAccountAndPrint(
  manager: InstagramCredentialManager,
  accountId: string,
  username: string,
  userId: string,
  pretty?: boolean,
): Promise<void> {
  const now = new Date().toISOString()
  await manager.setAccount({
    account_id: accountId,
    username,
    pk: userId,
    created_at: now,
    updated_at: now,
  })
  await manager.setCurrent(accountId)

  console.log(formatOutput({
    authenticated: true,
    account_id: accountId,
    username,
  }, pretty))
}

interface LoginOptions {
  username?: string
  password?: string
  pretty?: boolean
  debug?: boolean
}

async function loginAction(options: LoginOptions): Promise<void> {
  try {
    const interactive = isInteractive()
    let { username, password } = options

    if (!username) {
      if (!interactive) {
        console.log(formatOutput({
          error: 'Username required. Use --username <username> --password <password>.',
        }, options.pretty))
        process.exit(1)
      }
      username = await promptText('Instagram username')
      if (!username) { console.error('Username is required.'); process.exit(1) }
    }

    if (!password) {
      if (!interactive) {
        console.log(formatOutput({
          error: 'Password required. Use --username <username> --password <password>.',
        }, options.pretty))
        process.exit(1)
      }
      password = await promptHidden('Password')
      if (!password) { console.error('Password is required.'); process.exit(1) }
    }

    const manager = new InstagramCredentialManager()
    const accountId = createAccountId(username)
    const paths = await manager.ensureAccountPaths(accountId)

    const client = new InstagramClient(manager)
    client.setSessionPath(paths.session_path)
    if (options.debug) {
      client.setDebugLog((msg) => console.error(`[debug] ${msg}`))
    }

    const result = await client.authenticate(username, password)

    if (result.requiresTwoFactor) {
      const twoFactorIdentifier = (result.twoFactorInfo?.['two_factor_identifier'] as string) ?? ''

      if (interactive) {
        console.error('\n  Two-factor authentication required.')
        const code = await promptText('Verification code')
        if (!code) { console.error('Code is required.'); process.exit(1) }

        const tfResult = await client.twoFactorLogin(username, code, twoFactorIdentifier)
        await saveAccountAndPrint(manager, accountId, username, tfResult.userId, options.pretty)
      } else {
        console.log(formatOutput({
          two_factor_required: true,
          two_factor_identifier: twoFactorIdentifier,
          message: 'Run "agent-instagram auth verify --username <username> --code <code> --identifier <identifier>"',
        }, options.pretty))
      }
      return
    }

    if (result.challengeRequired) {
      if (interactive) {
        await handleInteractiveChallenge(client, manager, accountId, username, result.challengePath!, options.pretty)
      } else {
        console.log(formatOutput({
          challenge_required: true,
          challenge_path: result.challengePath,
          message: 'Run "agent-instagram auth challenge --username <username> --method email" then "agent-instagram auth challenge --username <username> --code <code>"',
        }, options.pretty))
      }
      return
    }

    await saveAccountAndPrint(manager, accountId, username, result.userId, options.pretty)
  } catch (error) {
    handleError(error as Error)
  }
}

async function handleInteractiveChallenge(
  client: InstagramClient,
  manager: InstagramCredentialManager,
  accountId: string,
  username: string,
  challengePath: string,
  pretty?: boolean,
): Promise<void> {
  console.error('\n  Security challenge required by Instagram.')
  console.error('  Choose verification method:')
  console.error('  1. Email')
  console.error('  2. SMS')
  console.error('')

  const choice = await promptText('Method (1/2)')
  const method = choice === '2' ? 'sms' as const : 'email' as const

  const sendResult = await client.challengeSendCode(challengePath, method)
  if (sendResult.contactPoint) {
    console.error(`\n  Code sent to: ${sendResult.contactPoint}`)
  } else {
    console.error('\n  Verification code sent.')
  }

  const code = await promptText('Verification code')
  if (!code) { console.error('Code is required.'); process.exit(1) }

  const verifyResult = await client.challengeSubmitCode(challengePath, code)
  await saveAccountAndPrint(manager, accountId, username, verifyResult.userId, pretty)
}

interface VerifyOptions {
  username: string
  code: string
  identifier: string
  pretty?: boolean
}

async function verifyAction(options: VerifyOptions): Promise<void> {
  try {
    const manager = new InstagramCredentialManager()
    const accountId = createAccountId(options.username)
    const paths = await manager.ensureAccountPaths(accountId)

    const client = new InstagramClient(manager)
    client.setSessionPath(paths.session_path)

    const result = await client.twoFactorLogin(
      options.username,
      options.code,
      options.identifier,
    )

    await saveAccountAndPrint(manager, accountId, options.username, result.userId, options.pretty)
  } catch (error) {
    handleError(error as Error)
  }
}

interface ChallengeOptions {
  username: string
  method?: string
  code?: string
  pretty?: boolean
}

async function challengeAction(options: ChallengeOptions): Promise<void> {
  try {
    const manager = new InstagramCredentialManager()
    const accountId = createAccountId(options.username)
    const paths = await manager.ensureAccountPaths(accountId)

    const client = new InstagramClient(manager)
    client.setSessionPath(paths.session_path)
    await client.loadSession(paths.session_path)

    const challengePath = client.getChallengePath()
    if (!challengePath) {
      console.log(formatOutput({
        error: 'No pending challenge found. Run "agent-instagram auth login" first.',
      }, options.pretty))
      process.exit(1)
    }

    if (options.code) {
      const result = await client.challengeSubmitCode(challengePath, options.code)
      await saveAccountAndPrint(manager, accountId, options.username, result.userId, options.pretty)
    } else {
      const method = (options.method === 'sms' ? 'sms' : 'email') as 'email' | 'sms'
      const result = await client.challengeSendCode(challengePath, method)

      console.log(formatOutput({
        code_sent: true,
        contact_point: result.contactPoint,
        step_name: result.stepName,
        message: `Verification code sent. Run "agent-instagram auth challenge --username ${options.username} --code <code>" to complete.`,
      }, options.pretty))
    }
  } catch (error) {
    handleError(error as Error)
  }
}

async function statusAction(options: { account?: string; pretty?: boolean }): Promise<void> {
  try {
    const manager = new InstagramCredentialManager()
    const account = await manager.getAccount(options.account)

    if (!account) {
      console.log(formatOutput({
        error: options.account
          ? `Instagram account "${options.account}" not found.`
          : 'No Instagram account configured. Run "auth login" first.',
      }, options.pretty))
      process.exit(1)
    }

    console.log(formatOutput({
      account_id: account.account_id,
      username: account.username,
      full_name: account.full_name,
      pk: account.pk,
      created_at: account.created_at,
      updated_at: account.updated_at,
    }, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function listAction(options: { pretty?: boolean }): Promise<void> {
  try {
    const manager = new InstagramCredentialManager()
    const accounts = await manager.listAccounts()

    console.log(formatOutput(
      accounts.map((account) => ({
        account_id: account.account_id,
        username: account.username,
        full_name: account.full_name,
        pk: account.pk,
        created_at: account.created_at,
        updated_at: account.updated_at,
        is_current: account.is_current,
      })),
      options.pretty,
    ))
  } catch (error) {
    handleError(error as Error)
  }
}

async function useAction(accountId: string, options: { pretty?: boolean }): Promise<void> {
  try {
    const manager = new InstagramCredentialManager()
    const found = await manager.setCurrent(accountId)

    if (!found) {
      console.log(formatOutput({ error: `Instagram account "${accountId}" not found.` }, options.pretty))
      process.exit(1)
    }

    const current = await manager.getAccount()
    console.log(formatOutput({ success: true, account_id: current?.account_id }, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function extractAction(options: { pretty?: boolean; debug?: boolean }): Promise<void> {
  try {
    const extractor = new InstagramTokenExtractor(
      undefined,
      options.debug ? (msg) => console.error(`[debug] ${msg}`) : undefined,
    )

    if (options.debug) {
      console.error('[debug] Searching browser profiles for Instagram cookies...')
    }

    const extracted = await extractor.extract()

    if (!extracted) {
      console.log(
        formatOutput(
          {
            error: 'No Instagram cookies found in any browser. Make sure you are logged in to instagram.com in Chrome, Edge, Arc, or Brave.',
            hint: 'Run "auth login --username <username>" to log in manually.',
          },
          options.pretty,
        ),
      )
      process.exit(1)
      return
    }

    const session = {
      cookies: [
        `sessionid=${extracted.sessionid}`,
        `ds_user_id=${extracted.ds_user_id}`,
        `csrftoken=${extracted.csrftoken}`,
        extracted.mid ? `mid=${extracted.mid}` : null,
        extracted.ig_did ? `ig_did=${extracted.ig_did}` : null,
        extracted.rur ? `rur=${extracted.rur}` : null,
      ]
        .filter(Boolean)
        .join('; '),
      device: {
        phone_id: randomUUID(),
        uuid: randomUUID(),
        android_device_id: generateAndroidDeviceId(),
        advertising_id: randomUUID(),
        client_session_id: randomUUID(),
        device_string: generateDeviceString(),
      },
      user_id: extracted.ds_user_id,
      mid: extracted.mid,
    }

    const manager = new InstagramCredentialManager()
    const accountId = createAccountId(extracted.ds_user_id)
    const paths = await manager.ensureAccountPaths(accountId)

    await mkdir(paths.account_dir, { recursive: true })
    await writeFile(paths.session_path, JSON.stringify(session, null, 2), { mode: 0o600 })

    const client = new InstagramClient(manager)
    client.setSessionPath(paths.session_path)
    if (options.debug) {
      client.setDebugLog((msg) => console.error(`[debug] ${msg}`))
    }

    await client.loadSession(paths.session_path)

    let username = extracted.ds_user_id
    try {
      const { data } = await (client as any).request('GET', '/accounts/current_user/?edit=true')
      const user = data['user'] as Record<string, unknown> | undefined
      if (user?.['username']) {
        username = user['username'] as string
      }
      await (client as any).saveSession()
    } catch (err) {
      if (options.debug) {
        console.error(`[debug] Session validation failed: ${err}`)
      }
      console.error('Warning: Could not validate session. Cookies may be expired.')
    }

    const now = new Date().toISOString()
    await manager.setAccount({
      account_id: accountId,
      username,
      pk: extracted.ds_user_id,
      created_at: now,
      updated_at: now,
    })
    await manager.setCurrent(accountId)

    console.log(
      formatOutput(
        {
          authenticated: true,
          account_id: accountId,
          username,
        },
        options.pretty,
      ),
    )
  } catch (error) {
    handleError(error as Error)
  }
}

async function logoutAction(options: { account?: string; pretty?: boolean }): Promise<void> {
  try {
    const manager = new InstagramCredentialManager()
    const account = await manager.getAccount(options.account)

    if (!account) {
      console.log(formatOutput({
        error: options.account
          ? `Instagram account "${options.account}" not found.`
          : 'No Instagram account configured.',
      }, options.pretty))
      process.exit(1)
    }

    await manager.removeAccount(account.account_id)
    console.log(formatOutput({ success: true, account_id: account.account_id, logged_out: true }, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const authCommand = new Command('auth')
  .description('Instagram authentication commands')
  .addCommand(
    new Command('login')
      .description('Log in to Instagram; prompts interactively or accepts flags for AI agents')
      .option('--username <username>', 'Instagram username')
      .option('--password <password>', 'Instagram password')
      .option('--pretty', 'Pretty print JSON output')
      .option('--debug', 'Show raw API responses')
      .action(loginAction),
  )
  .addCommand(
    new Command('extract')
      .description('Extract Instagram cookies from browser (Chrome, Edge, Arc, Brave)')
      .option('--pretty', 'Pretty print JSON output')
      .option('--debug', 'Show debug output')
      .action(extractAction),
  )
  .addCommand(
    new Command('verify')
      .description('Complete two-factor authentication (non-interactive)')
      .requiredOption('--username <username>', 'Instagram username')
      .requiredOption('--code <code>', 'Two-factor verification code')
      .requiredOption('--identifier <identifier>', 'Two-factor identifier from login response')
      .option('--pretty', 'Pretty print JSON output')
      .action(verifyAction),
  )
  .addCommand(
    new Command('challenge')
      .description('Resolve a security challenge (non-interactive)')
      .requiredOption('--username <username>', 'Instagram username')
      .option('--method <method>', 'Verification method: email or sms', 'email')
      .option('--code <code>', 'Verification code received via email/sms')
      .option('--pretty', 'Pretty print JSON output')
      .action(challengeAction),
  )
  .addCommand(
    new Command('status')
      .description('Show authentication status')
      .option('--account <id>', 'Use a specific Instagram account')
      .option('--pretty', 'Pretty print JSON output')
      .action(statusAction),
  )
  .addCommand(
    new Command('list')
      .description('List stored Instagram accounts')
      .option('--pretty', 'Pretty print JSON output')
      .action(listAction),
  )
  .addCommand(
    new Command('use')
      .description('Switch the current Instagram account')
      .argument('<account>', 'Account identifier')
      .option('--pretty', 'Pretty print JSON output')
      .action(useAction),
  )
  .addCommand(
    new Command('logout')
      .description('Remove stored credentials and session')
      .option('--account <id>', 'Use a specific Instagram account')
      .option('--pretty', 'Pretty print JSON output')
      .action(logoutAction),
  )
