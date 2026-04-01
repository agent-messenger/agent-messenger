import { execSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Command } from 'commander'
import QRCode from 'qrcode'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'
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

async function createQRHtmlFile(url: string): Promise<string> {
  const svgString = await QRCode.toString(url, { type: 'svg', margin: 2 })
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>LINE QR Login</title>
<style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;font-family:-apple-system,system-ui,sans-serif;background:#06C755}
.card{background:#fff;border-radius:16px;padding:40px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.15)}
h1{margin:0 0 8px;font-size:22px;color:#111}p{margin:0 0 24px;color:#666;font-size:14px}
svg{width:280px;height:280px}</style></head>
<body><div class="card"><h1>LINE Login</h1><p>Scan with the LINE mobile app</p>${svgString}</div></body></html>`

  const htmlPath = join(tmpdir(), `line-qr-${Date.now()}.html`)
  writeFileSync(htmlPath, html)
  setTimeout(() => { try { unlinkSync(htmlPath) } catch {} }, 300_000).unref()
  return htmlPath
}

function openInBrowser(filePath: string): void {
  try {
    if (process.platform === 'darwin') {
      execSync(`open "${filePath}"`, { stdio: 'ignore' })
    } else if (process.platform === 'win32') {
      execSync(`start "" "${filePath}"`, { stdio: 'ignore' })
    } else {
      execSync(`xdg-open "${filePath}"`, { stdio: 'ignore' })
    }
  } catch {}
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
      console.log(formatOutput({
        authenticated: true,
        account_id: profile.mid,
        display_name: profile.display_name,
        device,
      }, options.pretty))
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
          const htmlPath = await createQRHtmlFile(url).catch(() => null)
          if (htmlPath) openInBrowser(htmlPath)

          if (interactive) {
            try {
              const qrAscii = await QRCode.toString(url, { type: 'terminal', small: true })
              info('\nScan this QR code with the LINE mobile app:\n')
              info(qrAscii)
            } catch {
              info(`\nOpen the QR code in the browser window, or scan this URL:\n${url}\n`)
            }
          } else {
            console.log(formatOutput({
              next_action: 'scan_qr',
              qr_url: url,
              qr_html_path: htmlPath,
              message: htmlPath
                ? 'QR code opened in browser. Scan with LINE mobile app to complete login.'
                : 'QR code generated. Open qr_url to scan with LINE mobile app.',
            }, options.pretty))
          }
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

    console.log(formatOutput({
      account_id: account.account_id,
      device: account.device,
      display_name: account.display_name,
      created_at: account.created_at,
      updated_at: account.updated_at,
    }, options.pretty))
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
      .option('--device <type>', 'Device type (default: ANDROIDSECONDARY). Secondary device that coexists with LINE desktop. Use DESKTOPMAC/DESKTOPWIN to replace desktop session.')
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
