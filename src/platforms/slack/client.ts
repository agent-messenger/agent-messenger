import { WebClient } from '@slack/web-api'

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
            channels.push({
              id: ch.id!,
              name: ch.name!,
              is_private: ch.is_private || false,
              is_archived: ch.is_archived || false,
              created: ch.created || 0,
              creator: ch.creator || '',
              topic: ch.topic
                ? {
                    value: ch.topic.value || '',
                    creator: ch.topic.creator || '',
                    last_set: ch.topic.last_set || 0,
                  }
                : undefined,
              purpose: ch.purpose
                ? {
                    value: ch.purpose.value || '',
                    creator: ch.purpose.creator || '',
                    last_set: ch.purpose.last_set || 0,
                  }
                : undefined,
            })
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
            dms.push({
              id: ch.id!,
              user: ch.user || ch.name || '',
              is_mpim: ch.is_mpim || false,
            })
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

      const ch = response.channel!
      return {
        id: ch.id!,
        name: ch.name!,
        is_private: ch.is_private || false,
        is_archived: ch.is_archived || false,
        created: ch.created || 0,
        creator: ch.creator || '',
        topic: ch.topic
          ? {
              value: ch.topic.value || '',
              creator: ch.topic.creator || '',
              last_set: ch.topic.last_set || 0,
            }
          : undefined,
        purpose: ch.purpose
          ? {
              value: ch.purpose.value || '',
              creator: ch.purpose.creator || '',
              last_set: ch.purpose.last_set || 0,
            }
          : undefined,
      }
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

      const msg = response.message!
      return {
        ts: response.ts!,
        text: msg.text || text,
        type: msg.type || 'message',
        user: msg.user,
        thread_ts: msg.thread_ts,
      }
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

      return (response.messages || []).map((msg) => ({
        ts: msg.ts!,
        text: msg.text || '',
        type: msg.type || 'message',
        user: msg.user,
        username: msg.username,
        thread_ts: msg.thread_ts,
        reply_count: msg.reply_count,
        replies: (msg as any).replies,
        reactions: (msg as any).reactions,
        edited: msg.edited
          ? {
              user: msg.edited.user || '',
              ts: msg.edited.ts || '',
            }
          : undefined,
        files: (msg as any).files?.map((f: any) => ({
          id: f.id!,
          name: f.name!,
          title: f.title || f.name || '',
          mimetype: f.mimetype || 'application/octet-stream',
          size: f.size || 0,
          url_private: f.url_private || '',
          created: f.created || 0,
          user: f.user || '',
          channels: f.channels,
        })),
      }))
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

      return {
        ts: msg.ts!,
        text: msg.text || '',
        type: msg.type || 'message',
        user: msg.user,
        username: msg.username,
        thread_ts: msg.thread_ts,
        reply_count: msg.reply_count,
        replies: (msg as any).replies,
        reactions: (msg as any).reactions,
        edited: msg.edited
          ? {
              user: msg.edited.user || '',
              ts: msg.edited.ts || '',
            }
          : undefined,
        files: (msg as any).files?.map((f: any) => ({
          id: f.id!,
          name: f.name!,
          title: f.title || f.name || '',
          mimetype: f.mimetype || 'application/octet-stream',
          size: f.size || 0,
          url_private: f.url_private || '',
          created: f.created || 0,
          user: f.user || '',
          channels: f.channels,
        })),
      }
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

      const msg = response.message!
      return {
        ts: response.ts!,
        text: msg.text || text,
        type: 'message',
        user: msg.user,
      }
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
            users.push({
              id: member.id!,
              name: member.name!,
              real_name: member.real_name || member.name || '',
              is_admin: member.is_admin || false,
              is_owner: member.is_owner || false,
              is_bot: member.is_bot || false,
              is_app_user: member.is_app_user || false,
              profile: member.profile
                ? {
                    email: member.profile.email,
                    phone: member.profile.phone,
                    title: member.profile.title,
                    status_text: member.profile.status_text,
                  }
                : undefined,
            })
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

      const member = response.user!
      return {
        id: member.id!,
        name: member.name!,
        real_name: member.real_name || member.name || '',
        is_admin: member.is_admin || false,
        is_owner: member.is_owner || false,
        is_bot: member.is_bot || false,
        is_app_user: member.is_app_user || false,
        profile: member.profile
          ? {
              email: member.profile.email,
              phone: member.profile.phone,
              title: member.profile.title,
              status_text: member.profile.status_text,
            }
          : undefined,
      }
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
      return {
        id: f.id!,
        name: f.name!,
        title: f.title || f.name || '',
        mimetype: f.mimetype || 'application/octet-stream',
        size: f.size || 0,
        url_private: f.url_private || '',
        created: f.created || 0,
        user: f.user || '',
        channels: f.channels,
      }
    })
  }

  async listFiles(channel?: string): Promise<SlackFile[]> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().files.list({
        channel,
      })
      this.checkResponse(response)

      return (response.files || []).map((f) => ({
        id: f.id!,
        name: f.name!,
        title: f.title || f.name || '',
        mimetype: f.mimetype || 'application/octet-stream',
        size: f.size || 0,
        url_private: f.url_private || '',
        created: f.created || 0,
        user: f.user || '',
        channels: f.channels,
      }))
    })
  }

  async getFileInfo(fileId: string): Promise<SlackFile> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().files.info({ file: fileId })
      this.checkResponse(response)

      const f = response.file!
      return {
        id: f.id!,
        name: f.name!,
        title: f.title || f.name || '',
        mimetype: f.mimetype || 'application/octet-stream',
        size: f.size || 0,
        url_private: f.url_private || '',
        created: f.created || 0,
        user: f.user || '',
        channels: f.channels,
      }
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

      const messages = (response.messages || []).map((msg: any) => ({
        ts: msg.ts!,
        text: msg.text || '',
        type: msg.type || 'message',
        user: msg.user,
        username: msg.username,
        thread_ts: msg.thread_ts,
        reply_count: msg.reply_count,
        edited: msg.edited
          ? {
              user: msg.edited.user || '',
              ts: msg.edited.ts || '',
            }
          : undefined,
        reactions: msg.reactions,
        files: msg.files?.map((f: any) => ({
          id: f.id!,
          name: f.name!,
          title: f.title || f.name || '',
          mimetype: f.mimetype || 'application/octet-stream',
          size: f.size || 0,
          url_private: f.url_private || '',
          created: f.created || 0,
          user: f.user || '',
          channels: f.channels,
        })),
      }))

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

      const items = (response.items || []).map((item: any) => ({
        type: item.type || 'message',
        message: {
          ts: item.message?.ts || '',
          text: item.message?.text || '',
          user: item.message?.user,
          username: item.message?.username,
          type: item.message?.type || 'message',
          thread_ts: item.message?.thread_ts,
          reply_count: item.message?.reply_count,
          replies: item.message?.replies,
          edited: item.message?.edited
            ? {
                user: item.message.edited.user || '',
                ts: item.message.edited.ts || '',
              }
            : undefined,
        },
        channel: {
          id: item.channel?.id || '',
          name: item.channel?.name || '',
        },
        date_created: item.date_created || 0,
      }))

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
        .map((item: any) => ({
          channel,
          message: {
            ts: item.message.ts || '',
            text: item.message.text || '',
            user: item.message.user,
            username: item.message.username,
            type: item.message.type || 'message',
            thread_ts: item.message.thread_ts,
            reply_count: item.message.reply_count,
          },
          date_created: item.created || 0,
          created_by: item.created_by || '',
        }))
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

      const b = (response as any).bookmark
      return {
        id: b.id || '',
        channel_id: b.channel_id || channel,
        title: b.title || title,
        link: b.link || link,
        emoji: b.emoji,
        icon_url: b.icon_url,
        type: b.type || 'link',
        date_created: b.date_created || 0,
        date_updated: b.date_updated || 0,
        created_by: b.created_by || '',
      }
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

      const b = (response as any).bookmark
      return {
        id: b.id || bookmarkId,
        channel_id: b.channel_id || channel,
        title: b.title || '',
        link: b.link || '',
        emoji: b.emoji,
        icon_url: b.icon_url,
        type: b.type || 'link',
        date_created: b.date_created || 0,
        date_updated: b.date_updated || 0,
        created_by: b.created_by || '',
      }
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

      return ((response as any).bookmarks || []).map((b: any) => ({
        id: b.id || '',
        channel_id: b.channel_id || channel,
        title: b.title || '',
        link: b.link || '',
        emoji: b.emoji,
        icon_url: b.icon_url,
        type: b.type || 'link',
        date_created: b.date_created || 0,
        date_updated: b.date_updated || 0,
        created_by: b.created_by || '',
      }))
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

      return {
        id: (response as any).scheduled_message_id || '',
        channel_id: channel,
        post_at: postAt,
        date_created: Math.floor(Date.now() / 1000),
        text,
      }
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

        const messages = ((response as any).scheduled_messages || []).map((msg: any) => ({
          id: msg.id || msg.scheduled_message_id || '',
          channel_id: msg.channel_id || '',
          post_at: msg.post_at || 0,
          date_created: msg.date_created || 0,
          text: msg.text || '',
        }))
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

      const ch = response.channel!
      return {
        id: ch.id!,
        name: ch.name!,
        is_private: ch.is_private || false,
        is_archived: ch.is_archived || false,
        created: ch.created || 0,
        creator: ch.creator || '',
        topic: ch.topic
          ? {
              value: ch.topic.value || '',
              creator: ch.topic.creator || '',
              last_set: ch.topic.last_set || 0,
            }
          : undefined,
        purpose: ch.purpose
          ? {
              value: ch.purpose.value || '',
              creator: ch.purpose.creator || '',
              last_set: ch.purpose.last_set || 0,
            }
          : undefined,
      }
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

      const ch = response.channel!
      return {
        id: ch.id!,
        name: ch.name!,
        is_private: ch.is_private || false,
        is_archived: ch.is_archived || false,
        created: ch.created || 0,
        creator: ch.creator || '',
      }
    })
  }

  async joinChannel(channel: string): Promise<SlackChannel> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().conversations.join({ channel })
      this.checkResponse(response)

      const ch = response.channel!
      return {
        id: ch.id!,
        name: ch.name!,
        is_private: ch.is_private || false,
        is_archived: ch.is_archived || false,
        created: ch.created || 0,
        creator: ch.creator || '',
      }
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

      const member = response.user!
      return {
        id: member.id!,
        name: member.name!,
        real_name: member.real_name || member.name || '',
        is_admin: member.is_admin || false,
        is_owner: member.is_owner || false,
        is_bot: member.is_bot || false,
        is_app_user: member.is_app_user || false,
        profile: member.profile
          ? {
              email: member.profile.email,
              phone: member.profile.phone,
              title: member.profile.title,
              status_text: member.profile.status_text,
            }
          : undefined,
      }
    })
  }

  async getUserProfile(userId: string): Promise<SlackUserProfile> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().users.profile.get({ user: userId })
      this.checkResponse(response)

      const p = (response as any).profile || {}
      return {
        title: p.title,
        phone: p.phone,
        skype: p.skype,
        real_name: p.real_name,
        real_name_normalized: p.real_name_normalized,
        display_name: p.display_name,
        display_name_normalized: p.display_name_normalized,
        status_text: p.status_text,
        status_emoji: p.status_emoji,
        status_expiration: p.status_expiration,
        email: p.email,
        first_name: p.first_name,
        last_name: p.last_name,
        image_24: p.image_24,
        image_32: p.image_32,
        image_48: p.image_48,
        image_72: p.image_72,
        image_192: p.image_192,
        image_512: p.image_512,
      }
    })
  }

  async setUserProfile(profile: SlackUserProfile): Promise<SlackUserProfile> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().users.profile.set({ profile: profile as any })
      this.checkResponse(response)

      const p = (response as any).profile || {}
      return {
        title: p.title,
        phone: p.phone,
        skype: p.skype,
        real_name: p.real_name,
        real_name_normalized: p.real_name_normalized,
        display_name: p.display_name,
        display_name_normalized: p.display_name_normalized,
        status_text: p.status_text,
        status_emoji: p.status_emoji,
        status_expiration: p.status_expiration,
        email: p.email,
        first_name: p.first_name,
        last_name: p.last_name,
        image_24: p.image_24,
        image_32: p.image_32,
        image_48: p.image_48,
        image_72: p.image_72,
        image_192: p.image_192,
        image_512: p.image_512,
      }
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

      const r = (response as any).reminder || {}
      return {
        id: r.id || '',
        creator: r.creator || '',
        text: r.text || text,
        user: r.user || '',
        recurring: r.recurring || false,
        time: r.time || time,
        complete_ts: r.complete_ts || 0,
      }
    })
  }

  async listReminders(): Promise<SlackReminder[]> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().reminders.list({})
      this.checkResponse(response)

      return ((response as any).reminders || []).map((r: any) => ({
        id: r.id || '',
        creator: r.creator || '',
        text: r.text || '',
        user: r.user || '',
        recurring: r.recurring || false,
        time: r.time || 0,
        complete_ts: r.complete_ts || 0,
      }))
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

  private mapUsergroup(ug: any): SlackUsergroup {
    return {
      id: ug.id || '',
      team_id: ug.team_id || '',
      name: ug.name || '',
      handle: ug.handle || '',
      description: ug.description || '',
      is_external: ug.is_external ?? false,
      is_usergroup: ug.is_usergroup ?? true,
      date_create: ug.date_create ?? 0,
      date_update: ug.date_update ?? 0,
      date_delete: ug.date_delete ?? 0,
      auto_type: ug.auto_type ?? null,
      created_by: ug.created_by || '',
      updated_by: ug.updated_by || '',
      deleted_by: ug.deleted_by ?? null,
      prefs: {
        channels: ug.prefs?.channels || [],
        groups: ug.prefs?.groups || [],
      },
      users: ug.users || [],
      user_count: ug.user_count ?? 0,
    }
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
      return ((response as any).usergroups || []).map((ug: any) => this.mapUsergroup(ug))
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
      return this.mapUsergroup((response as any).usergroup)
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
      return this.mapUsergroup((response as any).usergroup)
    })
  }

  async disableUsergroup(usergroupId: string): Promise<SlackUsergroup> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().apiCall('usergroups.disable', {
        usergroup: usergroupId,
      })
      this.checkResponse(response)
      return this.mapUsergroup((response as any).usergroup)
    })
  }

  async enableUsergroup(usergroupId: string): Promise<SlackUsergroup> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().apiCall('usergroups.enable', {
        usergroup: usergroupId,
      })
      this.checkResponse(response)
      return this.mapUsergroup((response as any).usergroup)
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
      return this.mapUsergroup((response as any).usergroup)
    })
  }
}
