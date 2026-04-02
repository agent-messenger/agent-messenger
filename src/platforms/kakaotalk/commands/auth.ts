import { Writable } from 'node:stream'

import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'
import { info, error, debug } from '@/shared/utils/stderr'

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

function hasTTY(): boolean {
  try {
    const { openSync, closeSync } = require('node:fs') as typeof import('node:fs')
    // CONIN$ is the Windows console input device; /dev/tty is the Unix equivalent
    const ttyDevice = process.platform === 'win32' ? 'CONIN$' : '/dev/tty'
    const fd = openSync(ttyDevice, 'r')
    closeSync(fd)
    return true
  } catch { return false }
}

async function promptPasswordGUI(email?: string): Promise<string | undefined> {
  const { execSync } = require('node:child_process') as typeof import('node:child_process')
  const label = email
    ? `agent-messenger wants to log in to KakaoTalk as ${email}.\\n\\nEnter your password:`
    : 'agent-messenger wants to log in to KakaoTalk.\\n\\nEnter your password:'

  if (process.platform === 'darwin') {
    try {
      const { writeFileSync, unlinkSync } = require('node:fs') as typeof import('node:fs')
      const { tmpdir } = require('node:os') as typeof import('node:os')
      const { join } = require('node:path') as typeof import('node:path')
      const scriptPath = join(tmpdir(), `kakao-pw-${Date.now()}.swift`)
      const infoText = email ? `Enter password for ${email}` : 'Enter your KakaoTalk password'
      const escapedEmail = (email ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"')
      writeFileSync(scriptPath, `
import AppKit
let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let alert = NSAlert()
alert.messageText = "KakaoTalk Login"
alert.informativeText = "agent-messenger wants to sign in to your KakaoTalk account.\\nThis is a one-time device registration."
alert.alertStyle = .informational
alert.addButton(withTitle: "Sign In")
alert.addButton(withTitle: "Cancel")
let iconPaths = [
  "/Applications/KakaoTalk.app/Contents/Resources/AppIcon.icns",
  NSString("~/Applications/KakaoTalk.app/Contents/Resources/AppIcon.icns").expandingTildeInPath,
]
for path in iconPaths {
  if let icon = NSImage(contentsOfFile: path) {
    alert.icon = icon
    break
  }
}
let container = NSView(frame: NSRect(x: 0, y: 0, width: 260, height: 54))
let emailField = NSTextField(frame: NSRect(x: 0, y: 30, width: 260, height: 24))
emailField.stringValue = "${escapedEmail}"
emailField.isEditable = false
emailField.isSelectable = false
emailField.isBezeled = true
emailField.bezelStyle = .roundedBezel
emailField.backgroundColor = .windowBackgroundColor
emailField.textColor = .secondaryLabelColor
container.addSubview(emailField)
let passwordField = NSSecureTextField(frame: NSRect(x: 0, y: 0, width: 260, height: 24))
passwordField.placeholderString = "Password"
container.addSubview(passwordField)
alert.accessoryView = container
alert.window.initialFirstResponder = passwordField
app.activate(ignoringOtherApps: true)
alert.window.makeKeyAndOrderFront(nil)
let response = alert.runModal()
if response == .alertFirstButtonReturn {
  print(passwordField.stringValue)
} else {
  exit(1)
}
`)
      try {
        const result = execSync(`swift ${scriptPath}`, { encoding: 'utf-8', timeout: 120_000, stdio: ['pipe', 'pipe', 'pipe'] })
        return result.trim() || undefined
      } finally {
        try { unlinkSync(scriptPath) } catch {}
      }
    } catch { return undefined }
  }

  if (process.platform === 'win32') {
    try {
      const escapedEmail = (email ?? '').replace(/'/g, "''")
      const ps = [
        'Add-Type -AssemblyName System.Windows.Forms;',
        'Add-Type -AssemblyName System.Drawing;',
        "$f = New-Object Windows.Forms.Form -Property @{Text='KakaoTalk Login'; Width=340; Height=230; StartPosition='CenterScreen'; FormBorderStyle='FixedDialog'; MaximizeBox=$false; MinimizeBox=$false};",
        "$d = New-Object Windows.Forms.Label -Property @{Text='agent-messenger wants to sign in to your KakaoTalk account.'; Left=12; Top=12; Width=300; Height=18; ForeColor=[Drawing.Color]::Gray; Font=New-Object Drawing.Font('Segoe UI',8.5)};",
        "$el = New-Object Windows.Forms.Label -Property @{Text='Account'; Left=12; Top=40; Width=300; Height=16; Font=New-Object Drawing.Font('Segoe UI',8)};",
        `$e = New-Object Windows.Forms.TextBox -Property @{Text='${escapedEmail}'; Left=12; Top=58; Width=300; ReadOnly=$true; BackColor=[Drawing.SystemColors]::Control};`,
        "$pl = New-Object Windows.Forms.Label -Property @{Text='Password'; Left=12; Top=90; Width=300; Height=16; Font=New-Object Drawing.Font('Segoe UI',8)};",
        "$p = New-Object Windows.Forms.TextBox -Property @{Left=12; Top=108; Width=300; PasswordChar='*'};",
        "$ot = New-Object Windows.Forms.Label -Property @{Text='This is a one-time device registration.'; Left=12; Top=140; Width=300; Height=16; ForeColor=[Drawing.Color]::Gray; Font=New-Object Drawing.Font('Segoe UI',8)};",
        "$b = New-Object Windows.Forms.Button -Property @{Text='Sign In'; Left=232; Top=162; Width=80; DialogResult='OK'; FlatStyle='System'};",
        "$c = New-Object Windows.Forms.Button -Property @{Text='Cancel'; Left=148; Top=162; Width=80; DialogResult='Cancel'; FlatStyle='System'};",
        '$f.AcceptButton = $b; $f.CancelButton = $c; $f.Controls.AddRange(@($d,$el,$e,$pl,$p,$ot,$b,$c)); $f.ActiveControl = $p;',
        "if ($f.ShowDialog() -eq 'OK') { Write-Output $p.Text }",
      ].join(' ')
      const result = execSync(`powershell -Command "${ps}"`, { encoding: 'utf-8', timeout: 120_000 })
      return result.trim() || undefined
    } catch { return undefined }
  }

  if (process.platform === 'linux') {
    const escapedEmail = (email ?? '').replace(/"/g, '\\"')
    try {
      const result = execSync(
        `zenity --password --title="KakaoTalk Login" --text="agent-messenger · KakaoTalk\\n${escapedEmail}" 2>/dev/null`,
        { encoding: 'utf-8', timeout: 120_000 },
      )
      return result.trim() || undefined
    } catch { /* zenity not available or cancelled */ }
    try {
      const result = execSync(
        `kdialog --password "agent-messenger · KakaoTalk\\n${escapedEmail}" --title "KakaoTalk Login" 2>/dev/null`,
        { encoding: 'utf-8', timeout: 120_000 },
      )
      return result.trim() || undefined
    } catch { /* kdialog not available or cancelled */ }
  }

  return undefined
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

async function promptHiddenTTY(message: string): Promise<string | undefined> {
  if (process.platform === 'win32') {
    const { execSync } = require('node:child_process') as typeof import('node:child_process')
    try {
      const escapedMessage = message.replace(/'/g, "''")
      const ps = `$p = Read-Host '${escapedMessage}' -AsSecureString; [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($p))`
      const result = execSync(`powershell -NoProfile -Command "${ps}"`, {
        encoding: 'utf-8',
        timeout: 120_000,
        stdio: ['inherit', 'pipe', 'inherit'],
      })
      return result.trim() || undefined
    } catch { return undefined }
  }

  const { createReadStream } = await import('node:fs')
  const { createInterface } = await import('node:readline/promises')
  const ttyIn = createReadStream('/dev/tty')
  const ttyOut = new (class extends Writable {
    muted = false
    _write(chunk: Buffer | string, encoding: BufferEncoding, cb: (error?: Error | null) => void): void {
      if (!this.muted) process.stderr.write(chunk, encoding)
      cb()
    }
  })()
  const rl = createInterface({ input: ttyIn, output: ttyOut, terminal: true })
  try {
    ttyOut.muted = true
    process.stderr.write(`${message}: `)
    const answer = await rl.question('')
    process.stderr.write('\n')
    return answer.trim() || undefined
  } finally {
    ttyOut.muted = false
    rl.close()
    ttyIn.close()
  }
}

async function loginAction(options: KakaoAuthOptions): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const interactive = isInteractiveSession()

    let { email, password, deviceType, force } = options

    if (!password && options.passwordFile) {
      const { readFileSync, unlinkSync } = await import('node:fs')
      password = readFileSync(options.passwordFile, 'utf-8').trim()
      unlinkSync(options.passwordFile)
    }

    if (!email || !password) {
      const extractor = new KakaoTokenExtractor()
      const cached = await extractor.extract()
      if (cached?.login_form_body) {
        const params = new URLSearchParams(cached.login_form_body)
        if (!email) email = params.get('email') ?? undefined
        const cachedPassword = params.get('password') ?? undefined

        // Recent macOS KakaoTalk versions hash the password (128-char hex)
        // before caching. This hash won't work against the Android login
        // endpoint, so we discard it and prompt for the plaintext password.
        const isHashedPassword = cachedPassword && /^[0-9a-f]{128}$/.test(cachedPassword)
        if (!isHashedPassword && !password) {
          password = cachedPassword
        }

        if (email && interactive) {
          info(`  Using cached credentials for ${email}`)
        }
        if (isHashedPassword && !password) {
          const passwordPrompt = email ? `Password for ${email}` : 'Password'
          if (interactive) {
            info(`  One-time setup: password is needed to register this device.`)
            password = await promptHidden(passwordPrompt)
          } else if (hasTTY()) {
            info(`  One-time setup: password is needed to register this device.`)
            try { password = await promptHiddenTTY(passwordPrompt) } catch { /* /dev/tty open failed */ }
          }
          if (!password) {
            password = await promptPasswordGUI(email)
          }
          if (!password) {
            console.log(formatOutput({
              next_action: 'run_interactive',
              message: 'One-time device registration required. Run `agent-kakaotalk auth login` in a terminal so the user can enter their password securely.',
            }, options.pretty))
            return
          }
        }
      }
    }

    if (!email) {
      if (!interactive) {
        console.log(formatOutput(KAKAO_NEXT_ACTIONS.provide_email, options.pretty))
        return
      }
      email = await promptText('KakaoTalk email')
      if (!email) { error('Email is required.'); process.exit(1) }
    }

    if (!password) {
      if (!interactive) {
        console.log(formatOutput(KAKAO_NEXT_ACTIONS.provide_password, options.pretty))
        return
      }
      password = await promptHidden('Password')
      if (!password) { error('Password is required.'); process.exit(1) }
    }

    const existing = await credManager.getAccount()
    const pendingState = await credManager.loadPendingLogin()
    const savedDeviceUuid = pendingState?.device_uuid ?? existing?.device_uuid

    const onPasscodeDisplay = (code: string) => {
      if (interactive) {
        info('')
        info(`  Enter this code on your phone: ${code}`)
        info('  Waiting for confirmation...')
        info('')
      }
    }

    const debugLog = options.debug ? (msg: string) => debug(`[debug] ${msg}`) : undefined

    const result = await loginFlow({
      email,
      password,
      deviceType: deviceType ?? 'tablet',
      force: force ?? false,
      savedDeviceUuid,
      onPasscodeDisplay,
      debugLog,
    })

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
      if (choice !== '1' && choice !== '2') { console.log('Cancelled.'); return }

      const chosenType: KakaoDeviceType = choice === '1' ? 'pc' : 'tablet'
      const forceResult = await loginFlow({
        email,
        password,
        deviceType: chosenType,
        force: true,
        savedDeviceUuid: chosenType === (deviceType ?? 'tablet') ? savedDeviceUuid : undefined,
        onPasscodeDisplay,
        debugLog,
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
    const debugLog = options.debug ? (msg: string) => debug(`[debug] ${msg}`) : undefined
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
      debug(`[debug] oauth_token: ${display}`)
      debug(`[debug] user_id: ${token.user_id}`)
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

async function listAction(options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const accounts = await credManager.listAccounts()
    console.log(
      formatOutput(
        accounts.map(({ account_id, user_id, device_type, created_at, updated_at, is_current }) => ({
          account_id,
          user_id,
          device_type,
          created_at,
          updated_at,
          is_current,
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
    const credManager = new CredentialManager()
    const account = await credManager.getAccount(accountId)
    if (!account) {
      console.log(
        formatOutput(
          {
            error: `Account "${accountId}" not found. Run "agent-kakaotalk auth list" to see available accounts.`,
          },
          options.pretty,
        ),
      )
      process.exit(1)
    }
    await credManager.setCurrentAccount(account.account_id)
    console.log(formatOutput({ success: true, account_id: account.account_id }, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

async function statusAction(options: { account?: string; pretty?: boolean }): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const account = await credManager.getAccount(options.account)

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

async function logoutAction(options: { account?: string; pretty?: boolean }): Promise<void> {
  try {
    const credManager = new CredentialManager()
    const config = await credManager.load()
    const targetAccount = options.account ?? config.current_account

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
      .option('--password-file <path>', 'Read password from file (deleted after read)')
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
    new Command('list')
      .description('List all authenticated KakaoTalk accounts')
      .option('--pretty', 'Pretty print JSON output')
      .action(listAction),
  )
  .addCommand(
    new Command('use')
      .description('Switch the active KakaoTalk account')
      .argument('<account>', 'Account ID to activate')
      .option('--pretty', 'Pretty print JSON output')
      .action(useAction),
  )
  .addCommand(
    new Command('status')
      .description('Show authentication status')
      .option('--account <id>', 'Use a specific KakaoTalk account')
      .option('--pretty', 'Pretty print JSON output')
      .action(statusAction),
  )
  .addCommand(
    new Command('logout')
      .description('Remove stored credentials')
      .option('--account <id>', 'Account to remove (default: current)')
      .option('--pretty', 'Pretty print JSON output')
      .action(logoutAction),
  )
