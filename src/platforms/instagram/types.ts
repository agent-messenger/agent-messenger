export interface InstagramAccount {
  account_id: string
  username: string
  full_name?: string
  profile_pic_url?: string
  pk?: string
  created_at: string
  updated_at: string
}

export interface InstagramConfig {
  current: string | null
  accounts: Record<string, InstagramAccount>
}

export interface InstagramAccountPaths {
  account_dir: string
  session_path: string
}

export class InstagramError extends Error {
  code: string | number

  constructor(message: string, code: string | number = 'instagram_error') {
    super(message)
    this.name = 'InstagramError'
    this.code = code
  }
}

export function createAccountId(input: string): string {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || 'default'
}

export interface InstagramChatSummary {
  id: string
  name: string
  type: 'private' | 'group'
  is_group: boolean
  participant_count: number
  unread_count: number
  last_message?: InstagramMessageSummary
}

export interface InstagramMessageSummary {
  id: string
  thread_id: string
  from: string
  from_name?: string
  timestamp: string
  is_outgoing: boolean
  type: string
  text?: string
}

export interface InstagramSessionState {
  cookies: string
  device: {
    phone_id: string
    uuid: string
    android_device_id: string
    advertising_id: string
    client_session_id: string
    device_string: string
  }
  authorization?: string
  user_id?: string
  mid?: string
  challenge_path?: string
}

export function getMessageType(item: Record<string, unknown>): string {
  const itemType = item['item_type']
  if (typeof itemType !== 'string') return 'unknown'

  switch (itemType) {
    case 'clip':
    case 'felix_share':
    case 'reel_share': return 'reel_share'
    default: return itemType
  }
}

export function extractMessageText(item: Record<string, unknown>): string | undefined {
  const itemType = item['item_type'] as string | undefined

  if (item['text'] != null) return item['text'] as string

  const link = item['link'] as Record<string, unknown> | undefined
  if (link?.['text'] != null) return link['text'] as string

  const reelShare = item['reel_share'] as Record<string, unknown> | undefined
  if (reelShare?.['text'] != null) return reelShare['text'] as string
  if (itemType === 'reel_share') return 'Shared a reel'

  const storyShare = item['story_share'] as Record<string, unknown> | undefined
  if (storyShare?.['message'] != null) return storyShare['message'] as string

  const clip = item['clip'] as Record<string, unknown> | undefined
  const clipInner = clip?.['clip'] as Record<string, unknown> | undefined
  const clipCaption = clipInner?.['caption'] as Record<string, unknown> | undefined
  if (clipCaption?.['text'] != null) return clipCaption['text'] as string

  const mediaShare = item['media_share'] as Record<string, unknown> | undefined
  const mediaCaption = mediaShare?.['caption'] as Record<string, unknown> | undefined
  if (mediaCaption?.['text'] != null) return mediaCaption['text'] as string

  if (itemType === 'like') return '❤️'

  const actionLog = item['action_log'] as Record<string, unknown> | undefined
  if (actionLog?.['description'] != null) return actionLog['description'] as string

  return undefined
}
