import { formatOutput } from '@/shared/utils/output'

import { InstagramBotClient } from '../client'
import { InstagramBotCredentialManager } from '../credential-manager'

export interface WorkspaceOption {
  workspace?: string
  pretty?: boolean
  _credManager?: InstagramBotCredentialManager
}

export async function getClient(options: WorkspaceOption): Promise<InstagramBotClient> {
  const credManager = options._credManager ?? new InstagramBotCredentialManager()
  const creds = await credManager.getCredentials(options.workspace)

  if (!creds) {
    console.log(formatOutput({ error: 'No credentials. Run "auth set <page-id> <access-token>" first.' }, options.pretty))
    process.exit(1)
  }

  return new InstagramBotClient(creds.page_id, creds.access_token)
}
