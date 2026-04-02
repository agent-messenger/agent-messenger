import { Command } from 'commander'

import { formatOutput } from '@/shared/utils/output'

import { WeChatBotCredentialManager } from '../credential-manager'
import type { AccountOption } from './shared'
import { getClient } from './shared'

interface WhoamiResult {
  app_id?: string | null
  account_name?: string | null
  verified?: boolean
  error?: string
}

export async function whoamiAction(options: AccountOption): Promise<WhoamiResult> {
  try {
    const client = await getClient(options)
    const verified = await client.verifyCredentials()
    const credManager = options._credManager ?? new WeChatBotCredentialManager()
    const creds = await credManager.getCredentials(options.account)
    return {
      app_id: creds?.app_id ?? null,
      account_name: creds?.account_name ?? null,
      verified,
    }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

function cliOutput(result: WhoamiResult, pretty?: boolean): void {
  console.log(formatOutput(result, pretty))
  if (result.error) process.exit(1)
}

export const whoamiCommand = new Command('whoami')
  .description('Show current authenticated bot')
  .option('--account <id>', 'Account ID to use')
  .option('--pretty', 'Pretty print JSON output')
  .action(async (opts: AccountOption) => {
    cliOutput(await whoamiAction(opts), opts.pretty)
  })
