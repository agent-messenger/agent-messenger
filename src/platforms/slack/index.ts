export { SlackClient, SlackError } from './client'
export { SlackCredentialManager, CredentialManager } from './credential-manager'
export { SlackListener } from './listener'
export type {
  SlackBookmark,
  SlackChannel,
  SlackMessage,
  SlackPin,
  SlackReminder,
  SlackScheduledMessage,
  SlackUser,
  SlackUserProfile,
  SlackReaction,
  SlackFile,
  SlackSearchResult,
  SlackUnreadCounts,
  SlackThreadView,
  SlackSavedItem,
  SlackActivityItem,
  SlackDM,
  SlackDraft,
  SlackChannelSection,
  SlackRTMEvent,
  SlackRTMMessageEvent,
  SlackRTMReactionEvent,
  SlackRTMMemberEvent,
  SlackRTMChannelEvent,
  SlackRTMPresenceEvent,
  SlackRTMUserTypingEvent,
  SlackRTMGenericEvent,
  SlackListenerEventMap,
  WorkspaceCredentials,
  Config,
} from './types'
export {
  SlackChannelSchema,
  SlackReactionSchema,
  SlackFileSchema,
  SlackMessageSchema,
  SlackUserSchema,
  WorkspaceCredentialsSchema,
  ConfigSchema,
} from './types'

import { SlackClient, SlackError } from './client'
import { SlackCredentialManager } from './credential-manager'

export async function createSlackClient(): Promise<SlackClient> {
  const { ensureSlackAuth } = await import('./ensure-auth')
  await ensureSlackAuth()
  const credManager = new SlackCredentialManager()
  const workspace = await credManager.getWorkspace()
  if (!workspace) {
    throw new SlackError(
      'No workspace credentials found. Make sure Slack desktop app is installed and logged in.',
      'no_credentials',
    )
  }
  return new SlackClient(workspace.token, workspace.cookie)
}
