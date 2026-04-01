import { Command } from 'commander'
import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'
import { WeChatClient } from '../client'
import { WeChatCredentialManager } from '../credential-manager'
import { createAccountId } from '../types'

interface ActionOptions {
  account?: string
  pretty?: boolean
  host?: string
  port?: number
  _credManager?: WeChatCredentialManager
}

interface ActionResult {
  success?: boolean
  error?: string
  account_id?: string
  name?: string
  user_id?: string
  created_at?: string
  updated_at?: string
  is_current?: boolean
  accounts?: Array<{ account_id: string; name?: string; is_current: boolean }>
}

export async function statusAction(options: ActionOptions): Promise<ActionResult> {
  try {
    const client = new WeChatClient({ host: options.host, port: options.port })
    const connected = await client.isConnected()

    if (!connected) {
      return { error: 'WeChat OneBot server not reachable at 127.0.0.1:58080. Make sure wechat_chatter onebot is running.' }
    }

    const loginInfo = await client.getLoginInfo()
    await client.login(options.account ? { accountId: options.account } : undefined)
    await client.saveCurrentAccount(loginInfo)

    return {
      account_id: client.getAccountId() ?? undefined,
      name: loginInfo.nickname,
      user_id: loginInfo.user_id,
    }
  } catch (error: unknown) {
    return { error: (error as Error).message }
  }
}

export async function setupAction(_options: ActionOptions): Promise<ActionResult> {
  const instructions = `WeChat + wechat_chatter Setup Guide
====================================

Prerequisites:
  - macOS (Apple Silicon or Intel)
  - WeChat 4.x installed and logged in
  - Xcode CLI tools: xcode-select --install

Step 1: Install Frida tools
  pip install frida-tools

Step 2: Build insert_dylib
  git clone https://github.com/Tyilo/insert_dylib /tmp/insert_dylib
  cd /tmp/insert_dylib && xcodebuild
  sudo cp build/Release/insert_dylib /usr/local/bin/

Step 3: Download and inject Frida Gadget
  wget https://github.com/frida/frida/releases/download/17.5.2/frida-gadget-17.5.2-macos-universal.dylib.xz -O /tmp/gadget.dylib.xz
  xz -d /tmp/gadget.dylib.xz
  cp /tmp/gadget.dylib /Applications/WeChat.app/Contents/Frameworks/FridaGadget.dylib
  chmod +x /Applications/WeChat.app/Contents/Frameworks/FridaGadget.dylib

Step 4: Inject into WeChat binary
  cd /Applications/WeChat.app/Contents/MacOS/
  insert_dylib --inplace --strip-codesig "@executable_path/../Frameworks/FridaGadget.dylib" WeChat

Step 5: Re-sign WeChat
  sudo codesign --force --deep --sign - /Applications/WeChat.app

Step 6: Download and run wechat_chatter OneBot server
  # Download from: https://github.com/yincongcyincong/wechat_chatter/releases
  # Run:
  ./onebot -type=gadget -wechat_conf=../wechat_version/4_1_8_29_mac.json

Step 7: Verify
  agent-wechat auth status`

  console.log(instructions)
  process.exit(0)
  return { success: true }
}

export async function listAction(options: ActionOptions): Promise<ActionResult> {
  try {
    const credManager = options._credManager ?? new WeChatCredentialManager()
    const accounts = await credManager.listAccounts()

    return {
      accounts: accounts.map((a) => ({
        account_id: a.account_id,
        name: a.name,
        is_current: a.is_current,
      })),
    }
  } catch (error: unknown) {
    return { error: (error as Error).message }
  }
}

export async function useAction(accountId: string, options: ActionOptions): Promise<ActionResult> {
  try {
    const credManager = options._credManager ?? new WeChatCredentialManager()
    const normalized = createAccountId(accountId)
    const found = await credManager.setCurrent(normalized) || await credManager.setCurrent(accountId)

    if (!found) {
      return { error: `WeChat account "${accountId}" not found. Run "auth list" to see available accounts.` }
    }

    const account = await credManager.getAccount()
    return { success: true, account_id: account?.account_id }
  } catch (error: unknown) {
    return { error: (error as Error).message }
  }
}

export async function logoutAction(options: ActionOptions): Promise<ActionResult> {
  try {
    const credManager = options._credManager ?? new WeChatCredentialManager()
    const account = await credManager.getAccount(options.account)

    if (!account && !options.account) {
      return { error: 'No WeChat account configured.' }
    }

    const accountId = account?.account_id ?? options.account!

    const removed = await credManager.removeAccount(accountId)

    if (!removed) {
      return { error: `WeChat account "${accountId}" not found.` }
    }

    return { success: true, account_id: accountId }
  } catch (error: unknown) {
    return { error: (error as Error).message }
  }
}

function cliOutput(result: ActionResult, pretty?: boolean, exitOnError = true): void {
  console.log(formatOutput(result, pretty))
  if (result.error && exitOnError) process.exit(1)
}

export const authCommand = new Command('auth')
  .description('WeChat authentication commands')
  .addCommand(
    new Command('status')
      .description('Check OneBot server and show current user info')
      .option('--account <id>', 'Use a specific WeChat account')
      .option('--host <host>', 'OneBot server host (default: 127.0.0.1)')
      .option('--port <port>', 'OneBot server port (default: 58080)')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (opts: { account?: string; host?: string; port?: string; pretty?: boolean }) => {
        try {
          const result = await statusAction({
            ...opts,
            port: opts.port ? Number(opts.port) : undefined,
          })
          console.log(formatOutput(result, opts.pretty))
          if (result.error) process.exit(1)
          else process.exit(0)
        } catch (error) {
          handleError(error as Error)
        }
      }),
  )
  .addCommand(
    new Command('setup')
      .description('Print setup instructions for wechat_chatter + Frida Gadget')
      .action(async (opts: Record<string, unknown>) => {
        try {
          await setupAction(opts)
        } catch (error) {
          handleError(error as Error)
        }
      }),
  )
  .addCommand(
    new Command('list')
      .description('List stored WeChat accounts')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (opts: { pretty?: boolean }) => {
        try {
          cliOutput(await listAction(opts), opts.pretty)
        } catch (error) {
          handleError(error as Error)
        }
      }),
  )
  .addCommand(
    new Command('use')
      .description('Switch the current WeChat account')
      .argument('<account>', 'Account identifier')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (accountId: string, opts: { pretty?: boolean }) => {
        try {
          cliOutput(await useAction(accountId, opts), opts.pretty)
        } catch (error) {
          handleError(error as Error)
        }
      }),
  )
  .addCommand(
    new Command('logout')
      .description('Remove stored account info')
      .option('--account <id>', 'Use a specific WeChat account')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (opts: { account?: string; pretty?: boolean }) => {
        try {
          const result = await logoutAction(opts)
          cliOutput(result, opts.pretty)
          if (!result.error) process.exit(0)
        } catch (error) {
          handleError(error as Error)
        }
      }),
  )

export { WeChatClient }
