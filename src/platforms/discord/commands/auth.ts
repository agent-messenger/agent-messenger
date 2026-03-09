import { Command } from 'commander'

import { handleError } from '@/shared/utils/error-handler'
import { formatOutput } from '@/shared/utils/output'

import { DiscordClient } from '../client'
import { DiscordCredentialManager } from '../credential-manager'
import { DiscordTokenExtractor } from '../token-extractor'

export async function extractAction(options: { pretty?: boolean; debug?: boolean }): Promise<void> {
  try {
    const extractor = new DiscordTokenExtractor()

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
      console.error(`[debug] Extracting Discord token...`)
    }

    const extracted = await extractor.extract()

    if (!extracted) {
      console.log(
        formatOutput(
          {
            error: 'No Discord token found. Make sure Discord desktop app is installed and logged in.',
            hint: options.debug ? undefined : 'Run with --debug for more info.',
          },
          options.pretty,
        ),
      )
      process.exit(1)
    }

    if (options.debug) {
      console.error(`[debug] Token extracted: ${extracted.token.substring(0, 20)}...`)
    }

    try {
      const client = new DiscordClient(extracted.token)

      if (options.debug) {
        console.error(`[debug] Testing token validity...`)
      }

      const authInfo = await client.testAuth()

      if (options.debug) {
        console.error(`[debug] ✓ Token valid for user: ${authInfo.username}`)
        console.error(`[debug] Discovering servers...`)
      }

      const servers = await client.listServers()

      if (options.debug) {
        console.error(`[debug] ✓ Found ${servers.length} server(s)`)
      }

      if (servers.length === 0) {
        console.log(
          formatOutput(
            {
              error: 'No servers found. Make sure you are a member of at least one Discord server.',
            },
            options.pretty,
          ),
        )
        process.exit(1)
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
        token: extracted.token,
        current_server: servers[0].id,
        servers: serverMap,
      }

      await credManager.save(config)

      if (options.debug) {
        console.error(`[debug] ✓ Credentials saved`)
      }

      const output = {
        servers: servers.map((g) => `${g.id}/${g.name}`),
        current: servers[0].id,
      }

      console.log(formatOutput(output, options.pretty))
    } catch (error) {
      console.log(
        formatOutput(
          {
            error: `Token validation failed: ${(error as Error).message}`,
            hint: 'Make sure your Discord token is valid and has not expired.',
          },
          options.pretty,
        ),
      )
      process.exit(1)
    }
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
      const client = new DiscordClient(config.token)
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

export const authCommand = new Command('auth')
  .description('Authentication commands')
  .addCommand(
    new Command('extract')
      .description('Extract token from Discord desktop app')
      .option('--pretty', 'Pretty print JSON output')
      .option('--debug', 'Show debug output for troubleshooting')
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
