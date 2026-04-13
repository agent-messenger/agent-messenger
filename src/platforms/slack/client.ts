import { WebClient } from '@slack/web-api'

import {
  mapBookmark,
  mapChannel,
  mapDM,
  mapFile,
  mapMessage,
  mapPin,
  mapReminder,
  mapSavedItem,
  mapScheduledMessage,
  mapUser,
  mapUserProfile,
  mapUsergroup,
} from './client-mappers'
import type {
  SlackActivityItem,
  SlackBookmark,
  SlackChannel,
  SlackChannelSection,
  SlackDM,
  SlackDraft,
  SlackFile,
  SlackMessage,
  SlackPin,
  SlackReminder,
  SlackSavedItem,
  SlackScheduledMessage,
  SlackSearchResult,
  SlackThreadView,
  SlackUnreadCounts,
  SlackUser,
  SlackUserProfile,
  SlackUsergroup,
} from './types'

export class SlackError extends Error {
  code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'SlackError'
    this.code = code
  }
}

const MAX_RETRIES = 3
const RATE_LIMIT_ERROR_CODE = 'slack_webapi_rate_limited_error'

export class SlackClient {
  private client: WebClient | null = null
  private token: string | null = null
  private cookie: string | null = null

  async login(credentials?: { token: string; cookie: string }): Promise<this> {
    if (credentials) {
      if (!credentials.token) {
        throw new SlackError('Token is required', 'missing_token')
      }
      if (!credentials.cookie) {
        throw new SlackError('Cookie is required', 'missing_cookie')
      }
      this.token = credentials.token
      this.cookie = credentials.cookie
      this.client = new WebClient(credentials.token, {
        headers: { Cookie: `d=${credentials.cookie}` },
      })
      return this
    }

    const { ensureSlackAuth } = await import('./ensure-auth')
    await ensureSlackAuth()
    const { SlackCredentialManager } = await import('./credential-manager')
    const credManager = new SlackCredentialManager()
    const workspace = await credManager.getWorkspace()
    if (!workspace) {
      throw new SlackError(
        'No workspace credentials found. Make sure Slack is logged in in the desktop app or a supported Chromium browser.',
        'no_credentials',
      )
    }
    return this.login({ token: workspace.token, cookie: workspace.cookie })
  }

