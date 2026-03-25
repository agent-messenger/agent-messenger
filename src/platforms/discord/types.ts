/**
 * Core type definitions for Discord platform
 */

import { z } from 'zod'

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

export interface DiscordDMChannel {
  id: string
  type: number // 1=DM, 3=Group DM
  last_message_id?: string
  recipients: DiscordUser[]
  name?: string // Only for group DMs
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

export interface DiscordMention {
  id: string
  channel_id: string
  author: { id: string; username: string }
  content: string
  timestamp: string
  mention_everyone: boolean
  mentions: DiscordUser[]
  guild_id?: string
}

export interface DiscordUserNote {
  user_id: string
  note_user_id: string
  note: string
}

export interface DiscordSearchResult {
  id: string
  channel_id: string
  guild_id?: string
  content: string
  author: {
    id: string
    username: string
  }
  timestamp: string
  hit: boolean
}

export interface DiscordSearchResponse {
  total_results: number
  messages: DiscordSearchResult[][]
}

export interface DiscordSearchOptions {
  channelId?: string
  authorId?: string
  has?: 'file' | 'image' | 'video' | 'embed' | 'link' | 'sticker'
  sortBy?: 'timestamp' | 'relevance'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export interface DiscordRelationship {
  id: string
  type: number
  user: DiscordUser
  nickname?: string
}

export interface DiscordGuildMember {
  user: DiscordUser
  nick?: string
  roles: string[]
  joined_at: string
  deaf: boolean
  mute: boolean
  flags: number
}

export interface DiscordUserProfile {
  user: DiscordUser & { bio?: string }
  connected_accounts: Array<{
    type: string
    id: string
    name: string
    verified: boolean
  }>
  premium_since?: string
  mutual_guilds?: Array<{ id: string; nick?: string }>
}

export interface DiscordCredentials {
  token: string
}

export interface DiscordConfig {
  current_server: string | null
  token: string
  servers: Record<
    string,
    {
      server_id: string
      server_name: string
    }
  >
}

// Zod validation schemas
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

export const DiscordDMChannelSchema = z.object({
  id: z.string(),
  type: z.number(),
  last_message_id: z.string().optional(),
  recipients: z.array(DiscordUserSchema),
  name: z.string().optional(),
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

export const DiscordMentionSchema = z.object({
  id: z.string(),
  channel_id: z.string(),
  author: z.object({
    id: z.string(),
    username: z.string(),
  }),
  content: z.string(),
  timestamp: z.string(),
  mention_everyone: z.boolean(),
  mentions: z.array(DiscordUserSchema),
  guild_id: z.string().optional(),
})

export const DiscordRelationshipSchema = z.object({
  id: z.string(),
  type: z.number(),
  user: DiscordUserSchema,
  nickname: z.string().optional(),
})

export const DiscordSearchResultSchema = z.object({
  id: z.string(),
  channel_id: z.string(),
  guild_id: z.string().optional(),
  content: z.string(),
  author: z.object({
    id: z.string(),
    username: z.string(),
  }),
  timestamp: z.string(),
  hit: z.boolean(),
})

export const DiscordSearchResponseSchema = z.object({
  total_results: z.number(),
  messages: z.array(z.array(DiscordSearchResultSchema)),
})

export const DiscordCredentialsSchema = z.object({
  token: z.string(),
})

export const DiscordConfigSchema = z.object({
  current_server: z.string().nullable(),
  token: z.string(),
  servers: z.record(
    z.string(),
    z.object({
      server_id: z.string(),
      server_name: z.string(),
    }),
  ),
})

// Gateway opcodes
export const DiscordGatewayOpcode = {
  Dispatch: 0,
  Heartbeat: 1,
  Identify: 2,
  PresenceUpdate: 3,
  VoiceStateUpdate: 4,
  Resume: 6,
  Reconnect: 7,
  RequestGuildMembers: 8,
  InvalidSession: 9,
  Hello: 10,
  HeartbeatACK: 11,
} as const

// Gateway intents (bitfield values)
export const DiscordIntent = {
  Guilds: 1 << 0,
  GuildMembers: 1 << 1, // privileged
  GuildModeration: 1 << 2,
  GuildPresences: 1 << 8, // privileged
  GuildMessages: 1 << 9,
  GuildMessageReactions: 1 << 10,
  GuildMessageTyping: 1 << 11,
  DirectMessages: 1 << 12,
  DirectMessageReactions: 1 << 13,
  DirectMessageTyping: 1 << 14,
  MessageContent: 1 << 15, // privileged
} as const

// Gateway dispatch event payloads
export interface DiscordGatewayMessageCreateEvent {
  type: 'MESSAGE_CREATE'
  id: string
  channel_id: string
  guild_id?: string
  author: { id: string; username: string }
  content: string
  timestamp: string
  edited_timestamp?: string
  mentions?: DiscordUser[]
  attachments?: DiscordFile[]
}

export interface DiscordGatewayMessageUpdateEvent {
  type: 'MESSAGE_UPDATE'
  id: string
  channel_id: string
  guild_id?: string
  content?: string
  edited_timestamp?: string
}

export interface DiscordGatewayMessageDeleteEvent {
  type: 'MESSAGE_DELETE'
  id: string
  channel_id: string
  guild_id?: string
}

export interface DiscordGatewayReactionEvent {
  type: 'MESSAGE_REACTION_ADD' | 'MESSAGE_REACTION_REMOVE'
  user_id: string
  channel_id: string
  message_id: string
  guild_id?: string
  emoji: { id?: string; name: string }
}

export interface DiscordGatewayMemberEvent {
  type: 'GUILD_MEMBER_ADD' | 'GUILD_MEMBER_REMOVE'
  guild_id: string
  user: { id: string; username: string }
}

export interface DiscordGatewayPresenceEvent {
  type: 'PRESENCE_UPDATE'
  user: { id: string }
  guild_id: string
  status: 'online' | 'idle' | 'dnd' | 'offline'
  activities?: Array<{ name: string; type: number }>
}

export interface DiscordGatewayTypingEvent {
  type: 'TYPING_START'
  user_id: string
  channel_id: string
  guild_id?: string
  timestamp: number
}

export interface DiscordGatewayChannelEvent {
  type: 'CHANNEL_CREATE' | 'CHANNEL_UPDATE' | 'CHANNEL_DELETE'
  id: string
  guild_id?: string
  name?: string
  channel_type: number
}

export interface DiscordGatewayGenericEvent {
  type: string
  [key: string]: unknown
}

export type DiscordGatewayEvent =
  | DiscordGatewayMessageCreateEvent
  | DiscordGatewayMessageUpdateEvent
  | DiscordGatewayMessageDeleteEvent
  | DiscordGatewayReactionEvent
  | DiscordGatewayMemberEvent
  | DiscordGatewayPresenceEvent
  | DiscordGatewayTypingEvent
  | DiscordGatewayChannelEvent
  | DiscordGatewayGenericEvent

export interface DiscordListenerEventMap {
  message_create: [event: DiscordGatewayMessageCreateEvent]
  message_update: [event: DiscordGatewayMessageUpdateEvent]
  message_delete: [event: DiscordGatewayMessageDeleteEvent]
  message_reaction_add: [event: DiscordGatewayReactionEvent]
  message_reaction_remove: [event: DiscordGatewayReactionEvent]
  guild_member_add: [event: DiscordGatewayMemberEvent]
  guild_member_remove: [event: DiscordGatewayMemberEvent]
  presence_update: [event: DiscordGatewayPresenceEvent]
  typing_start: [event: DiscordGatewayTypingEvent]
  channel_create: [event: DiscordGatewayChannelEvent]
  channel_update: [event: DiscordGatewayChannelEvent]
  channel_delete: [event: DiscordGatewayChannelEvent]
  discord_event: [event: DiscordGatewayGenericEvent]
  connected: [info: { user: { id: string; username: string }; sessionId: string }]
  disconnected: []
  error: [error: Error]
}

export class DiscordError extends Error {
  code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'DiscordError'
    this.code = code
  }
}
