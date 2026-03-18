import { Command } from 'commander'

import { formatOutput } from '@/shared/utils/output'

import { getClient, getCurrentWorkspaceId } from './shared'

interface ActionOptions {
  workspace?: string
  pretty?: boolean
}

type ManagerOptions = ActionOptions & {
  limit?: string
}

interface ManagerResult {
  managers?: Array<{
    id: string
    channel_id: string
    account_id: string
    name: string
    email?: string
    role_id?: string
    removed?: boolean
    created_at?: number
  }>
  error?: string
}

export async function listAction(options: ManagerOptions = {}): Promise<ManagerResult> {
  try {
    const client = await getClient(options)
    const channelId = await getCurrentWorkspaceId(options)
    const limit = parseLimit(options.limit)
    const managers = await client.listManagers(channelId, { limit })

    return {
      managers: managers.map((manager) => ({
        id: manager.id,
        channel_id: manager.channelId,
        account_id: manager.accountId,
        name: manager.name,
        email: manager.email,
        role_id: manager.roleId,
        removed: manager.removed,
        created_at: manager.createdAt,
      })),
    }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

function parseLimit(limit?: string): number {
  const parsed = limit ? Number.parseInt(limit, 10) : 25
  if (Number.isNaN(parsed) || parsed < 1) {
    throw new Error('Invalid --limit value. Must be a positive integer.')
  }
  return parsed
}

function cliOutput(result: ManagerResult, pretty?: boolean): void {
  console.log(formatOutput(result, pretty))
  if (result.error) {
    process.exit(1)
  }
}

export function createManagerCommand(): Command {
  return new Command('manager').description('Manager commands').addCommand(
    new Command('list')
      .description('List managers in the current channel')
      .option('--limit <n>', 'Number of managers to fetch', '25')
      .option('--workspace <id>', 'Workspace ID')
      .option('--pretty', 'Pretty print JSON output')
      .action(async (opts: ManagerOptions) => {
        cliOutput(await listAction(opts), opts.pretty)
      }),
  )
}

export const managerCommand = createManagerCommand()
