import type {
  SlackBookmark,
  SlackChannel,
  SlackDM,
  SlackFile,
  SlackMessage,
  SlackPin,
  SlackReminder,
  SlackSavedItem,
  SlackScheduledMessage,
  SlackUser,
  SlackUserProfile,
  SlackUsergroup,
} from './types'

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function toString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function toNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' ? value : fallback
}

function toBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function toOptionalStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) ? toStringArray(value) : undefined
}

export function mapChannel(channel: unknown, defaults?: Partial<Pick<SlackChannel, 'id' | 'name'>>): SlackChannel {
  const record = toRecord(channel)
  const topicRecord = record.topic ? toRecord(record.topic) : null
  const purposeRecord = record.purpose ? toRecord(record.purpose) : null

  return {
    id: toString(record.id, defaults?.id ?? ''),
    name: toString(record.name, defaults?.name ?? ''),
    is_private: toBoolean(record.is_private),
    is_archived: toBoolean(record.is_archived),
    created: toNumber(record.created),
    creator: toString(record.creator),
    topic: topicRecord
      ? {
          value: toString(topicRecord.value),
          creator: toString(topicRecord.creator),
          last_set: toNumber(topicRecord.last_set),
        }
      : undefined,
    purpose: purposeRecord
      ? {
          value: toString(purposeRecord.value),
          creator: toString(purposeRecord.creator),
          last_set: toNumber(purposeRecord.last_set),
        }
      : undefined,
  }
}

export function mapDM(channel: unknown): SlackDM {
  const record = toRecord(channel)
  return {
    id: toString(record.id),
    user: toString(record.user, toString(record.name)),
    is_mpim: toBoolean(record.is_mpim),
  }
}

export function mapFile(
  file: unknown,
  defaults?: Partial<Pick<SlackFile, 'id' | 'name' | 'title' | 'url_private'>>,
): SlackFile {
  const record = toRecord(file)
  return {
    id: toString(record.id, defaults?.id ?? ''),
    name: toString(record.name, defaults?.name ?? ''),
    title: toString(record.title, defaults?.title ?? toString(record.name, defaults?.name ?? '')),
    mimetype: toString(record.mimetype, 'application/octet-stream'),
    size: toNumber(record.size),
    url_private: toString(record.url_private, defaults?.url_private ?? ''),
    created: toNumber(record.created),
    user: toString(record.user),
    channels: toOptionalStringArray(record.channels),
  }
}

function mapEdited(edited: unknown): SlackMessage['edited'] {
  const record = toRecord(edited)
  return {
    user: toString(record.user),
    ts: toString(record.ts),
  }
}

function mapReplies(replies: unknown): SlackMessage['replies'] {
  if (!Array.isArray(replies)) return undefined
  return replies.map((reply) => {
    const record = toRecord(reply)
    return {
      user: toString(record.user),
      ts: toString(record.ts),
    }
  })
}

function mapReactions(reactions: unknown): SlackMessage['reactions'] {
  if (!Array.isArray(reactions)) return undefined
  return reactions.map((reaction) => {
    const record = toRecord(reaction)
    return {
      name: toString(record.name),
      count: toNumber(record.count),
      users: toStringArray(record.users),
    }
  })
}

export function mapMessage(
  message: unknown,
  defaults?: Partial<Pick<SlackMessage, 'ts' | 'text' | 'type'>>,
): SlackMessage {
  const record = toRecord(message)
  const files = Array.isArray(record.files) ? record.files.map((file) => mapFile(file)) : undefined

  return {
    ts: toString(record.ts, defaults?.ts ?? ''),
    text: toString(record.text, defaults?.text ?? ''),
    type: toString(record.type, defaults?.type ?? 'message'),
    user: typeof record.user === 'string' ? record.user : undefined,
    username: typeof record.username === 'string' ? record.username : undefined,
    thread_ts: typeof record.thread_ts === 'string' ? record.thread_ts : undefined,
    reply_count: typeof record.reply_count === 'number' ? record.reply_count : undefined,
    replies: mapReplies(record.replies),
    edited: record.edited ? mapEdited(record.edited) : undefined,
    reactions: mapReactions(record.reactions),
    files,
  }
}

export function mapUser(user: unknown): SlackUser {
  const record = toRecord(user)
  const profileRecord = record.profile ? toRecord(record.profile) : null

  return {
    id: toString(record.id),
    name: toString(record.name),
    real_name: toString(record.real_name, toString(record.name)),
    is_admin: toBoolean(record.is_admin),
    is_owner: toBoolean(record.is_owner),
    is_bot: toBoolean(record.is_bot),
    is_app_user: toBoolean(record.is_app_user),
    profile: profileRecord
      ? {
          email: typeof profileRecord.email === 'string' ? profileRecord.email : undefined,
          phone: typeof profileRecord.phone === 'string' ? profileRecord.phone : undefined,
          title: typeof profileRecord.title === 'string' ? profileRecord.title : undefined,
          status_text: typeof profileRecord.status_text === 'string' ? profileRecord.status_text : undefined,
        }
      : undefined,
  }
}

