import { formatOutput } from '@/shared/utils/output'

import { DiscordBotClient } from '../client'
import { DiscordBotCredentialManager } from '../credential-manager'

export interface BotOption {
  bot?: string
  server?: string
  pretty?: boolean
  _credManager?: DiscordBotCredentialManager
}

export async function getClient(options: BotOption): Promise<DiscordBotClient> {
  const credManager = options._credManager ?? new DiscordBotCredentialManager()
  const creds = await credManager.getCredentials(options.bot)

  if (!creds) {
    console.log(formatOutput({ error: 'No credentials. Run "auth set <token>" first.' }, options.pretty))
    process.exit(1)
  }

  return new DiscordBotClient(creds.token)
}

export async function getCurrentServer(options: BotOption): Promise<string> {
  if (options.server) return options.server

  const credManager = options._credManager ?? new DiscordBotCredentialManager()
  const serverId = await credManager.getCurrentServer()

  if (!serverId) {
    console.log(formatOutput({ error: 'No server set. Run "server switch <server-id>" first.' }, options.pretty))
    process.exit(1)
  }

  return serverId
}
