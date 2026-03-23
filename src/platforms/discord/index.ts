export { DiscordClient, DiscordError } from './client'
export { DiscordCredentialManager } from './credential-manager'
export type {
  DiscordChannel,
  DiscordConfig,
  DiscordCredentials,
  DiscordDMChannel,
  DiscordFile,
  DiscordGuild,
  DiscordGuildMember,
  DiscordMention,
  DiscordMessage,
  DiscordReaction,
  DiscordRelationship,
  DiscordSearchOptions,
  DiscordSearchResponse,
  DiscordSearchResult,
  DiscordUser,
  DiscordUserNote,
  DiscordUserProfile,
} from './types'
export {
  DiscordChannelSchema,
  DiscordConfigSchema,
  DiscordCredentialsSchema,
  DiscordDMChannelSchema,
  DiscordFileSchema,
  DiscordGuildSchema,
  DiscordMentionSchema,
  DiscordMessageSchema,
  DiscordReactionSchema,
  DiscordRelationshipSchema,
  DiscordSearchResponseSchema,
  DiscordSearchResultSchema,
  DiscordUserSchema,
} from './types'

import { DiscordClient, DiscordError } from './client'
import { DiscordCredentialManager } from './credential-manager'

export async function createDiscordClient(): Promise<DiscordClient> {
  const { ensureDiscordAuth } = await import('./ensure-auth')
  await ensureDiscordAuth()
  const credManager = new DiscordCredentialManager()
  const token = await credManager.getToken()
  if (!token) {
    throw new DiscordError(
      'No Discord credentials found. Make sure Discord desktop app is installed and logged in.',
      'no_credentials',
    )
  }
  return new DiscordClient(token)
}
