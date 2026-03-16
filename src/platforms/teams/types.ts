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
}

export interface TeamsUser {
  id: string
  displayName: string
  email?: string
  userPrincipalName?: string
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
}

export interface TeamsCredentials {
  token: string
  cookie?: string
}

export type TeamsAccountType = 'work' | 'personal'

export interface TeamsAccount {
  token: string
  token_expires_at?: string
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
})

export const TeamsUserSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  email: z.string().optional(),
  userPrincipalName: z.string().optional(),
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
})

export const TeamsCredentialsSchema = z.object({
  token: z.string(),
  cookie: z.string().optional(),
})

export const TeamsAccountTypeSchema = z.enum(['work', 'personal'])

export const TeamsAccountSchema = z.object({
  token: z.string(),
  token_expires_at: z.string().optional(),
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

export class TeamsError extends Error {
  code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'TeamsError'
    this.code = code
  }
}
