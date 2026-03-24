export { ChannelClient } from './client'
export { ChannelCredentialManager } from './credential-manager'
export type {
  BlockInline,
  BlockInlineAttrs,
  Channel,
  ChannelTalkChannel,
  ChannelAccount,
  ChannelBot,
  ChannelConfig,
  ChannelCredentials,
  ChannelDirectChat,
  ChannelGroup,
  ChannelManager,
  ChannelMessage,
  ChannelSearchHighlight,
  ChannelSearchHit,
  ChannelSearchResponse,
  ChannelSession,
  ChannelUserChat,
  ChannelWorkspaceEntry,
  ExtractedChannelToken,
  MessageBlock,
} from './types'
export {
  BlockInlineAttrsSchema,
  BlockInlineSchema,
  ChannelAccountSchema,
  ChannelBotSchema,
  ChannelConfigSchema,
  ChannelCredentialsSchema,
  ChannelDirectChatSchema,
  ChannelError,
  ChannelGroupSchema,
  ChannelManagerSchema,
  ChannelMessageSchema,
  ChannelSchema,
  ChannelSearchHighlightSchema,
  ChannelSearchHitSchema,
  ChannelSearchResponseSchema,
  ChannelSessionSchema,
  ChannelUserChatSchema,
  ChannelWorkspaceEntrySchema,
  ExtractedChannelTokenSchema,
  MessageBlockSchema,
} from './types'

import { ChannelClient } from './client'
import { ChannelCredentialManager } from './credential-manager'
import { ChannelError } from './types'

export async function createChannelClient(): Promise<ChannelClient> {
  const { ensureChannelAuth } = await import('./ensure-auth')
  await ensureChannelAuth()
  const credManager = new ChannelCredentialManager()
  const creds = await credManager.getCredentials()
  if (!creds) {
    throw new ChannelError(
      'No Channel Talk credentials found. Make sure Channel Talk desktop app is installed and logged in.',
      'no_credentials',
    )
  }
  return new ChannelClient(creds.account_cookie, creds.session_cookie ?? undefined)
}
