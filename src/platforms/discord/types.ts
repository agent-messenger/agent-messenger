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

// https://discord.com/developers/docs/resources/channel#channel-object-channel-types
export const DiscordChannelType = {
  GUILD_TEXT: 0,
  DM: 1,
  GUILD_VOICE: 2,
  GROUP_DM: 3,
  GUILD_CATEGORY: 4,
  GUILD_ANNOUNCEMENT: 5,
  ANNOUNCEMENT_THREAD: 10,
  PUBLIC_THREAD: 11,
  PRIVATE_THREAD: 12,
  GUILD_STAGE_VOICE: 13,
  GUILD_DIRECTORY: 14,
  GUILD_FORUM: 15,
  GUILD_MEDIA: 16,
} as const

const THREAD_CHANNEL_TYPES: ReadonlySet<number> = new Set([
  DiscordChannelType.ANNOUNCEMENT_THREAD,
  DiscordChannelType.PUBLIC_THREAD,
  DiscordChannelType.PRIVATE_THREAD,
])

// Channels with no directly fetchable message timeline:
// forum/media messages live in child posts/threads, and directory channels
// are hub listings, not message channels. Fetching messages from these aborts.
const NON_MESSAGE_CHANNEL_TYPES: ReadonlySet<number> = new Set([
  DiscordChannelType.GUILD_FORUM,
  DiscordChannelType.GUILD_MEDIA,
  DiscordChannelType.GUILD_DIRECTORY,
])

// Voice/stage channels are listed too because they carry embedded text chat.
export function isListableChannel(channel: Pick<DiscordChannel, 'type'>): boolean {
  return channel.type !== DiscordChannelType.GUILD_CATEGORY && !THREAD_CHANNEL_TYPES.has(channel.type)
}

export function isMessageReadableChannel(channel: Pick<DiscordChannel, 'type'>): boolean {
  return isListableChannel(channel) && !NON_MESSAGE_CHANNEL_TYPES.has(channel.type)
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
  reactions?: DiscordReaction[]
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
    id?: string | null
    name: string | null
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

export interface DiscordReadState {
  channelId: string
  lastMessageId: string | null
  mentionCount: number
}

// When partial is true the entries are an incomplete slice, so an absent channel
// carries no information: it may simply have been left out of this payload.
export interface DiscordReadStateSnapshot {
  states: DiscordReadState[]
  partial: boolean
}

export interface DiscordUnreadMention extends DiscordMention {
  mention_count: number
}

export interface DiscordUnreadMentionsResult {
  mentions: DiscordUnreadMention[]
  count: number
  // Account-wide unread-mention badge total; not narrowed by guildId because
  // READY read states carry no guild association.
  badgeCount: number
  complete: boolean
  windowDays: number
}

export interface DiscordUnreadDM {
  id: string
  type: number
  name: string | null
  recipients: DiscordUser[]
  lastMessageId: string
  // Discord's own badge counter, which counts every message in a DM rather than
  // only mentions. null when the channel has no READY read-state entry (count
  // unknown); 0 when the DM is muted, since muting stops the counter but still
  // leaves the channel unread.
  unreadCount: number | null
}

// count and totalUnread describe every unread DM found, so they stay truthful when
// `channels` is capped by a limit. totalUnread sums known counts only, meaning
// channels with an unknown count contribute nothing to it. complete is false when
// Discord delivered a partial read state, in which case never-opened DMs may be
// missing from the result.
export interface DiscordUnreadDMsResult {
  channels: DiscordUnreadDM[]
  count: number
  totalUnread: number
  complete: boolean
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

export interface DiscordSearchIndexNotReadyResponse {
  message: string
  code: 110000
  documents_indexed: number
  retry_after: number
}

export type DiscordSearchApiResponse = DiscordSearchResponse | DiscordSearchIndexNotReadyResponse

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

export interface DiscordRoleColors {
  primary_color: number
  secondary_color: number | null
  tertiary_color: number | null
}

export interface DiscordRoleTags {
  bot_id?: string
  integration_id?: string
  premium_subscriber?: null
  subscription_listing_id?: string
  available_for_purchase?: null
  guild_connections?: null
}

export interface DiscordRole {
  id: string
  name: string
  /** @deprecated Discord still returns this; prefer {@link DiscordRoleColors.primary_color}. */
  color: number
  colors: DiscordRoleColors
  hoist: boolean
  position: number
  permissions: string
  managed: boolean
  mentionable: boolean
  flags: number
  icon?: string | null
  unicode_emoji?: string | null
  tags?: DiscordRoleTags
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

export const DiscordReactionSchema = z.object({
  emoji: z.object({
    id: z.string().nullish(),
    name: z.string().nullable(),
  }),
  count: z.number(),
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
  reactions: z.array(DiscordReactionSchema).optional(),
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

export const DiscordSearchIndexNotReadyResponseSchema = z.object({
  message: z.string(),
  code: z.literal(110000),
  documents_indexed: z.number(),
  retry_after: z.number().nonnegative(),
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
}

export interface DiscordGatewayGenericEvent {
  type: string
  [key: string]: unknown
}

// read_state_type 0 = channel read state (carries last_message_id); non-zero types
// carry last_acked_id instead and must be filtered out for mention correlation.
export const DiscordRawReadStateSchema = z.object({
  id: z.string(),
  read_state_type: z.number().optional(),
  last_message_id: z.string().nullish(),
  mention_count: z.number().optional(),
})

export type DiscordRawReadState = z.infer<typeof DiscordRawReadStateSchema>

// READY sends read_state as a raw array, or as { entries, version } when the
// VERSIONED_READ_STATES gateway capability is negotiated.
export const DiscordReadyReadStateSchema = z.union([
  z.array(z.unknown()),
  z.object({
    entries: z.array(z.unknown()),
    version: z.number().optional(),
    partial: z.boolean().optional(),
  }),
])

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
