import { formatOutput } from '@/shared/utils/output'

import { ChannelBotClient } from '../client'
import { ChannelBotCredentialManager } from '../credential-manager'

export interface WorkspaceOption {
  workspace?: string
  bot?: string
  pretty?: boolean
  _credManager?: ChannelBotCredentialManager
}

export async function getClient(options: WorkspaceOption): Promise<ChannelBotClient> {
  const credManager = options._credManager ?? new ChannelBotCredentialManager()
  const creds = await credManager.getCredentials(options.workspace)

  if (!creds) {
    console.log(
      formatOutput({ error: 'No credentials. Run "auth set <access-key> <access-secret>" first.' }, options.pretty),
    )
    process.exit(1)
  }

  return new ChannelBotClient().login({ accessKey: creds.access_key, accessSecret: creds.access_secret })
}

export async function getCurrentWorkspace(options: WorkspaceOption): Promise<string> {
  if (options.workspace) return options.workspace

  const credManager = options._credManager ?? new ChannelBotCredentialManager()
  const creds = await credManager.getCredentials()

  if (!creds) {
    console.log(
      formatOutput({ error: 'No workspace set. Run "auth set <access-key> <access-secret>" first.' }, options.pretty),
    )
    process.exit(1)
  }

  return creds.workspace_id
}

export async function getDefaultBotName(options: WorkspaceOption): Promise<string | undefined> {
  if (options.bot) return options.bot

  const credManager = options._credManager ?? new ChannelBotCredentialManager()
  const defaultBot = await credManager.getDefaultBot()
  return defaultBot ?? undefined
}
