export { ChannelBotClient } from './client'
export { ChannelBotCredentialManager } from './credential-manager'
export type {
  ChannelBotBot,
  ChannelBotChannel,
  ChannelBotConfig,
  ChannelBotCredentials,
  ChannelBotGroup,
  ChannelBotManager,
  ChannelBotMessage,
  ChannelBotUser,
  ChannelBotUserChat,
  ChannelBotWorkspaceEntry,
  MessageBlock,
} from './types'
export {
  ChannelBotBotSchema,
  ChannelBotChannelSchema,
  ChannelBotConfigSchema,
  ChannelBotCredentialsSchema,
  ChannelBotError,
  ChannelBotGroupSchema,
  ChannelBotManagerSchema,
  ChannelBotMessageSchema,
  ChannelBotUserChatSchema,
  ChannelBotUserSchema,
  ChannelBotWorkspaceEntrySchema,
  MessageBlockSchema,
} from './types'

import { ChannelBotClient } from './client'
import { ChannelBotCredentialManager } from './credential-manager'
import { ChannelBotError } from './types'

export async function createChannelBotClient(): Promise<ChannelBotClient> {
  const credManager = new ChannelBotCredentialManager()
  const creds = await credManager.getCredentials()
  if (!creds) {
    throw new ChannelBotError(
      'No Channel Talk Bot credentials found. Set access key and secret via "agent-channeltalkbot auth set".',
      'no_credentials',
    )
  }
  return new ChannelBotClient(creds.access_key, creds.access_secret)
}
