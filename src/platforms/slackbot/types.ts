import { z } from 'zod'

// SlackBot-specific types (NO cookie - bot tokens don't use cookies)

export interface SlackBotCredentials {
  token: string
  workspace_id: string
  workspace_name: string
  bot_id: string
  bot_name: string
}

export interface SlackBotEntry {
  bot_id: string
  bot_name: string
  token: string
}

export interface SlackBotWorkspace {
  workspace_id: string
  workspace_name: string
  bots: Record<string, SlackBotEntry>
}

export interface SlackBotConfig {
  current: { workspace_id: string; bot_id: string } | null
  workspaces: Record<string, SlackBotWorkspace>
}

// Error class for SlackBot operations
export class SlackBotError extends Error {
  code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'SlackBotError'
    this.code = code
  }
}

// Shared types (same structure as slack platform, kept local for independence)
export interface SlackChannel {
  id: string
  name: string
  is_private: boolean
  is_archived: boolean
  created: number
  creator: string
  topic?: {
    value: string
    creator: string
    last_set: number
  }
  purpose?: {
    value: string
    creator: string
    last_set: number
  }
}

export interface SlackMessage {
  ts: string
  text: string
  user?: string
  username?: string
  type: string
  thread_ts?: string
  reply_count?: number
  replies?: Array<{ user: string; ts: string }>
  edited?: {
    user: string
    ts: string
  }
  files?: SlackFile[]
}

export interface SlackUser {
  id: string
  name: string
  real_name: string
  is_admin: boolean
  is_owner: boolean
  is_bot: boolean
  is_app_user: boolean
  profile?: {
    email?: string
    phone?: string
    title?: string
    status_text?: string
  }
}

export interface SlackReaction {
  name: string
  count: number
  users: string[]
}

export interface SlackFile {
  id: string
  name: string
  title: string
  mimetype: string
  size: number
  url_private: string
  created: number
  user: string
  channels?: string[]
}

// Zod validation schemas
export const SlackBotEntrySchema = z.object({
  bot_id: z.string(),
  bot_name: z.string(),
  token: z.string().startsWith('xoxb-', 'Token must be a bot token (xoxb-)'),
})

export const SlackBotWorkspaceSchema = z.object({
  workspace_id: z.string(),
  workspace_name: z.string(),
  bots: z.record(z.string(), SlackBotEntrySchema),
})

export const SlackBotCredentialsSchema = z.object({
  token: z.string().startsWith('xoxb-', 'Token must be a bot token (xoxb-)'),
  workspace_id: z.string(),
  workspace_name: z.string(),
  bot_id: z.string(),
  bot_name: z.string(),
})

export const SlackBotConfigSchema = z.object({
  current: z
    .object({
      workspace_id: z.string(),
      bot_id: z.string(),
    })
    .nullable(),
  workspaces: z.record(z.string(), SlackBotWorkspaceSchema),
})

export const SlackChannelSchema = z.object({
  id: z.string(),
  name: z.string(),
  is_private: z.boolean(),
  is_archived: z.boolean(),
  created: z.number(),
  creator: z.string(),
  topic: z
    .object({
      value: z.string(),
      creator: z.string(),
      last_set: z.number(),
    })
    .optional(),
  purpose: z
    .object({
      value: z.string(),
      creator: z.string(),
      last_set: z.number(),
    })
    .optional(),
})

export const SlackMessageSchema = z.object({
  ts: z.string(),
  text: z.string(),
  user: z.string().optional(),
  username: z.string().optional(),
  type: z.string(),
  thread_ts: z.string().optional(),
  reply_count: z.number().optional(),
  replies: z
    .array(
      z.object({
        user: z.string(),
        ts: z.string(),
      }),
    )
    .optional(),
  edited: z
    .object({
      user: z.string(),
      ts: z.string(),
    })
    .optional(),
})

