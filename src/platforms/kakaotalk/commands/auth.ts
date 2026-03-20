import { Writable } from 'node:stream'

import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { generateDeviceUuid, loginFlow } from '../auth/kakao-login'
import { CredentialManager } from '../credential-manager'
import { KakaoTokenExtractor } from '../token-extractor'
import {
  KAKAO_NEXT_ACTIONS,
  type KakaoAuthOptions,
  type KakaoDeviceType,
  type KakaoLoginResult,
} from '../types'

function isInteractiveSession(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY)
}

async function promptLine(message: string): Promise<string | undefined> {
  const { createInterface } = await import('node:readline/promises')
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
  try {
    const answer = await rl.question(message)
    return answer.trim() || undefined
  } finally {
    rl.close()
  }
}

async function promptText(message: string): Promise<string | undefined> {
  return promptLine(`${message}: `)
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

async function loginAction(options: KakaoAuthOptions): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const interactive = isInteractiveSession()

    let { email, password, passcode, deviceType, force } = options

    // Try extracting email + password from the desktop app's Cache.db
    // so the user doesn't need to type credentials manually.
    if (!email || !password) {
      const extractor = new KakaoTokenExtractor()
      const cached = await extractor.extract()
      if (cached?.login_form_body) {
        const params = new URLSearchParams(cached.login_form_body)
        if (!email) email = params.get('email') ?? undefined
        if (!password) password = params.get('password') ?? undefined
        if (email && interactive) {
          console.error(`  Using cached credentials for ${email}`)
        }
      }
    }

    if (!email) {
      if (!interactive) {
        console.log(formatOutput(KAKAO_NEXT_ACTIONS.provide_email, options.pretty))
        return
      }
      email = await promptText('KakaoTalk email')
      if (!email) { console.error('Email is required.'); process.exit(1) }
    }

    if (!password) {
      if (!interactive) {
        console.log(formatOutput(KAKAO_NEXT_ACTIONS.provide_password, options.pretty))
        return
      }
      password = await promptHidden('Password')
      if (!password) { console.error('Password is required.'); process.exit(1) }
    }

    // Load saved device UUID for subsequent calls (passcode flow is multi-step)
    const existing = await credManager.getAccount()
    const pendingState = await credManager.loadPendingLogin()
    const savedDeviceUuid = pendingState?.device_uuid ?? existing?.device_uuid

    const result = await loginFlow({
      email,
      password,
      passcode,
      deviceType: deviceType ?? 'tablet',
      force: force ?? false,
      savedDeviceUuid,
    })

    if (result.next_action === 'provide_passcode') {
      // Save pending state so the next call can reuse the device UUID
      if (result.credentials?.device_uuid) {
        await credManager.savePendingLogin({
          device_uuid: result.credentials.device_uuid,
          device_type: result.credentials.device_type,
          email,
          created_at: new Date().toISOString(),
        })
      }

      if (!interactive) {
        console.log(formatOutput(KAKAO_NEXT_ACTIONS.provide_passcode, options.pretty))
        return
      }

      passcode = await promptText('SMS passcode')
      if (!passcode) { console.error('Passcode is required.'); process.exit(1) }

      const retryResult = await loginFlow({
        email,
        password,
        passcode,
        deviceType: deviceType ?? 'tablet',
        force: force ?? false,
        savedDeviceUuid: result.credentials?.device_uuid ?? savedDeviceUuid,
      })

      return handleLoginResult(retryResult, credManager, options)
    }

    if (result.next_action === 'choose_device') {
      if (!interactive) {
        console.log(formatOutput({
          ...KAKAO_NEXT_ACTIONS.choose_device,
          warning: result.warning,
        }, options.pretty))
        return
      }

      console.log('')
      console.log('  Tablet slot is occupied.')
      console.log('')
      console.log('  Choose device slot:')
      console.log('  1. PC     — will kick KakaoTalk desktop if running')
      console.log('  2. Tablet — will kick your tablet session')
      console.log('  3. Cancel')
      console.log('')

      const choice = await promptText('Choice (1/2/3)')
      if (choice === '3' || !choice) { console.log('Cancelled.'); return }

      const chosenType: KakaoDeviceType = choice === '1' ? 'pc' : 'tablet'
      const forceResult = await loginFlow({
        email,
        password,
        passcode,
        deviceType: chosenType,
        force: true,
        savedDeviceUuid: chosenType === (deviceType ?? 'tablet') ? savedDeviceUuid : undefined,
      })

      return handleLoginResult(forceResult, credManager, options)
    }

    return handleLoginResult(result, credManager, options)
  } catch (error) {
    handleError(error as Error)
  }
}

async function handleLoginResult(
  result: KakaoLoginResult & { credentials?: { access_token: string; refresh_token: string; user_id: string; device_uuid: string; device_type: KakaoDeviceType } },
  credManager: CredentialManager,
  options: KakaoAuthOptions,
): Promise<void> {
  if (result.authenticated && result.credentials) {
    const now = new Date().toISOString()
    await credManager.setAccount({
      account_id: result.credentials.user_id || 'default',
      oauth_token: result.credentials.access_token,
      user_id: result.credentials.user_id,
      refresh_token: result.credentials.refresh_token,
      device_uuid: result.credentials.device_uuid,
      device_type: result.credentials.device_type,
      created_at: now,
      updated_at: now,
    })
    await credManager.setCurrentAccount(result.credentials.user_id || 'default')
    await credManager.clearPendingLogin()

    console.log(formatOutput({
      authenticated: true,
      account_id: result.credentials.user_id,
      device_type: result.credentials.device_type,
    }, options.pretty))
  } else {
    console.log(formatOutput(result, options.pretty))
    if (result.error) process.exit(1)
  }
}

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
      device_uuid: token.device_uuid ?? generateDeviceUuid(),
      device_type: 'tablet',
      created_at: now,
      updated_at: now,
    })

    const config = await credManager.load()
    if (!config.current_account) {
      await credManager.setCurrentAccount(accountId)
    }

    console.log(formatOutput({ account_id: accountId, user_id: token.user_id, extracted: true }, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function statusAction(options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const account = await credManager.getAccount()

    if (!account) {
      console.log(formatOutput({ error: 'No account configured. Run "auth login" or "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    console.log(formatOutput({
      account_id: account.account_id,
      user_id: account.user_id,
      device_type: account.device_type,
      has_refresh_token: !!account.refresh_token,
      has_device_uuid: !!account.device_uuid,
      created_at: account.created_at,
      updated_at: account.updated_at,
    }, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function logoutAction(account: string | undefined, options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const config = await credManager.load()
    const targetAccount = account ?? config.current_account

    if (!targetAccount || !config.accounts[targetAccount]) {
      console.log(formatOutput({ error: `Account not found: ${targetAccount ?? '(none)'}` }, options.pretty))
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
    new Command('login')
      .description('Login as a sub-device; prompts interactively or accepts flags for AI agents')
      .option('--email <email>', 'KakaoTalk email address')
      .option('--password <password>', 'KakaoTalk password')
      .option('--passcode <code>', 'SMS passcode for device registration')
      .option('--device-type <type>', 'Device slot: tablet (default, safe) or pc', 'tablet')
      .option('--force', 'Force login even if device slot is occupied (kicks existing session)')
      .option('--pretty', 'Pretty print JSON output')
      .option('--debug', 'Show debug output')
      .action(loginAction),
  )
  .addCommand(
    new Command('extract')
      .description('Extract credentials from KakaoTalk desktop app (kicks desktop session)')
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
