export { TeamsClient } from './client'
export { TeamsCredentialManager } from './credential-manager'
export { TeamsError } from './types'
export type {
  TeamsAccount,
  TeamsAccountType,
  TeamsChannel,
  TeamsConfig,
  TeamsConfigLegacy,
  TeamsCredentials,
  TeamsFile,
  TeamsMessage,
  TeamsReaction,
  TeamsTeam,
  TeamsUser,
} from './types'
export {
  TeamsAccountSchema,
  TeamsAccountTypeSchema,
  TeamsChannelSchema,
  TeamsConfigLegacySchema,
  TeamsConfigSchema,
  TeamsCredentialsSchema,
  TeamsFileSchema,
  TeamsMessageSchema,
  TeamsReactionSchema,
  TeamsTeamSchema,
  TeamsUserSchema,
} from './types'

import { TeamsClient } from './client'
import { TeamsCredentialManager } from './credential-manager'
import { TeamsError } from './types'

export async function createTeamsClient(): Promise<TeamsClient> {
  const { ensureTeamsAuth } = await import('./ensure-auth')
  await ensureTeamsAuth()
  const credManager = new TeamsCredentialManager()
  const creds = await credManager.getTokenWithExpiry()
  if (!creds) {
    throw new TeamsError(
      'No Teams credentials found. Make sure Microsoft Teams desktop app is installed and logged in.',
      'no_credentials',
    )
  }
  return new TeamsClient(creds.token, creds.tokenExpiresAt)
}
