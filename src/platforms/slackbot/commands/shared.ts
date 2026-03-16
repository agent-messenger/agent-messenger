import { formatOutput } from '@/shared/utils/output'

import { SlackBotClient } from '../client'
import { SlackBotCredentialManager } from '../credential-manager'

export interface BotOption {
  bot?: string
  pretty?: boolean
  _credManager?: SlackBotCredentialManager
}

export async function getClient(options: BotOption): Promise<SlackBotClient> {
  const credManager = options._credManager ?? new SlackBotCredentialManager()
  const creds = await credManager.getCredentials(options.bot)

  if (!creds) {
    console.log(formatOutput({ error: 'No credentials. Run "auth set <token>" first.' }, options.pretty))
    process.exit(1)
  }

  return new SlackBotClient(creds.token)
}
