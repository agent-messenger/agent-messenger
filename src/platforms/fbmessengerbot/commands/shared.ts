import { formatOutput } from '@/shared/utils/output'

import { FBMessengerBotClient } from '../client'
import { FBMessengerBotCredentialManager } from '../credential-manager'

export interface WorkspaceOption {
  workspace?: string
  pretty?: boolean
  _credManager?: FBMessengerBotCredentialManager
}

export async function getClient(options: WorkspaceOption): Promise<FBMessengerBotClient> {
  const credManager = options._credManager ?? new FBMessengerBotCredentialManager()
  const creds = await credManager.getCredentials(options.workspace)

  if (!creds) {
    console.log(formatOutput({ error: 'No credentials. Run "auth set <page-id> <access-token>" first.' }, options.pretty))
    process.exit(1)
  }

  return new FBMessengerBotClient(creds.page_id, creds.access_token)
}
