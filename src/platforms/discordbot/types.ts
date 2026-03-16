import { z } from 'zod'

export interface DiscordBotEntry {
  bot_id: string
  bot_name: string
  token: string
}

export interface DiscordBotConfig {
  current: { bot_id: string } | null
  bots: Record<string, DiscordBotEntry>
  current_server: string | null
  servers: Record<string, { server_id: string; server_name: string }>
}

export interface DiscordBotCredentials {
  token: string
  bot_id: string
  bot_name: string
  server_id?: string
  server_name?: string
}

export class DiscordBotError extends Error {
  code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'DiscordBotError'
    this.code = code
  }
}

export interface DiscordGuild {
  id: string
  name: string
  icon?: string
  owner?: boolean
}

export interface DiscordChannel {
  id: string
  guild_id: string
  name: string
  type: number
  topic?: string
  position?: number
  parent_id?: string
  thread_metadata?: {
    archived?: boolean
    auto_archive_duration?: number
    archive_timestamp?: string
    locked?: boolean
  }
}

export interface DiscordMessage {
  id: string
  channel_id: string
  author: {
    id: string
    username: string
  }
  content: string
  timestamp: string
  edited_timestamp?: string
  thread_id?: string
}

export interface DiscordUser {
  id: string
  username: string
  global_name?: string
  avatar?: string
  bot?: boolean
}

export interface DiscordReaction {
  emoji: {
    id?: string
    name: string
  }
  count: number
}

export interface DiscordFile {
  id: string
  filename: string
  size: number
  url: string
  content_type?: string
  height?: number
  width?: number
}

export const DiscordBotEntrySchema = z.object({
  bot_id: z.string(),
  bot_name: z.string(),
  token: z.string(),
})

export const DiscordBotConfigSchema = z.object({
  current: z
    .object({
      bot_id: z.string(),
    })
    .nullable(),
  bots: z.record(z.string(), DiscordBotEntrySchema),
  current_server: z.string().nullable(),
  servers: z.record(
    z.string(),
    z.object({
      server_id: z.string(),
      server_name: z.string(),
    }),
  ),
})

export const DiscordBotCredentialsSchema = z.object({
  token: z.string(),
  bot_id: z.string(),
  bot_name: z.string(),
  server_id: z.string().optional(),
  server_name: z.string().optional(),
})

export const DiscordGuildSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string().optional(),
  owner: z.boolean().optional(),
})

export const DiscordChannelSchema = z.object({
  id: z.string(),
  guild_id: z.string(),
  name: z.string(),
  type: z.number(),
  topic: z.string().optional(),
  position: z.number().optional(),
  parent_id: z.string().optional(),
  thread_metadata: z
    .object({
      archived: z.boolean().optional(),
      auto_archive_duration: z.number().optional(),
      archive_timestamp: z.string().optional(),
      locked: z.boolean().optional(),
    })
    .optional(),
})

export const DiscordMessageSchema = z.object({
  id: z.string(),
  channel_id: z.string(),
  author: z.object({
    id: z.string(),
    username: z.string(),
  }),
  content: z.string(),
  timestamp: z.string(),
  edited_timestamp: z.string().optional(),
  thread_id: z.string().optional(),
})

export const DiscordUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  global_name: z.string().optional(),
  avatar: z.string().optional(),
  bot: z.boolean().optional(),
})

export const DiscordReactionSchema = z.object({
  emoji: z.object({
    id: z.string().optional(),
    name: z.string(),
  }),
  count: z.number(),
})

export const DiscordFileSchema = z.object({
  id: z.string(),
  filename: z.string(),
  size: z.number(),
  url: z.string(),
  content_type: z.string().optional(),
  height: z.number().optional(),
  width: z.number().optional(),
})