  private ensureAuth(): WebClient {
    if (!this.client) {
      throw new SlackError('Not authenticated. Call .login() first.', 'not_authenticated')
    }
    return this.client
  }

  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | undefined
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await operation()
      } catch (error: any) {
        lastError = error
        if (error.code === RATE_LIMIT_ERROR_CODE && attempt < MAX_RETRIES) {
          const retryAfter = error.retryAfter || 1
          await this.sleep(retryAfter * 1000 * (attempt + 1))
          continue
        }
        break
      }
    }
    throw new SlackError(lastError?.message || 'Unknown error', (lastError as any)?.code || 'unknown_error')
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private checkResponse(response: { ok?: boolean; error?: string }): void {
    if (!response.ok) {
      throw new SlackError(response.error || 'API call failed', response.error || 'api_error')
    }
  }

  async testAuth(): Promise<{ user_id: string; team_id: string; user?: string; team?: string }> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().auth.test()
      this.checkResponse(response)
      return {
        user_id: response.user_id!,
        team_id: response.team_id!,
        user: response.user,
        team: response.team,
      }
    })
  }

  async listChannels(): Promise<SlackChannel[]> {
    return this.withRetry(async () => {
      const channels: SlackChannel[] = []
      let cursor: string | undefined

      do {
        const response = await this.ensureAuth().conversations.list({
          cursor,
          limit: 200,
          types: 'public_channel,private_channel',
        })
        this.checkResponse(response)

        if (response.channels) {
          for (const ch of response.channels) {
            channels.push(mapChannel(ch))
          }
        }

        cursor = response.response_metadata?.next_cursor
      } while (cursor)

      return channels
    })
  }

  async listDMs(options: { includeArchived?: boolean } = {}): Promise<SlackDM[]> {
    return this.withRetry(async () => {
      const dms: SlackDM[] = []
      let cursor: string | undefined

      do {
        const response = await this.ensureAuth().conversations.list({
          cursor,
          limit: 200,
          types: 'im,mpim',
          exclude_archived: !options.includeArchived,
        })
        this.checkResponse(response)

        if (response.channels) {
          for (const ch of response.channels) {
            dms.push(mapDM(ch))
          }
        }

        cursor = response.response_metadata?.next_cursor
      } while (cursor)

      return dms
    })
  }

  async getChannel(id: string): Promise<SlackChannel> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().conversations.info({ channel: id })
      this.checkResponse(response)

      return mapChannel(response.channel)
    })
  }

  async resolveChannel(channel: string): Promise<string> {
    const normalized = channel.replace(/^#/, '')

    if (/^[CDG][A-Z0-9]+$/.test(normalized)) {
      return normalized
    }

    const name = normalized

    const channels = await this.listChannels()
    const found = channels.find((ch) => ch.name === name)

    if (!found) {
      throw new SlackError(
        `Channel not found: "${channel}". Use channel ID or exact channel name.`,
        'channel_not_found',
      )
    }

    return found.id
  }

  async sendMessage(channel: string, text: string, threadTs?: string): Promise<SlackMessage> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().chat.postMessage({
        channel,
        text,
        thread_ts: threadTs,
      })
      this.checkResponse(response)

      return mapMessage(response.message, { ts: response.ts!, text, type: 'message' })
    })
  }

  async getMessages(
    channel: string,
    limitOrOptions?: number | { limit?: number; oldest?: string; latest?: string },
  ): Promise<SlackMessage[]> {
    const options = typeof limitOrOptions === 'number' ? { limit: limitOrOptions } : (limitOrOptions ?? {})
    const { limit = 20, oldest, latest } = options

    return this.withRetry(async () => {
      const response = await this.ensureAuth().conversations.history({
        channel,
        limit,
        oldest,
        latest,
      })
      this.checkResponse(response)

      return (response.messages || []).map((msg) => mapMessage(msg))
    })
  }

  async getMessage(channel: string, ts: string): Promise<SlackMessage | null> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().conversations.history({
        channel,
        oldest: ts,
        inclusive: true,
        limit: 1,
      })
      this.checkResponse(response)

      const msg = response.messages?.[0]
      if (!msg || msg.ts !== ts) {
        return null
      }

      return mapMessage(msg)
    })
  }

  async updateMessage(channel: string, ts: string, text: string): Promise<SlackMessage> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().chat.update({
        channel,
        ts,
        text,
      })
      this.checkResponse(response)

      return mapMessage(response.message, { ts: response.ts!, text, type: 'message' })
    })
  }

  async deleteMessage(channel: string, ts: string): Promise<void> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().chat.delete({
        channel,
        ts,
      })
      this.checkResponse(response)
    })
  }

  async addReaction(channel: string, ts: string, emoji: string): Promise<void> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().reactions.add({
        channel,
        timestamp: ts,
        name: emoji,
      })
      this.checkResponse(response)
    })
  }

  async removeReaction(channel: string, ts: string, emoji: string): Promise<void> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().reactions.remove({
        channel,
        timestamp: ts,
        name: emoji,
      })
      this.checkResponse(response)
    })
  }

  async listUsers(): Promise<SlackUser[]> {
    return this.withRetry(async () => {
      const users: SlackUser[] = []
      let cursor: string | undefined

      do {
        const response = await this.ensureAuth().users.list({
          cursor,
          limit: 200,
        })
        this.checkResponse(response)

        if (response.members) {
          for (const member of response.members) {
            users.push(mapUser(member))
          }
        }

        cursor = response.response_metadata?.next_cursor
      } while (cursor)

      return users
    })
  }

  async listChannelMembers(channel: string): Promise<string[]> {
    return this.withRetry(async () => {
      const members: string[] = []
      let cursor: string | undefined

      do {
        const response = await this.ensureAuth().conversations.members({
          channel,
          cursor,
          limit: 200,
        })
        this.checkResponse(response)

        if (response.members) {
          members.push(...response.members)
        }

        cursor = response.response_metadata?.next_cursor
      } while (cursor)

      return members
    })
  }

  async getUser(id: string): Promise<SlackUser> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().users.info({ user: id })
      this.checkResponse(response)

      return mapUser(response.user)
    })
  }

  async uploadFile(channels: string[], file: Buffer, filename: string): Promise<SlackFile> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().files.uploadV2({
        channel_id: channels[0],
        file,
        filename,
      })
      this.checkResponse(response)

      const completionFiles = (response as any).files?.[0]?.files
      const f = completionFiles?.[0]
      if (!f) {
        throw new SlackError('No file returned in upload response', 'file_not_found')
      }
      return mapFile(f)
    })
  }

  async listFiles(channel?: string): Promise<SlackFile[]> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().files.list({
        channel,
      })
      this.checkResponse(response)

      return (response.files || []).map((f) => mapFile(f))
    })
  }

  async getFileInfo(fileId: string): Promise<SlackFile> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().files.info({ file: fileId })
      this.checkResponse(response)

      return mapFile(response.file)
    })
  }

  async downloadFile(fileId: string): Promise<{ buffer: Buffer; file: SlackFile }> {
    const file = await this.getFileInfo(fileId)

    if (!file.url_private) {
      throw new SlackError('File has no download URL', 'no_download_url')
    }

    this.ensureAuth()
    const response = await fetch(file.url_private, {
      headers: {
        Authorization: `Bearer ${this.token!}`,
        Cookie: `d=${this.cookie!}`,
      },
    })

    if (!response.ok) {
      throw new SlackError(`Failed to download file: ${response.statusText}`, 'download_failed')
    }

    const arrayBuffer = await response.arrayBuffer()
    return {
      buffer: Buffer.from(arrayBuffer),
      file,
    }
  }

  async searchMessages(
    query: string,
    options: { sort?: 'score' | 'timestamp'; sortDir?: 'asc' | 'desc'; count?: number } = {},
  ): Promise<SlackSearchResult[]> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().search.messages({
        query,
        sort: options.sort || 'timestamp',
        sort_dir: options.sortDir || 'desc',
        count: options.count || 20,
      })
      this.checkResponse(response)

      const matches = (response.messages as any)?.matches || []
      return matches.map((match: any) => ({
        ts: match.ts,
        text: match.text || '',
        user: match.user,
        username: match.username,
        channel: {
          id: match.channel?.id || '',
          name: match.channel?.name || '',
        },
        permalink: match.permalink || '',
      }))
    })
  }

  async getThreadReplies(
    channel: string,
    threadTs: string,
    options: { limit?: number; oldest?: string; latest?: string; cursor?: string } = {},
  ): Promise<{ messages: SlackMessage[]; has_more: boolean; next_cursor?: string }> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().conversations.replies({
        channel,
        ts: threadTs,
        limit: options.limit || 100,
        oldest: options.oldest,
        latest: options.latest,
        cursor: options.cursor,
      })
      this.checkResponse(response)

      const messages = (response.messages || []).map((msg: unknown) => mapMessage(msg))

      return {
        messages,
        has_more: response.has_more || false,
        next_cursor: response.response_metadata?.next_cursor,
      }
    })
  }

  async getUnreadCounts(): Promise<SlackUnreadCounts> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().apiCall('client.counts')
      this.checkResponse(response)

      const channels = ((response as any).channels || []).map((ch: any) => ({
        id: ch.id || '',
        name: ch.name || '',
        unread_count: ch.unread_count || 0,
        mention_count: ch.mention_count || 0,
      }))

      return {
        channels,
        total_unread: channels.reduce((sum: number, ch: any) => sum + ch.unread_count, 0),
        total_mentions: channels.reduce((sum: number, ch: any) => sum + ch.mention_count, 0),
      }
    })
  }

  async getThreadView(channelId: string, ts: string): Promise<SlackThreadView> {
    return this.withRetry(async () => {
      const response = await (this.ensureAuth() as any).subscriptions.thread.getView({
        channel: channelId,
        thread_ts: ts,
      })
      this.checkResponse(response)

      const view = response.view as any
      return {
        channel_id: view.channel_id || channelId,
        thread_ts: view.thread_ts || ts,
        unread_count: view.unread_count || 0,
        last_read: view.last_read || '',
        subscribed: view.subscribed || false,
      }
    })
  }

  async markRead(channelId: string, ts: string): Promise<void> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().conversations.mark({
        channel: channelId,
        ts,
      })
      this.checkResponse(response)
    })
  }

  async getActivityFeed(options?: { types?: string; mode?: string; limit?: number }): Promise<SlackActivityItem[]> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().apiCall('activity.feed', {
        types: options?.types || 'thread_reply,message_reaction,at_user,at_channel,keyword',
        mode: options?.mode || 'chrono_reads_and_unreads',
        limit: options?.limit || 20,
      })
      this.checkResponse(response)

      const items = ((response as any).items || []).map((item: any) => ({
        id: item.id || '',
        type: item.type || '',
        channel: item.channel || '',
        ts: item.ts || '',
        text: item.text || '',
        user: item.user || '',
        created: item.created || 0,
      }))

      return items
    })
  }

  async getSavedItems(cursor?: string): Promise<{
    items: SlackSavedItem[]
    has_more: boolean
    next_cursor?: string
  }> {
    return this.withRetry(async () => {
      const response = await (this.ensureAuth() as any).apiCall('saved.list', {
        cursor,
        limit: 50,
      })
      this.checkResponse(response)

      const items = (response.items || []).map((item: unknown) => mapSavedItem(item))

      return {
        items,
        has_more: response.has_more || false,
        next_cursor: response.response_metadata?.next_cursor,
      }
    })
  }

  async getChannelSections(): Promise<SlackChannelSection[]> {
    return this.withRetry(async () => {
      const response = await (this.ensureAuth() as any).apiCall('users.channelSections.list')
      this.checkResponse(response)

      const sections = (response as any).channel_sections || []
      return sections.map((section: any) => ({
        id: section.id!,
        name: section.name || '',
        channel_ids: section.channel_ids || [],
        date_created: section.date_created || 0,
        date_updated: section.date_updated || 0,
      }))
    })
  }

  async openConversation(users: string): Promise<{ channel_id: string; already_open: boolean }> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().conversations.open({ users })
      this.checkResponse(response)

      return {
        channel_id: response.channel!.id!,
        already_open: response.already_open || false,
      }
    })
  }

  async getDrafts(cursor?: string): Promise<{ drafts: SlackDraft[]; next_cursor?: string }> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().apiCall('drafts.list', {
        cursor,
      })
      this.checkResponse(response)

      const drafts = ((response as any).drafts || []).map((draft: any) => ({
        id: draft.id || '',
        channel_id: draft.channel_id || '',
        message: draft.message || null,
        date_created: draft.date_created || 0,
        date_updated: draft.date_updated || 0,
      }))

      return {
        drafts,
        next_cursor: (response as any).response_metadata?.next_cursor,
      }
    })
  }

  async rtmConnect(): Promise<{ url: string; cookie: string; self: { id: string }; team: { id: string } }> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().apiCall('rtm.connect')
      this.checkResponse(response)
      return {
        url: (response as any).url,
        cookie: this.cookie!,
        self: { id: (response as any).self.id },
        team: { id: (response as any).team.id },
      }
    })
  }

  async pinMessage(channel: string, ts: string): Promise<void> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().pins.add({ channel, timestamp: ts })
      this.checkResponse(response)
    })
  }

  async unpinMessage(channel: string, ts: string): Promise<void> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().pins.remove({ channel, timestamp: ts })
      this.checkResponse(response)
    })
  }

  async listPins(channel: string): Promise<SlackPin[]> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().pins.list({ channel })
      this.checkResponse(response)

      return ((response as any).items || [])
        .filter((item: any) => item.message)
        .map((item: unknown) => mapPin(item, channel))
    })
  }

  async addBookmark(
    channel: string,
    title: string,
    link: string,
    options?: { type?: string; emoji?: string },
  ): Promise<SlackBookmark> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().apiCall('bookmarks.add', {
        channel_id: channel,
        title,
        link,
        type: options?.type || 'link',
        emoji: options?.emoji,
      })
      this.checkResponse(response)

      return mapBookmark((response as any).bookmark, {
        channel_id: channel,
        title,
        link,
        type: options?.type || 'link',
      })
    })
  }

  async editBookmark(
    channel: string,
    bookmarkId: string,
    options: Partial<Pick<SlackBookmark, 'title' | 'link' | 'emoji'>>,
  ): Promise<SlackBookmark> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().apiCall('bookmarks.edit', {
        channel_id: channel,
        bookmark_id: bookmarkId,
        ...options,
      })
      this.checkResponse(response)

      return mapBookmark((response as any).bookmark, { id: bookmarkId, channel_id: channel, type: 'link' })
    })
  }

  async removeBookmark(channel: string, bookmarkId: string): Promise<void> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().apiCall('bookmarks.remove', {
        channel_id: channel,
        bookmark_id: bookmarkId,
      })
      this.checkResponse(response)
    })
  }

  async listBookmarks(channel: string): Promise<SlackBookmark[]> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().apiCall('bookmarks.list', { channel_id: channel })
      this.checkResponse(response)

      return ((response as any).bookmarks || []).map((bookmark: unknown) =>
        mapBookmark(bookmark, { channel_id: channel, type: 'link' }),
      )
    })
  }

  async scheduleMessage(
    channel: string,
    text: string,
    postAt: number,
    threadTs?: string,
  ): Promise<SlackScheduledMessage> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().chat.scheduleMessage({
        channel,
        text,
        post_at: postAt,
        thread_ts: threadTs,
      })
      this.checkResponse(response)

      return mapScheduledMessage(response, {
        channel_id: channel,
        post_at: postAt,
        date_created: Math.floor(Date.now() / 1000),
        text,
      })
    })
  }

  async listScheduledMessages(channel?: string): Promise<SlackScheduledMessage[]> {
    return this.withRetry(async () => {
      const allMessages: SlackScheduledMessage[] = []
      let cursor: string | undefined

      do {
        const response = await (this.ensureAuth().chat.scheduledMessages.list as any)({
          ...(channel ? { channel } : {}),
          ...(cursor ? { cursor } : {}),
        })
        this.checkResponse(response)

        const messages = ((response as any).scheduled_messages || []).map((message: unknown) =>
          mapScheduledMessage(message),
        )
        allMessages.push(...messages)
        cursor = (response as any).response_metadata?.next_cursor
      } while (cursor)

      return allMessages
    })
  }

  async deleteScheduledMessage(channel: string, scheduledMessageId: string): Promise<void> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().chat.deleteScheduledMessage({
        channel,
        scheduled_message_id: scheduledMessageId,
      })
      this.checkResponse(response)
    })
  }

  async createChannel(name: string, isPrivate?: boolean): Promise<SlackChannel> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().conversations.create({ name, is_private: isPrivate })
      this.checkResponse(response)

      return mapChannel(response.channel, { name })
    })
  }

  async archiveChannel(channel: string): Promise<void> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().conversations.archive({ channel })
      this.checkResponse(response)
    })
  }

  async setChannelTopic(channel: string, topic: string): Promise<{ topic: string }> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().conversations.setTopic({ channel, topic })
      this.checkResponse(response)
      return { topic: (response as any).topic || topic }
    })
  }

  async setChannelPurpose(channel: string, purpose: string): Promise<{ purpose: string }> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().conversations.setPurpose({ channel, purpose })
      this.checkResponse(response)
      return { purpose: (response as any).purpose || purpose }
    })
  }

  async inviteToChannel(channel: string, users: string): Promise<SlackChannel> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().conversations.invite({ channel, users })
      this.checkResponse(response)

      return mapChannel(response.channel)
    })
  }

  async joinChannel(channel: string): Promise<SlackChannel> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().conversations.join({ channel })
      this.checkResponse(response)

      return mapChannel(response.channel)
    })
  }

  async leaveChannel(channel: string): Promise<void> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().conversations.leave({ channel })
      this.checkResponse(response)
    })
  }

  async lookupUserByEmail(email: string): Promise<SlackUser> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().users.lookupByEmail({ email })
      this.checkResponse(response)

      return mapUser(response.user)
    })
  }

  async getUserProfile(userId: string): Promise<SlackUserProfile> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().users.profile.get({ user: userId })
      this.checkResponse(response)

      return mapUserProfile((response as any).profile)
    })
  }

  async setUserProfile(profile: SlackUserProfile): Promise<SlackUserProfile> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().users.profile.set({ profile: profile as any })
      this.checkResponse(response)

      return mapUserProfile((response as any).profile)
    })
  }

  async postEphemeral(channel: string, user: string, text: string): Promise<string> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().chat.postEphemeral({ channel, user, text })
      this.checkResponse(response)
      return (response as any).message_ts || ''
    })
  }

  async getPermalink(channel: string, ts: string): Promise<string> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().chat.getPermalink({ channel, message_ts: ts })
      this.checkResponse(response)
      return (response as any).permalink || ''
    })
  }

  async addReminder(text: string, time: number, options?: { user?: string }): Promise<SlackReminder> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().reminders.add({ text, time: time as any, user: options?.user })
      this.checkResponse(response)

      return mapReminder((response as any).reminder, { text, time })
    })
  }

  async listReminders(): Promise<SlackReminder[]> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().reminders.list({})
      this.checkResponse(response)

      return ((response as any).reminders || []).map((reminder: unknown) => mapReminder(reminder))
    })
  }

  async completeReminder(reminderId: string): Promise<void> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().reminders.complete({ reminder: reminderId })
      this.checkResponse(response)
    })
  }

  async deleteReminder(reminderId: string): Promise<void> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().reminders.delete({ reminder: reminderId })
      this.checkResponse(response)
    })
  }

  async deleteFile(fileId: string): Promise<void> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().files.delete({ file: fileId })
      this.checkResponse(response)
    })
  }

  async listEmoji(): Promise<Record<string, string>> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().emoji.list({})
      this.checkResponse(response)
      return ((response as any).emoji || {}) as Record<string, string>
    })
  }

  async listUsergroups(options?: {
    includeDisabled?: boolean
    includeUsers?: boolean
    includeCount?: boolean
  }): Promise<SlackUsergroup[]> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().apiCall('usergroups.list', {
        include_disabled: options?.includeDisabled,
        include_users: options?.includeUsers,
        include_count: options?.includeCount,
      })
      this.checkResponse(response)
      return ((response as any).usergroups || []).map((usergroup: unknown) => mapUsergroup(usergroup))
    })
  }

  async createUsergroup(
    name: string,
    options?: { handle?: string; description?: string; channels?: string[] },
  ): Promise<SlackUsergroup> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().apiCall('usergroups.create', {
        name,
        handle: options?.handle,
        description: options?.description,
        channels: options?.channels?.join(','),
      })
      this.checkResponse(response)
      return mapUsergroup((response as any).usergroup)
    })
  }

  async updateUsergroup(
    usergroupId: string,
    options: { name?: string; handle?: string; description?: string; channels?: string[] },
  ): Promise<SlackUsergroup> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().apiCall('usergroups.update', {
        usergroup: usergroupId,
        name: options.name,
        handle: options.handle,
        description: options.description,
        channels: options.channels?.join(','),
      })
      this.checkResponse(response)
      return mapUsergroup((response as any).usergroup)
    })
  }

  async disableUsergroup(usergroupId: string): Promise<SlackUsergroup> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().apiCall('usergroups.disable', {
        usergroup: usergroupId,
      })
      this.checkResponse(response)
      return mapUsergroup((response as any).usergroup)
    })
  }

  async enableUsergroup(usergroupId: string): Promise<SlackUsergroup> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().apiCall('usergroups.enable', {
        usergroup: usergroupId,
      })
      this.checkResponse(response)
      return mapUsergroup((response as any).usergroup)
    })
  }

  async listUsergroupMembers(usergroupId: string, options?: { includeDisabled?: boolean }): Promise<string[]> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().apiCall('usergroups.users.list', {
        usergroup: usergroupId,
        include_disabled: options?.includeDisabled,
      })
      this.checkResponse(response)
      return (response as any).users || []
    })
  }

  async updateUsergroupMembers(usergroupId: string, users: string[]): Promise<SlackUsergroup> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().apiCall('usergroups.users.update', {
        usergroup: usergroupId,
        users: users.join(','),
      })
      this.checkResponse(response)
      return mapUsergroup((response as any).usergroup)
    })
  }
}
