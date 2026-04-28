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

export const DiscordIntent = {
  Guilds: 1 << 0,
  GuildMembers: 1 << 1, // privileged
  GuildModeration: 1 << 2,
  GuildEmojisAndStickers: 1 << 3,
  GuildIntegrations: 1 << 4,
  GuildWebhooks: 1 << 5,
  GuildInvites: 1 << 6,
  GuildVoiceStates: 1 << 7,
  GuildPresences: 1 << 8, // privileged
  GuildMessages: 1 << 9,
  GuildMessageReactions: 1 << 10,
  GuildMessageTyping: 1 << 11,
  DirectMessages: 1 << 12,
  DirectMessageReactions: 1 << 13,
  DirectMessageTyping: 1 << 14,
  MessageContent: 1 << 15, // privileged
  GuildScheduledEvents: 1 << 16,
  AutoModerationConfiguration: 1 << 20,
  AutoModerationExecution: 1 << 21,
} as const

export interface DiscordGatewayMessageCreateEvent {
  type: 'MESSAGE_CREATE'
  id: string
  channel_id: string
  guild_id?: string
  author: { id: string; username: string; bot?: boolean }
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

export interface DiscordGatewayTypingEvent {
  type: 'TYPING_START'
  user_id: string
  channel_id: string
  guild_id?: string
  timestamp: number
}

export interface DiscordGatewayPresenceEvent {
  type: 'PRESENCE_UPDATE'
  user: { id: string }
  guild_id: string
  status: 'online' | 'idle' | 'dnd' | 'offline'
  activities?: Array<{ name: string; type: number }>
}

export interface DiscordGatewayChannelEvent {
  type: 'CHANNEL_CREATE' | 'CHANNEL_UPDATE' | 'CHANNEL_DELETE'
  id: string
  guild_id?: string
  name?: string
}

export interface DiscordGatewayGuildEvent {
  type: 'GUILD_CREATE' | 'GUILD_UPDATE' | 'GUILD_DELETE'
  id: string
  name?: string
  unavailable?: boolean
}

export interface DiscordGatewayInteractionEvent {
  type: 'INTERACTION_CREATE'
  id: string
  application_id: string
  token: string
  data?: Record<string, unknown>
  channel_id?: string
  guild_id?: string
  member?: Record<string, unknown>
  user?: { id: string; username: string }
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
  | DiscordGatewayTypingEvent
  | DiscordGatewayPresenceEvent
  | DiscordGatewayChannelEvent
  | DiscordGatewayGuildEvent
  | DiscordGatewayInteractionEvent
  | DiscordGatewayGenericEvent

export interface DiscordBotListenerEventMap {
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
  guild_create: [event: DiscordGatewayGuildEvent]
  guild_update: [event: DiscordGatewayGuildEvent]
  guild_delete: [event: DiscordGatewayGuildEvent]
  interaction_create: [event: DiscordGatewayInteractionEvent]
  discord_event: [event: DiscordGatewayGenericEvent]
  connected: [info: { user: { id: string; username: string }; sessionId: string }]
  disconnected: []
  error: [error: Error]
}
