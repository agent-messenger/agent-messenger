import { ChannelClient } from './client'
import { ChannelCredentialManager } from './credential-manager'
import { ChannelTokenExtractor } from './token-extractor'

type ChannelClientLike = Pick<ChannelClient, 'getAccount' | 'listChannels'>

let createChannelClient = (accountCookie: string, sessionCookie: string): ChannelClientLike =>
  new ChannelClient(accountCookie, sessionCookie)

export function setEnsureChannelAuthClientFactoryForTesting(
  factory: (accountCookie: string, sessionCookie: string) => ChannelClientLike,
): void {
  createChannelClient = factory
}

export function resetEnsureChannelAuthClientFactoryForTesting(): void {
  createChannelClient = (accountCookie: string, sessionCookie: string): ChannelClientLike =>
    new ChannelClient(accountCookie, sessionCookie)
}

export async function ensureChannelAuth(): Promise<void> {
  try {
    const credManager = new ChannelCredentialManager()
    const creds = await credManager.getCredentials()

    if (creds) {
      try {
        const client = createChannelClient(creds.account_cookie, creds.session_cookie)
        await client.getAccount()
        return
      } catch {
        /* stored credentials invalid, fall through to re-extraction */
      }
    }

    const extractor = new ChannelTokenExtractor()
    const extracted = await extractor.extract()
    if (!extracted) {
      return
    }

    const client = createChannelClient(extracted.accountCookie, extracted.sessionCookie)
    const account = await client.getAccount()
    const channels = await client.listChannels()
    if (channels.length === 0) {
      return
    }

    const [currentChannel, ...otherChannels] = channels

    await credManager.setCredentials({
      workspace_id: currentChannel.id,
      workspace_name: currentChannel.name,
      account_id: account.id,
      account_name: account.name,
      account_cookie: extracted.accountCookie,
      session_cookie: extracted.sessionCookie,
    })

    for (const channel of otherChannels) {
      await credManager.setCredentials({
        workspace_id: channel.id,
        workspace_name: channel.name,
        account_id: account.id,
        account_name: account.name,
        account_cookie: extracted.accountCookie,
        session_cookie: extracted.sessionCookie,
      })
    }

    await credManager.setCurrent(currentChannel.id)
  } catch {
    /* auth extraction failed silently; caller proceeds without credentials */
  }
}
