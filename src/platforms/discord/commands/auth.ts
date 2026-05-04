import { Command } from 'commander'

import { collectBrowserProfileOption } from '@/shared/chromium'
import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'
import { debug } from '@/shared/utils/stderr'

import { DiscordClient } from '../client'
import { DiscordCredentialManager } from '../credential-manager'
import { DiscordTokenExtractor } from '../token-extractor'

export async function extractAction(options: {
  pretty?: boolean
  debug?: boolean
  browserProfile?: string[]
}): Promise<void> {
  try {
    const extractor = new DiscordTokenExtractor(undefined, undefined, undefined, undefined, options.browserProfile)

    if (process.platform === 'darwin') {
      console.log('')
      console.log('  Extracting your Discord credentials...')
      console.log('')
      console.log('  Your Mac may ask for your password to access Keychain.')
      console.log('  This is required because Discord encrypts your login token')
      console.log('  using macOS Keychain for security.')
      console.log('')
      console.log('  What happens:')
      console.log("    1. We read the encrypted token from Discord's local storage")
      console.log('    2. macOS Keychain decrypts it (requires your password)')
      console.log('    3. The token is stored locally in ~/.config/agent-messenger/')
      console.log('')
      console.log('  Your password is never stored or transmitted anywhere.')
      console.log('')
    }

    if (options.debug) {
      debug(`[debug] Extracting Discord token...`)
    }

    const extracted = await extractor.extract()

    if (extracted.length === 0) {
      console.log(
        formatOutput(
          {
            error: getNoDiscordTokenFoundMessage(),
            hint: options.debug ? undefined : 'Run with --debug for more info.',
          },
          options.pretty,
        ),
      )
      process.exit(1)
    }

    for (const { token } of extracted) {
      if (options.debug) {
        debug(`[debug] Token extracted: ${token.substring(0, 20)}...`)
      }

      try {
        const client = await new DiscordClient().login({ token })

        if (options.debug) {
          debug(`[debug] Testing token validity...`)
        }

        const authInfo = await client.testAuth()

        if (options.debug) {
          debug(`[debug] ✓ Token valid for user: ${authInfo.username}`)
          debug(`[debug] Discovering servers...`)
        }

        const servers = await client.listServers()

        if (options.debug) {
          debug(`[debug] ✓ Found ${servers.length} server(s)`)
        }

        if (servers.length === 0) {
          if (options.debug) {
            debug(`[debug] No servers found for this token, trying next...`)
          }
          continue
        }

        const credManager = new DiscordCredentialManager()
        const serverMap: Record<string, { server_id: string; server_name: string }> = {}

        for (const server of servers) {
          serverMap[server.id] = {
            server_id: server.id,
            server_name: server.name,
          }
        }

        const config = {
          token,
          current_server: servers[0].id,
          servers: serverMap,
        }

        await credManager.save(config)

        if (options.debug) {
          debug(`[debug] ✓ Credentials saved`)
        }

        const output = {
          servers: servers.map((g) => `${g.id}/${g.name}`),
          current: servers[0].id,
        }

        console.log(formatOutput(output, options.pretty))
        return
      } catch (error) {
        if (options.debug) {
          debug(`[debug] Token validation failed: ${(error as Error).message}, trying next...`)
        }
        continue
      }
    }

    console.log(
      formatOutput(
        {
          error: 'No usable Discord token found. Tokens may be expired or have no servers.',
          hint: 'Make sure Discord is logged in to the desktop app or a supported Chromium browser, and that you are a member of at least one server.',
        },
        options.pretty,
      ),
    )
    process.exit(1)
  } catch (error) {
    handleError(error as Error)
  }
}

export async function logoutAction(options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new DiscordCredentialManager()
    const config = await credManager.load()

    if (!config.token) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    await credManager.clearToken()

    console.log(formatOutput({ removed: 'discord', success: true }, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export async function statusAction(options: { pretty?: boolean }): Promise<void> {
  try {
    const credManager = new DiscordCredentialManager()
    const config = await credManager.load()

    if (!config.token) {
      console.log(formatOutput({ error: 'Not authenticated. Run "auth extract" first.' }, options.pretty))
      process.exit(1)
    }

    let authInfo: { id: string; username: string } | null = null
    let valid = false

    try {
      const client = await new DiscordClient().login({ token: config.token })
      authInfo = await client.testAuth()
      valid = true
    } catch {
      valid = false
    }

    const output = {
      authenticated: valid,
      user: authInfo?.username,
      current_server: config.current_server,
      servers_count: Object.keys(config.servers).length,
    }

    console.log(formatOutput(output, options.pretty))
  } catch (error) {
    handleError(error as Error)
  }
}

export function getNoDiscordTokenFoundMessage(): string {
  return 'No Discord token found. Make sure Discord is logged in to the desktop app or a supported Chromium browser.'
}

export const authCommand = new Command('auth')
  .description('Authentication commands')
  .addCommand(
    new Command('extract')
      .description('Extract token from Discord desktop app or a supported Chromium browser')
      .option('--pretty', 'Pretty print JSON output')
      .option('--debug', 'Show debug output for troubleshooting')
      .option(
        '--browser-profile <path>',
        'Additional Chromium profile/user-data directory to scan (repeatable, comma-separated supported)',
        collectBrowserProfileOption,
        [],
      )
      .action(extractAction),
  )
  .addCommand(
    new Command('logout')
      .description('Logout from Discord')
      .option('--pretty', 'Pretty print JSON output')
      .action(logoutAction),
  )
  .addCommand(
    new Command('status')
      .description('Show authentication status')
      .option('--pretty', 'Pretty print JSON output')
      .action(statusAction),
  )
