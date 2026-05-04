import { Command } from 'commander'

import { collectBrowserProfileOption } from '@/shared/chromium'
import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'
import { info, debug } from '@/shared/utils/stderr'

import { getWebexAppCredentials } from '../app-config'
import { WebexClient } from '../client'
import { WebexCredentialManager } from '../credential-manager'
import { WebexTokenExtractor } from '../token-extractor'
import { WebexError } from '../types'

interface ResolvedCredentials {
  clientId: string
  clientSecret: string
}

async function openBrowser(url: string): Promise<void> {
  const { exec } = await import('node:child_process')
  const command =
    process.platform === 'darwin'
      ? `open "${url}"`
      : process.platform === 'win32'
        ? `start "" "${url}"`
        : `xdg-open "${url}"`
  exec(command)
}

async function resolveClientCredentials(options: {
  clientId?: string
  clientSecret?: string
}): Promise<ResolvedCredentials> {
  // 1. CLI flags
  if (options.clientId || options.clientSecret) {
    if (!options.clientId || !options.clientSecret) {
      throw new Error('Both --client-id and --client-secret must be provided together.')
    }
    return { clientId: options.clientId, clientSecret: options.clientSecret }
  }

  // 2. Env vars → 3. Built-in defaults (always resolves)
  return getWebexAppCredentials()
}

export async function loginAction(options: {
  token?: string
  clientId?: string
  clientSecret?: string
  pretty?: boolean
}): Promise<void> {
  try {
    const credManager = new WebexCredentialManager()

    if (options.token) {
      const client = await new WebexClient().login({ token: options.token })
      const person = await client.testAuth()
      await credManager.saveConfig({
        accessToken: options.token,
        refreshToken: '',
        expiresAt: 0,
        tokenType: 'manual',
      })
      console.log(
        formatOutput(
          {
            user: { id: person.id, displayName: person.displayName, emails: person.emails },
            authenticated: true,
          },
          options.pretty,
        ),
      )
      return
    }

    const { clientId, clientSecret } = await resolveClientCredentials(options)

    const device = await credManager.requestDeviceCode(clientId)

    info(`Open this URL and enter the code: ${device.verificationUri}`)
    info(`Code: ${device.userCode}`)
    info('')
    await openBrowser(device.verificationUriComplete)
    info('Waiting for authorization...')

    const config = await credManager.pollDeviceToken(
      device.deviceCode,
      device.interval,
      device.expiresIn,
      clientId,
      clientSecret,
    )

    await credManager.saveConfig({ ...config, clientId, clientSecret, tokenType: 'oauth' })

    const client = await new WebexClient().login({ token: config.accessToken })
    const person = await client.testAuth()

    console.log(
      formatOutput(
        {
          user: { id: person.id, displayName: person.displayName, emails: person.emails },
          authenticated: true,
        },
        options.pretty,
      ),
    )
  } catch (error) {
    handleError(error as Error)
  }
}

export async function statusAction(options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new WebexCredentialManager()
    const config = await credManager.loadConfig()
    const token = await credManager.getToken(config?.clientId, config?.clientSecret)

    if (!token) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth login" first.' }, options.pretty))
      process.exit(1)
      return
    }

    try {
      const client = await new WebexClient().login({ token })
      const person = await client.testAuth()
      console.log(
        formatOutput(
          {
            authenticated: true,
            user: { id: person.id, displayName: person.displayName, emails: person.emails },
          },
          options.pretty,
        ),
      )
    } catch {
      console.log(formatOutput({ authenticated: false, user: null }, options.pretty))
    }
  } catch (error) {
    handleError(error as Error)
  }
}

