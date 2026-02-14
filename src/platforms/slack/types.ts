/**
 * Core type definitions for agent-slack
 */

import { z } from 'zod'

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

export interface SlackSearchResult {
  ts: string
  text: string
  user?: string
  username?: string
  channel: {
    id: string
    name: string
  }
  permalink: string
}

export interface SlackUnreadCounts {
  channels: Array<{
    id: string
    name: string
    // Slack's undocumented client.counts API does not always return a numeric unread_count.
    // We rely on has_unreads + last_read/latest to determine unread state.
    has_unreads: boolean
    mention_count: number
    last_read?: string
    latest?: string
  }>
  total_mentions: number
  total_unread_channels: number
}

export interface SlackThreadView {
  channel_id: string
  thread_ts: string
  unread_count: number
  last_read: string
  subscribed: boolean
}

export interface SlackSavedItem {
  type: string
  message: SlackMessage
  channel: {
    id: string
    name: string
  }
  date_created: number
}

export interface SlackActivityItem {
  /** Stable identifier (best-effort). For activity.feed we use the returned `key` when available. */
  id: string
  type: string

  /** Channel ID (for message-based items). */
  channel: string
  channel_name?: string

  /** Message timestamp (for message-based items). */
  ts: string
  thread_ts?: string

  text: string
  user: string

  /** Epoch seconds (best-effort). */
  created: number

  /** Slack-internal feed timestamp / cursor (best-effort). */
  feed_ts?: string
  is_unread?: boolean
  permalink?: string
}

export interface SlackDraft {
  id: string
  channel_id: string
  message: {
    text?: string
    blocks?: any[]
  } | null
  date_created: number
  date_updated: number
}

export interface SlackChannelSection {
  id: string
  name: string
  channel_ids: string[]
  date_created: number
  date_updated: number
}

export interface WorkspaceCredentials {
  workspace_id: string
  workspace_name: string
  token: string
  cookie: string
}

export interface Config {
  current_workspace: string | null
  workspaces: Record<string, WorkspaceCredentials>
}

// Zod validation schemas
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

export const WorkspaceCredentialsSchema = z.object({
  workspace_id: z.string(),
  workspace_name: z.string(),
  token: z.string(),
  cookie: z.string(),
})

export const ConfigSchema = z.object({
  current_workspace: z.string().nullable(),
  workspaces: z.record(z.string(), WorkspaceCredentialsSchema),
})
