import { formatOutput } from '@/shared/utils/output'

import { LineBotClient } from '../client'
import { LineBotCredentialManager } from '../credential-manager'

export interface WorkspaceOption {
  workspace?: string
  pretty?: boolean
  _credManager?: LineBotCredentialManager
}

export async function getClient(options: WorkspaceOption): Promise<LineBotClient> {
  const credManager = options._credManager ?? new LineBotCredentialManager()
  const creds = await credManager.getCredentials(options.workspace)

  if (!creds) {
    console.log(
      formatOutput(
        { error: 'No credentials. Run "auth set <channel-access-token>" first.' },
        options.pretty,
      ),
    )
    process.exit(1)
  }

  return new LineBotClient(creds.channel_access_token)
}