export const SlackUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  real_name: z.string(),
  is_admin: z.boolean(),
  is_owner: z.boolean(),
  is_bot: z.boolean(),
  is_app_user: z.boolean(),
  profile: z
    .object({
      email: z.string().optional(),
      phone: z.string().optional(),
      title: z.string().optional(),
      status_text: z.string().optional(),
    })
    .optional(),
})

export const SlackReactionSchema = z.object({
  name: z.string(),
  count: z.number(),
  users: z.array(z.string()),
})

export const SlackFileSchema = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string(),
  mimetype: z.string(),
  size: z.number(),
  url_private: z.string(),
  created: z.number(),
  user: z.string(),
  channels: z.array(z.string()).optional(),
})

// Socket Mode envelope types — see https://api.slack.com/apis/socket-mode

export interface SlackSocketModeHelloEnvelope {
  type: 'hello'
  connection_info?: { app_id: string }
  num_connections?: number
  debug_info?: {
    host?: string
    started?: string
    build_number?: number
    approximate_connection_time?: number
  }
}

export type SlackSocketModeDisconnectReason = 'warning' | 'refresh_requested' | 'link_disabled' | string

export interface SlackSocketModeDisconnectEnvelope {
  type: 'disconnect'
  reason: SlackSocketModeDisconnectReason
  debug_info?: {
    host?: string
  }
}

export interface SlackSocketModeEventsApiEnvelope {
  type: 'events_api'
  envelope_id: string
  payload: {
    token?: string
    team_id?: string
    api_app_id?: string
    event: SlackSocketModeEvent
    type?: 'event_callback' | string
    event_id?: string
    event_time?: number
    [key: string]: unknown
  }
  accepts_response_payload?: boolean
  retry_attempt?: number
  retry_reason?: string
}

export interface SlackSocketModeSlashCommandEnvelope {
  type: 'slash_commands'
  envelope_id: string
  payload: {
    command: string
    text: string
    user_id: string
    user_name?: string
    channel_id: string
    channel_name?: string
    team_id: string
    team_domain?: string
    api_app_id?: string
    response_url?: string
    trigger_id?: string
    [key: string]: unknown
  }
  accepts_response_payload?: boolean
}

export interface SlackSocketModeInteractiveEnvelope {
  type: 'interactive'
  envelope_id: string
  payload: {
    type: string
    user?: { id: string; username?: string; name?: string; team_id?: string }
    api_app_id?: string
    token?: string
    trigger_id?: string
    response_url?: string
    actions?: Array<Record<string, unknown>>
    view?: Record<string, unknown>
    [key: string]: unknown
  }
  accepts_response_payload?: boolean
}

export interface SlackSocketModeGenericEnvelope {
  type: string
  envelope_id?: string
  payload?: Record<string, unknown>
  accepts_response_payload?: boolean
  [key: string]: unknown
}

export type SlackSocketModeEnvelope =
  | SlackSocketModeHelloEnvelope
  | SlackSocketModeDisconnectEnvelope
  | SlackSocketModeEventsApiEnvelope
  | SlackSocketModeSlashCommandEnvelope
  | SlackSocketModeInteractiveEnvelope
  | SlackSocketModeGenericEnvelope

// Inner Events API event lives at `payload.event` — see SlackSocketModeEventsApiEnvelope.

export interface SlackSocketModeMessageEvent {
  type: 'message'
  subtype?: string
  channel: string
  channel_type?: string
  user?: string
  bot_id?: string
  text?: string
  ts: string
  thread_ts?: string
  event_ts?: string
  edited?: { user: string; ts: string }
  hidden?: boolean
  [key: string]: unknown
}

export interface SlackSocketModeAppMentionEvent {
  type: 'app_mention'
  channel: string
  user: string
  text: string
  ts: string
  thread_ts?: string
  event_ts?: string
  [key: string]: unknown
}

