import { Command } from 'commander'

import { cliOutput } from '@/shared/utils/cli-output'

import { WhatsAppBotClient } from '../client'
import { WhatsAppBotCredentialManager } from '../credential-manager'

interface WhoamiOptions {
  account?: string
  pretty?: boolean
  _credManager?: WhatsAppBotCredentialManager
}

interface WhoamiResult {
  phone_number_id?: string | null
  account_name?: string | null
  verified_name?: string
  error?: string
}

export async function whoamiAction(options: WhoamiOptions): Promise<WhoamiResult> {
  try {
    const credManager = options._credManager ?? new WhatsAppBotCredentialManager()
    const creds = await credManager.getCredentials(options.account)

    if (!creds) {
      return { error: 'No credentials. Run "auth set <phone-number-id> <access-token>" first.' }
    }

    const client = await new WhatsAppBotClient().login({
      phoneNumberId: creds.phone_number_id,
      accessToken: creds.access_token,
    })
    const verified = await client.verifyToken()

    return {
      phone_number_id: creds.phone_number_id,
      account_name: creds.account_name ?? null,
      verified_name: verified.verified_name,
    }
  } catch (error) {
    return { error: (error as Error).message }
  }
}

export const whoamiCommand = new Command('whoami')
  .description('Show current authenticated bot')
  .option('--account <id>', 'Account ID to use')
  .option('--pretty', 'Pretty print JSON output')
  .action(async (opts: WhoamiOptions) => {
    cliOutput(await whoamiAction(opts), opts.pretty)
  })
