import { Command } from 'commander'

import { cliOutput } from '@/shared/utils/cli-output'

import type { BotOption } from './shared'
import { getClient } from './shared'

interface WhoamiResult {
  id?: string
  username?: string
  global_name?: string
  avatar?: string
  bot?: boolean
  error?: string
}

export async function whoamiAction(options: BotOption): Promise<WhoamiResult> {
  try {
    const client = await getClient(options)
    const info = await client.testAuth()
    return {
      id: info.id,
      username: info.username,
      global_name: info.global_name,
      avatar: info.avatar,
      bot: info.bot,
    }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export const whoamiCommand = new Command('whoami')
  .description('Show current authenticated bot')
  .option('--bot <id>', 'Bot ID to use')
  .option('--pretty', 'Pretty print JSON output')
  .action(async (opts: BotOption) => {
    cliOutput(await whoamiAction(opts), opts.pretty)
  })
