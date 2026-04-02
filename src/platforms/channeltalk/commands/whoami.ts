import { Command } from 'commander'

import { formatOutput } from '@/shared/utils/output'

import { getClient } from './shared'

interface ActionOptions {
  workspace?: string
  pretty?: boolean
}

interface WhoamiResult {
  account?: {
    id: string
    name: string
    email: string
    email_verified: boolean
    language: string
    country: string
    created_at: number
  }
  error?: string
}

export async function whoamiAction(options: ActionOptions = {}): Promise<WhoamiResult> {
  try {
    const client = await getClient(options)
    const account = await client.getAccount()
    return {
      account: {
        id: account.id,
        name: account.name,
        email: account.email,
        email_verified: account.emailVerified,
        language: account.language,
        country: account.country,
        created_at: account.createdAt,
      },
    }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

function cliOutput(result: WhoamiResult, pretty?: boolean): void {
  console.log(formatOutput(result, pretty))
  if (result.error) {
    process.exit(1)
  }
}

export function createWhoamiCommand(): Command {
  return new Command('whoami')
    .description('Show current authenticated user')
    .option('--workspace <id>', 'Workspace ID')
    .option('--pretty', 'Pretty print JSON output')
    .action(async (opts: ActionOptions) => {
      cliOutput(await whoamiAction(opts), opts.pretty)
    })
}

export const whoamiCommand = createWhoamiCommand()
