/**
 * Core type definitions for Microsoft Teams platform
 */

import { z } from 'zod'

export interface TeamsTeam {
  id: string
  name: string
  description?: string
}

export interface TeamsChannel {
  id: string
  team_id: string
  name: string
  type: string
}

export interface TeamsMessage {
  id: string
  channel_id: string
  author: {
    id: string
    displayName: string
  }
  content: string
  timestamp: string
  root_message_id?: string
  parent_message_id?: string
  is_thread_reply?: boolean
}

export interface TeamsSearchResult {
  id: string
  content: string
  author: {
    id: string
    displayName: string
  }
  channel_id: string
  thread_id?: string
  team_name?: string
  channel_name?: string
  timestamp: string
  permalink?: string
}

export interface TeamsUser {
  id: string
  displayName: string
  email?: string
  userPrincipalName?: string
}

export type TeamsChatType = 'oneOnOne' | 'group' | 'self'

export interface TeamsChat {
  id: string
  type: TeamsChatType
  topic?: string
  last_message?: string
  last_message_at?: string
}

export interface TeamsReaction {
  emoji: string
  count: number
}

export interface TeamsFile {
  id: string
  name: string
  size: number
  url: string
  contentType?: string
  sharepoint_url?: string
  object_url?: string
}

export interface TeamsCredentials {
  token: string
  cookie?: string
}

export type TeamsAccountType = 'work' | 'personal'

export type TeamsRegion = 'amer' | 'emea' | 'apac'

export type TeamsMessageFormat = 'text' | 'markdown' | 'html'

export type TeamsAuthMethod = 'device-code' | 'browser' | 'extracted' | 'manual'

export interface TeamsAccount {
  token: string
  token_expires_at?: string
  region?: TeamsRegion
  account_type: TeamsAccountType
  user_name?: string
  current_team: string | null
  teams: Record<
    string,
    {
      team_id: string
      team_name: string
    }
  >
  auth_method?: TeamsAuthMethod
  aad_refresh_token?: string
  aad_client_id?: string
  aad_tenant_id?: string
}

export interface TeamsConfig {
  current_account: string | null
  accounts: Record<string, TeamsAccount>
}

/** @deprecated Legacy single-account config format for migration */
export interface TeamsConfigLegacy {
  current_team: string | null
  token: string
  token_expires_at?: string
  teams: Record<
    string,
    {
      team_id: string
      team_name: string
    }
  >
}

// Zod validation schemas
export const TeamsTeamSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
})

export const TeamsChannelSchema = z.object({
  id: z.string(),
  team_id: z.string(),
  name: z.string(),
  type: z.string(),
})

export const TeamsMessageSchema = z.object({
  id: z.string(),
  channel_id: z.string(),
  author: z.object({
    id: z.string(),
    displayName: z.string(),
  }),
  content: z.string(),
  timestamp: z.string(),
  root_message_id: z.string().optional(),
  parent_message_id: z.string().optional(),
  is_thread_reply: z.boolean().optional(),
})

export const TeamsSearchResultSchema = z.object({
  id: z.string(),
  content: z.string(),
  author: z.object({
    id: z.string(),
    displayName: z.string(),
  }),
  channel_id: z.string(),
  thread_id: z.string().optional(),
  team_name: z.string().optional(),
  channel_name: z.string().optional(),
  timestamp: z.string(),
  permalink: z.string().optional(),
})

export const TeamsUserSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  email: z.string().optional(),
  userPrincipalName: z.string().optional(),
})

export const TeamsChatTypeSchema = z.enum(['oneOnOne', 'group', 'self'])

export const TeamsChatSchema = z.object({
  id: z.string(),
  type: TeamsChatTypeSchema,
  topic: z.string().optional(),
  last_message: z.string().optional(),
  last_message_at: z.string().optional(),
})

export const TeamsReactionSchema = z.object({
  emoji: z.string(),
  count: z.number(),
})

export const TeamsFileSchema = z.object({
  id: z.string(),
  name: z.string(),
  size: z.number(),
  url: z.string(),
  contentType: z.string().optional(),
  sharepoint_url: z.string().optional(),
  object_url: z.string().optional(),
})

export const TeamsCredentialsSchema = z.object({
  token: z.string(),
  cookie: z.string().optional(),
})

export const TeamsAccountTypeSchema = z.enum(['work', 'personal'])

export const TeamsRegionSchema = z.enum(['amer', 'emea', 'apac'])

export const TeamsAuthMethodSchema = z.enum(['device-code', 'browser', 'extracted', 'manual'])

export const TeamsAccountSchema = z.object({
  token: z.string(),
  token_expires_at: z.string().optional(),
  region: TeamsRegionSchema.optional(),
  account_type: TeamsAccountTypeSchema,
  user_name: z.string().optional(),
  current_team: z.string().nullable(),
  teams: z.record(
    z.string(),
    z.object({
      team_id: z.string(),
      team_name: z.string(),
    }),
  ),
  auth_method: TeamsAuthMethodSchema.optional(),
  aad_refresh_token: z.string().optional(),
  aad_client_id: z.string().optional(),
  aad_tenant_id: z.string().optional(),
})

export const TeamsConfigSchema = z.object({
  current_account: z.string().nullable(),
  accounts: z.record(z.string(), TeamsAccountSchema),
})

export const TeamsConfigLegacySchema = z.object({
  current_team: z.string().nullable(),
  token: z.string(),
  token_expires_at: z.string().optional(),
  teams: z.record(
    z.string(),
    z.object({
      team_id: z.string(),
      team_name: z.string(),
    }),
  ),
})

export interface TeamsMention {
  id: string
  mri?: string
  displayName: string
}

export interface TeamsRealtimeMessage {
  id: string
  chatId: string
  conversationType: 'chat' | 'channel'
  teamId?: string
  channelId?: string
  content: string
  mentions: TeamsMention[]
  author: {
    id: string
    displayName: string
  }
  messageType: string
  timestamp: string
}

export interface TeamsTrouterGenericEvent {
  resourceType: string
  [key: string]: unknown
}

export interface TeamsListenerEventMap {
  message: [message: TeamsRealtimeMessage]
  teams_event: [event: TeamsTrouterGenericEvent]
  connected: [info: { endpointId: string }]
  disconnected: []
  error: [error: Error]
}

export class TeamsError extends Error {
  code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'TeamsError'
    this.code = code
  }
}

export class TeamsAuthCapabilityError extends Error {
  constructor() {
    super(
      'Requires `agent-teams auth login` — cookie-based auth (`auth extract`) can only provide a Skype token, not the Microsoft token needed for search or SharePoint/OneDrive file downloads.',
    )
    this.name = 'TeamsAuthCapabilityError'
  }
}