export async function extractAction(options: {
  pretty?: boolean
  debug?: boolean
  browserProfile?: string[]
}): Promise<void> {
  try {
    const debugLog = options.debug ? (msg: string) => debug(`[debug] ${msg}`) : undefined
    const extractor = new WebexTokenExtractor(undefined, debugLog, undefined, options.browserProfile)

    if (options.debug) {
      debug('[debug] Searching browser profiles for Webex tokens...')
    }

    const extracted = await extractor.extract()

    if (!extracted) {
      console.log(
        formatOutput(
          {
            error:
              'No Webex token found in any browser. Make sure you are logged in at https://web.webex.com (not webex.com) in Chrome, Edge, Arc, or Brave.',
            hint: 'Run "auth login" for OAuth Device Grant flow, or --debug for more info.',
          },
          options.pretty,
        ),
      )
      process.exit(1)
      return
    }

    const isExpired = extracted.expiresAt != null && extracted.expiresAt > 0 && extracted.expiresAt < Date.now()
    if (isExpired && options.debug) {
      const agoMs = Date.now() - extracted.expiresAt!
      const agoHours = Math.round(agoMs / 3_600_000)
      debugLog?.(`Token expired ${agoHours > 0 ? `${agoHours}h ago` : 'recently'}.`)
    }

    let activeToken = extracted.accessToken
    let refreshedConfig: { accessToken: string; refreshToken: string; expiresAt: number } | null = null

    if (isExpired && extracted.refreshToken) {
      debugLog?.('Attempting token refresh...')
      const credManager = new WebexCredentialManager()
      const { clientId, clientSecret } = getWebexAppCredentials()
      refreshedConfig = await credManager.refreshToken(extracted.refreshToken, clientId, clientSecret)
      if (refreshedConfig) {
        debugLog?.('Token refreshed successfully.')
        activeToken = refreshedConfig.accessToken
      } else {
        debugLog?.('Token refresh failed. Will attempt validation with expired token.')
      }
    }

    const client = await new WebexClient().login({
      token: activeToken,
      deviceUrl: extracted.deviceUrl,
      tokenType: 'extracted',
    })

    let person: { id: string; displayName: string; emails: string[] } | null = null
    try {
      const result = await client.testAuth()
      if (result.id) {
        person = { id: result.id, displayName: result.displayName, emails: result.emails }
      }
    } catch (authError) {
      const isAuthFailure =
        authError instanceof WebexError && (authError.code === 'http_401' || authError.code === 'http_403')
      if (isExpired && isAuthFailure) {
        console.log(
          formatOutput(
            {
              error: 'Extracted browser token is expired and could not be refreshed.',
              hint: 'Log in at https://web.webex.com (not webex.com) in your browser, then run "auth extract" again. Or use "auth login" for OAuth Device Grant flow.',
            },
            options.pretty,
          ),
        )
        process.exit(1)
        return
      }
      throw authError
    }

    const credManager = new WebexCredentialManager()
    await credManager.saveConfig({
      accessToken: activeToken,
      refreshToken: refreshedConfig?.refreshToken ?? extracted.refreshToken ?? '',
      expiresAt: refreshedConfig?.expiresAt ?? extracted.expiresAt ?? 0,
      tokenType: 'extracted',
      deviceUrl: extracted.deviceUrl,
      userId: extracted.userId,
      encryptionKeys: extracted.encryptionKeys ? Object.fromEntries(extracted.encryptionKeys) : undefined,
    })

    const output: Record<string, unknown> = {
      authenticated: true,
      tokenType: 'extracted',
    }
    if (refreshedConfig) {
      output['refreshed'] = true
    }
    if (person) {
      output['user'] = person
    }

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export async function logoutAction(options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new WebexCredentialManager()
    const config = await credManager.loadConfig()

    if (!config) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth login" first.' }, options.pretty))
      process.exit(1)
      return
    }

    await credManager.clearCredentials()
    console.log(formatOutput({ removed: 'webex', success: true }, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export const authCommand = new Command('auth')
  .description('Authentication commands')
  .addCommand(
    new Command('login')
      .description('Login to Webex')
      .option('--token <token>', 'Use a bot token or personal access token directly')
      .option('--client-id <id>', 'Webex Integration client ID')
      .option('--client-secret <secret>', 'Webex Integration client secret')
      .option('--pretty', 'Pretty print JSON output')
      .action(loginAction),
  )
  .addCommand(
    new Command('extract')
      .description('Extract Webex token from browser (Chrome, Edge, Arc, Brave)')
      .option('--pretty', 'Pretty print JSON output')
      .option('--debug', 'Show debug output')
      .option(
        '--browser-profile <path>',
        'Additional Chromium profile/user-data directory to scan (repeatable, comma-separated supported)',
        collectBrowserProfileOption,
        [],
      )
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
      .description('Logout from Webex')
      .option('--pretty', 'Pretty print JSON output')
      .action(logoutAction),
  )