export function mapUserProfile(profile: unknown): SlackUserProfile {
  const record = toRecord(profile)
  return {
    title: typeof record.title === 'string' ? record.title : undefined,
    phone: typeof record.phone === 'string' ? record.phone : undefined,
    skype: typeof record.skype === 'string' ? record.skype : undefined,
    real_name: typeof record.real_name === 'string' ? record.real_name : undefined,
    real_name_normalized: typeof record.real_name_normalized === 'string' ? record.real_name_normalized : undefined,
    display_name: typeof record.display_name === 'string' ? record.display_name : undefined,
    display_name_normalized:
      typeof record.display_name_normalized === 'string' ? record.display_name_normalized : undefined,
    status_text: typeof record.status_text === 'string' ? record.status_text : undefined,
    status_emoji: typeof record.status_emoji === 'string' ? record.status_emoji : undefined,
    status_expiration: typeof record.status_expiration === 'number' ? record.status_expiration : undefined,
    email: typeof record.email === 'string' ? record.email : undefined,
    first_name: typeof record.first_name === 'string' ? record.first_name : undefined,
    last_name: typeof record.last_name === 'string' ? record.last_name : undefined,
    image_24: typeof record.image_24 === 'string' ? record.image_24 : undefined,
    image_32: typeof record.image_32 === 'string' ? record.image_32 : undefined,
    image_48: typeof record.image_48 === 'string' ? record.image_48 : undefined,
    image_72: typeof record.image_72 === 'string' ? record.image_72 : undefined,
    image_192: typeof record.image_192 === 'string' ? record.image_192 : undefined,
    image_512: typeof record.image_512 === 'string' ? record.image_512 : undefined,
  }
}

export function mapSavedItem(item: unknown): SlackSavedItem {
  const record = toRecord(item)
  const channelRecord = toRecord(record.channel)
  return {
    type: toString(record.type, 'message'),
    message: mapMessage(record.message),
    channel: {
      id: toString(channelRecord.id),
      name: toString(channelRecord.name),
    },
    date_created: toNumber(record.date_created),
  }
}

export function mapPin(item: unknown, channel: string): SlackPin {
  const record = toRecord(item)
  return {
    channel,
    message: mapMessage(record.message),
    date_created: toNumber(record.created),
    created_by: toString(record.created_by),
  }
}

export function mapBookmark(
  bookmark: unknown,
  defaults?: Partial<Pick<SlackBookmark, 'id' | 'channel_id' | 'title' | 'link' | 'type'>>,
): SlackBookmark {
  const record = toRecord(bookmark)
  return {
    id: toString(record.id, defaults?.id ?? ''),
    channel_id: toString(record.channel_id, defaults?.channel_id ?? ''),
    title: toString(record.title, defaults?.title ?? ''),
    link: toString(record.link, defaults?.link ?? ''),
    emoji: typeof record.emoji === 'string' ? record.emoji : undefined,
    icon_url: typeof record.icon_url === 'string' ? record.icon_url : undefined,
    type: toString(record.type, defaults?.type ?? 'link'),
    date_created: toNumber(record.date_created),
    date_updated: toNumber(record.date_updated),
    created_by: toString(record.created_by),
  }
}

export function mapScheduledMessage(
  message: unknown,
  defaults?: Partial<Pick<SlackScheduledMessage, 'channel_id' | 'post_at' | 'date_created' | 'text'>>,
): SlackScheduledMessage {
  const record = toRecord(message)
  return {
    id: toString(record.id, toString(record.scheduled_message_id)),
    channel_id: toString(record.channel_id, defaults?.channel_id ?? ''),
    post_at: toNumber(record.post_at, defaults?.post_at ?? 0),
    date_created: toNumber(record.date_created, defaults?.date_created ?? 0),
    text: toString(record.text, defaults?.text ?? ''),
  }
}

export function mapReminder(
  reminder: unknown,
  defaults?: Partial<Pick<SlackReminder, 'text' | 'time'>>,
): SlackReminder {
  const record = toRecord(reminder)
  return {
    id: toString(record.id),
    creator: toString(record.creator),
    text: toString(record.text, defaults?.text ?? ''),
    user: toString(record.user),
    recurring: toBoolean(record.recurring),
    time: toNumber(record.time, defaults?.time ?? 0),
    complete_ts: toNumber(record.complete_ts),
  }
}

export function mapUsergroup(usergroup: unknown): SlackUsergroup {
  const record = toRecord(usergroup)
  const prefs = toRecord(record.prefs)

  return {
    id: toString(record.id),
    team_id: toString(record.team_id),
    name: toString(record.name),
    handle: toString(record.handle),
    description: toString(record.description),
    is_external: toBoolean(record.is_external),
    is_usergroup: toBoolean(record.is_usergroup),
    date_create: toNumber(record.date_create),
    date_update: toNumber(record.date_update),
    date_delete: toNumber(record.date_delete),
    auto_type: typeof record.auto_type === 'string' ? record.auto_type : null,
    created_by: toString(record.created_by),
    updated_by: toString(record.updated_by),
    deleted_by: typeof record.deleted_by === 'string' ? record.deleted_by : null,
    prefs: {
      channels: toStringArray(prefs.channels),
      groups: toStringArray(prefs.groups),
    },
    users: toStringArray(record.users),
    user_count: toNumber(record.user_count),
  }
}
