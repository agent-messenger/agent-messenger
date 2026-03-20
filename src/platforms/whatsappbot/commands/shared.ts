import { formatOutput } from '@/shared/utils/output'

import { WhatsAppBotClient } from '../client'
import { WhatsAppBotCredentialManager } from '../credential-manager'

export interface WorkspaceOption {
  workspace?: string
  pretty?: boolean
  _credManager?: WhatsAppBotCredentialManager
}

export async function getClient(options: WorkspaceOption): Promise<WhatsAppBotClient> {
  const credManager = options._credManager ?? new WhatsAppBotCredentialManager()
  const creds = await credManager.getCredentials(options.workspace)

  if (!creds) {
    console.log(
      formatOutput(
        { error: 'No credentials. Run "auth set <phone-number-id> <access-token>" first.' },
        options.pretty,
      ),
    )
    process.exit(1)
  }

  return new WhatsAppBotClient(creds.phone_number_id, creds.access_token)
}
