import { Command } from 'commander'

import { cliOutput } from '@/shared/utils/cli-output'

import type { BotOption } from './shared'
import { getClient } from './shared'

interface WhoamiResult {
  user_id?: string
  team_id?: string
  bot_id?: string
  user?: string
  team?: string
  error?: string
}

export async function whoamiAction(options: BotOption): Promise<WhoamiResult> {
  try {
    const client = await getClient(options)
    const info = await client.testAuth()
    return {
      user_id: info.user_id,
      team_id: info.team_id,
      bot_id: info.bot_id,
      user: info.user,
      team: info.team,
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
