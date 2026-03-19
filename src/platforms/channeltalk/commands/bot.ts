import { Command } from 'commander'

import { formatOutput } from '@/shared/utils/output'

import { getClient, getCurrentWorkspaceId } from './shared'

interface ActionOptions {
  workspace?: string
  pretty?: boolean
}

type BotOptions = ActionOptions & {
  limit?: string
}

interface BotResult {
  bots?: Array<{
    id: string
    channel_id: string
    name: string
    avatar_url?: string
  }>
  error?: string
}

export async function listAction(options: BotOptions = {}): Promise<BotResult> {
  try {
    const client = await getClient(options)
    const channelId = await getCurrentWorkspaceId(options)
    const limit = parseLimit(options.limit)
    const bots = await client.listBots(channelId, { limit })

    return {
      bots: bots.map((bot) => ({
        id: bot.id,
        channel_id: bot.channelId,
        name: bot.name,
        avatar_url: bot.avatarUrl,
      })),
    }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

function parseLimit(limit?: string): number {
  const parsed = limit ? Number(limit) : 25
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error('Invalid --limit value. Must be a positive integer.')
  }
  return parsed
}

function cliOutput(result: BotResult, pretty?: boolean): void {
  console.log(formatOutput(result, pretty))
  if (result.error) {
    process.exit(1)
  }
}

export function createBotCommand(): Command {
  return new Command('bot').description('Bot commands').addCommand(
    new Command('list')
      .description('List bots in the current channel')
      .option('--limit <n>', 'Number of bots to fetch', '25')
      .option('--workspace <id>', 'Workspace ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (opts: BotOptions) => {
        cliOutput(await listAction(opts), opts.pretty)
      }),
  )
}

export const botCommand = createBotCommand()
