import { ChannelClient } from '../client'
import { ChannelCredentialManager } from '../credential-manager'

interface SharedOptions {
  workspace?: string
  _credManager?: ChannelCredentialManager
}

export async function getClient(options: SharedOptions = {}): Promise<ChannelClient> {
  const credManager = options._credManager ?? new ChannelCredentialManager()
  const creds = await credManager.getCredentials(options.workspace)

  if (!creds) {
    throw new Error('No credentials. Run "agent-channeltalk auth extract" first.')
  }

  return new ChannelClient().login({ accountCookie: creds.account_cookie, sessionCookie: creds.session_cookie })
}

export async function getCurrentWorkspaceId(options: SharedOptions = {}): Promise<string> {
  const credManager = options._credManager ?? new ChannelCredentialManager()
  const creds = await credManager.getCredentials(options.workspace)

  if (!creds) {
    throw new Error('No credentials. Run "agent-channeltalk auth extract" first.')
  }

  return creds.workspace_id
}