export interface SlackSocketModeReactionEvent {
  type: 'reaction_added' | 'reaction_removed'
  user: string
  reaction: string
  item: { type: string; channel: string; ts: string }
  item_user?: string
  event_ts: string
  [key: string]: unknown
}

export interface SlackSocketModeMemberChannelEvent {
  type: 'member_joined_channel' | 'member_left_channel'
  user: string
  channel: string
  channel_type?: string
  team?: string
  event_ts?: string
  [key: string]: unknown
}

export interface SlackSocketModeChannelEvent {
  type:
    | 'channel_created'
    | 'channel_deleted'
    | 'channel_rename'
    | 'channel_archive'
    | 'channel_unarchive'
    | 'channel_left'
  channel: { id: string; name?: string } | string
  event_ts?: string
  [key: string]: unknown
}

export interface SlackSocketModeGenericEvent {
  type: string
  [key: string]: unknown
}

export type SlackSocketModeEvent =
  | SlackSocketModeMessageEvent
  | SlackSocketModeAppMentionEvent
  | SlackSocketModeReactionEvent
  | SlackSocketModeMemberChannelEvent
  | SlackSocketModeChannelEvent
  | SlackSocketModeGenericEvent

// Acknowledgment callback. Without args sends `{ envelope_id }`; with args sends
// `{ envelope_id, payload }` (for `accepts_response_payload: true` envelopes).
export type SlackSocketModeAck = (responsePayload?: Record<string, unknown>) => void

export interface SlackSocketModeEventsApiArgs<E extends SlackSocketModeEvent = SlackSocketModeEvent> {
  ack: SlackSocketModeAck
  envelope_id: string
  body: SlackSocketModeEventsApiEnvelope['payload']
  event: E
  retry_num?: number
  retry_reason?: string
  accepts_response_payload?: boolean
}

export interface SlackSocketModeSlashCommandArgs {
  ack: SlackSocketModeAck
  envelope_id: string
  body: SlackSocketModeSlashCommandEnvelope['payload']
  accepts_response_payload?: boolean
}

export interface SlackSocketModeInteractiveArgs {
  ack: SlackSocketModeAck
  envelope_id: string
  body: SlackSocketModeInteractiveEnvelope['payload']
  accepts_response_payload?: boolean
}

export interface SlackBotListenerEventMap {
  connected: [info: { app_id?: string; num_connections?: number }]
  disconnected: []
  error: [error: Error]

  message: [args: SlackSocketModeEventsApiArgs<SlackSocketModeMessageEvent>]
  app_mention: [args: SlackSocketModeEventsApiArgs<SlackSocketModeAppMentionEvent>]
  reaction_added: [args: SlackSocketModeEventsApiArgs<SlackSocketModeReactionEvent>]
  reaction_removed: [args: SlackSocketModeEventsApiArgs<SlackSocketModeReactionEvent>]
  member_joined_channel: [args: SlackSocketModeEventsApiArgs<SlackSocketModeMemberChannelEvent>]
  member_left_channel: [args: SlackSocketModeEventsApiArgs<SlackSocketModeMemberChannelEvent>]
  channel_created: [args: SlackSocketModeEventsApiArgs<SlackSocketModeChannelEvent>]
  channel_deleted: [args: SlackSocketModeEventsApiArgs<SlackSocketModeChannelEvent>]
  channel_rename: [args: SlackSocketModeEventsApiArgs<SlackSocketModeChannelEvent>]
  channel_archive: [args: SlackSocketModeEventsApiArgs<SlackSocketModeChannelEvent>]
  channel_unarchive: [args: SlackSocketModeEventsApiArgs<SlackSocketModeChannelEvent>]

  slash_commands: [args: SlackSocketModeSlashCommandArgs]
  interactive: [args: SlackSocketModeInteractiveArgs]

  slack_event: [args: SlackSocketModeEventsApiArgs<SlackSocketModeGenericEvent> | SlackSocketModeGenericEnvelope]
}
