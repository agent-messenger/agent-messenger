import { ChannelClient } from './client'
import { ChannelCredentialManager } from './credential-manager'
import { ChannelTokenExtractor } from './token-extractor'

type ChannelClientLike = Pick<ChannelClient, 'getAccount' | 'listChannels'>
type ChannelCredentialManagerLike = Pick<
  ChannelCredentialManager,
  'getCredentials' | 'setCredentials' | 'setCurrent'
>
type ChannelTokenExtractorLike = Pick<ChannelTokenExtractor, 'extract'>

let createChannelClient: (accountCookie: string, sessionCookie?: string) => ChannelClientLike | Promise<ChannelClientLike> = async (
  accountCookie: string,
  sessionCookie?: string,
): Promise<ChannelClientLike> => new ChannelClient().login({ accountCookie, sessionCookie })
let createCredentialManager = (): ChannelCredentialManagerLike => new ChannelCredentialManager()
let createTokenExtractor = (): ChannelTokenExtractorLike => new ChannelTokenExtractor()

export function setEnsureChannelAuthDependenciesForTesting(deps: {
  createClient?: (accountCookie: string, sessionCookie?: string) => ChannelClientLike | Promise<ChannelClientLike>
  createCredentialManager?: () => ChannelCredentialManagerLike
  createTokenExtractor?: () => ChannelTokenExtractorLike
}): void {
  if (deps.createClient) createChannelClient = deps.createClient
  if (deps.createCredentialManager) createCredentialManager = deps.createCredentialManager
  if (deps.createTokenExtractor) createTokenExtractor = deps.createTokenExtractor
}

export function resetEnsureChannelAuthDependenciesForTesting(): void {
  createChannelClient = async (accountCookie: string, sessionCookie?: string): Promise<ChannelClientLike> =>
    new ChannelClient().login({ accountCookie, sessionCookie })
  createCredentialManager = () => new ChannelCredentialManager()
  createTokenExtractor = () => new ChannelTokenExtractor()
}

// Keep old API for backward compatibility
export const setEnsureChannelAuthClientFactoryForTesting = (
  factory: (accountCookie: string, sessionCookie?: string) => ChannelClientLike | Promise<ChannelClientLike>,
): void => setEnsureChannelAuthDependenciesForTesting({ createClient: factory })

export const resetEnsureChannelAuthClientFactoryForTesting = (): void =>
  resetEnsureChannelAuthDependenciesForTesting()

export async function ensureChannelAuth(): Promise<void> {
  try {
    const credManager = createCredentialManager()
    const creds = await credManager.getCredentials()

    if (creds) {
      try {
        const client = await createChannelClient(creds.account_cookie, creds.session_cookie ?? undefined)
        await client.getAccount()
        return
      } catch {
        /* stored credentials invalid, fall through to re-extraction */
      }
    }

    const extractor = createTokenExtractor()
    const extracted = await extractor.extract()
    if (!extracted) {
      return
    }

    const client = await createChannelClient(extracted.accountCookie, extracted.sessionCookie)
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
