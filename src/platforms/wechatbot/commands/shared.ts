import { formatOutput } from '@/shared/utils/output'

import { WeChatBotClient } from '../client'
import { WeChatBotCredentialManager } from '../credential-manager'

export interface AccountOption {
  account?: string
  pretty?: boolean
  _credManager?: WeChatBotCredentialManager
}

export async function getClient(options: AccountOption): Promise<WeChatBotClient> {
  const credManager = options._credManager ?? new WeChatBotCredentialManager()
  const creds = await credManager.getCredentials(options.account)

  if (!creds) {
    console.log(formatOutput({ error: 'No credentials. Run "auth set <app-id> <app-secret>" first.' }, options.pretty))
    process.exit(1)
  }

  return await new WeChatBotClient().login({ appId: creds.app_id, appSecret: creds.app_secret })
}
