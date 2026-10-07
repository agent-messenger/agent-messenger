import { WebClient } from '@slack/web-api'

import { SlackBotCredentialManager } from './credential-manager'
import { mapSlackFile, mapSlackMessage } from './message-mapper'
import { SlackBotError, type SlackChannel, type SlackFile, type SlackMessage, type SlackUser } from './types'

const MAX_RETRIES = 3
const RATE_LIMIT_ERROR_CODE = 'slack_webapi_rate_limited_error'

export class SlackBotClient {
  private client: WebClient | null = null
  private token: string | null = null

  async login(credentials?: { token: string }): Promise<this> {
    if (credentials) {
      const { token } = credentials
      if (!token) {
        throw new SlackBotError('Token is required', 'missing_token')
      }
      if (!token.startsWith('xoxb-')) {
        throw new SlackBotError('Token must be a bot token (xoxb-)', 'invalid_token_type')
      }
      this.token = token
      this.client = new WebClient(token)
    } else {
      const credManager = new SlackBotCredentialManager()
      const creds = await credManager.getCredentials()
      if (!creds) {
        throw new SlackBotError('No credentials configured. Run "auth set <token>" first.', 'not_authenticated')
      }
      await this.login({ token: creds.token })
    }
    return this
  }

  private ensureAuth(): WebClient {
    if (!this.client) {
      throw new SlackBotError('Not authenticated. Call .login() first.', 'not_authenticated')
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
    const code = (lastError as any)?.code || 'unknown_error'
    const retryAfter = code === RATE_LIMIT_ERROR_CODE ? (lastError as any)?.retryAfter : undefined
    throw new SlackBotError(lastError?.message || 'Unknown error', code, retryAfter)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private checkResponse(response: { ok?: boolean; error?: string }): void {
    if (!response.ok) {
      throw new SlackBotError(response.error || 'API call failed', response.error || 'api_error')
    }
  }

  async testAuth(): Promise<{
    user_id: string
    team_id: string
    bot_id?: string
    user?: string
    team?: string
  }> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().auth.test()
      this.checkResponse(response)
      return {
        user_id: response.user_id!,
        team_id: response.team_id!,
        bot_id: response.bot_id,
        user: response.user,
        team: response.team,
      }
    })
  }

  async postMessage(
    channel: string,
    text: string,
    options?: {
      thread_ts?: string
      blocks?: unknown[]
      attachments?: unknown[]
      unfurl_links?: boolean
      unfurl_media?: boolean
      mrkdwn?: boolean
    },
  ): Promise<SlackMessage> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().chat.postMessage({
        channel,
        text,
        thread_ts: options?.thread_ts,
        blocks: options?.blocks as any,
        attachments: options?.attachments as any,
        unfurl_links: options?.unfurl_links,
        unfurl_media: options?.unfurl_media,
        mrkdwn: options?.mrkdwn,
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

  async getConversationHistory(
    channel: string,
    options?: { limit?: number; cursor?: string },
  ): Promise<SlackMessage[]> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().conversations.history({
        channel,
        limit: options?.limit || 20,
        cursor: options?.cursor,
      })
      this.checkResponse(response)

      return (response.messages || []).map(mapSlackMessage)
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

      return mapSlackMessage(msg)
    })
  }

  async addReaction(channel: string, timestamp: string, emoji: string): Promise<void> {
    // Normalize emoji (remove colons if present)
    const normalizedEmoji = emoji.replace(/^:|:$/g, '')

    return this.withRetry(async () => {
      const response = await this.ensureAuth().reactions.add({
        channel,
        timestamp,
        name: normalizedEmoji,
      })
      this.checkResponse(response)
    })
  }

  async removeReaction(channel: string, timestamp: string, emoji: string): Promise<void> {
    // Normalize emoji (remove colons if present)
    const normalizedEmoji = emoji.replace(/^:|:$/g, '')

    return this.withRetry(async () => {
      const response = await this.ensureAuth().reactions.remove({
        channel,
        timestamp,
        name: normalizedEmoji,
      })
      this.checkResponse(response)
    })
  }

  async listChannels(options?: { limit?: number; cursor?: string }): Promise<SlackChannel[]> {
    const channels: SlackChannel[] = []
    let cursor: string | undefined = options?.cursor

    do {
      // Only wrap individual API call in withRetry, not the entire loop
      const response = await this.withRetry(async () => {
        const res = await this.ensureAuth().conversations.list({
          cursor,
          limit: options?.limit || 200,
          types: 'public_channel,private_channel',
        })
        this.checkResponse(res)
        return res
      })

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
      // Only paginate if no specific limit was requested
      if (options?.limit) break
    } while (cursor)

    return channels
  }

  async getChannelInfo(channel: string): Promise<SlackChannel> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().conversations.info({ channel })
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
      throw new SlackBotError(
        `Channel not found: "${channel}". Use channel ID or exact channel name.`,
        'channel_not_found',
      )
    }

    return found.id
  }

  async listUsers(options?: { limit?: number; cursor?: string }): Promise<SlackUser[]> {
    const users: SlackUser[] = []
    let cursor: string | undefined = options?.cursor

    do {
      // Only wrap individual API call in withRetry, not the entire loop
      const response = await this.withRetry(async () => {
        const res = await this.ensureAuth().users.list({
          cursor,
          limit: options?.limit || 200,
        })
        this.checkResponse(res)
        return res
      })

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
      // Only paginate if no specific limit was requested
      if (options?.limit) break
    } while (cursor)

    return users
  }

  async getUserInfo(userId: string): Promise<SlackUser> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().users.info({ user: userId })
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

  async updateMessage(channel: string, ts: string, text: string): Promise<SlackMessage> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().chat.update({ channel, ts, text })
      this.checkResponse(response)
      const msg = (response as any).message
      return {
        ts: response.ts!,
        text: msg?.text || response.text || text,
        type: msg?.type || 'message',
        user: msg?.user,
      }
    })
  }

  async getThreadReplies(
    channel: string,
    ts: string,
    options?: { limit?: number; cursor?: string },
  ): Promise<SlackMessage[]> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().conversations.replies({
        channel,
        ts,
        limit: options?.limit || 100,
        cursor: options?.cursor,
      })
      this.checkResponse(response)

      return (response.messages || []).map(mapSlackMessage)
    })
  }

  async setAssistantStatus(channel: string, threadTs: string, status: string): Promise<void> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().assistant.threads.setStatus({
        channel_id: channel,
        thread_ts: threadTs,
        status,
      })
      this.checkResponse(response)
    })
  }

  async joinChannel(channel: string): Promise<void> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().conversations.join({ channel })
      this.checkResponse(response)
    })
  }

  async deleteMessage(channel: string, ts: string): Promise<void> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().chat.delete({ channel, ts })
      this.checkResponse(response)
    })
  }

  async uploadFile(
    channel: string,
    file: Buffer,
    filename: string,
    options?: { thread_ts?: string; title?: string; initial_comment?: string },
  ): Promise<SlackFile> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().files.uploadV2({
        channel_id: channel,
        file,
        filename,
        thread_ts: options?.thread_ts,
        title: options?.title,
        initial_comment: options?.initial_comment,
      })
      this.checkResponse(response)

      const completionFiles = (response as any).files?.[0]?.files
      const f = completionFiles?.[0]
      if (!f) {
        throw new SlackBotError('No file returned in upload response', 'file_not_found')
      }
      return mapSlackFile(f)
    })
  }

  async listFiles(options?: { channel?: string; user?: string; limit?: number }): Promise<SlackFile[]> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().files.list({
        channel: options?.channel,
        user: options?.user,
        count: options?.limit,
      })
      this.checkResponse(response)

      return (response.files || []).map((f) => mapSlackFile(f))
    })
  }

  async getFileInfo(fileId: string): Promise<SlackFile> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().files.info({ file: fileId })
      this.checkResponse(response)

      return mapSlackFile(response.file)
    })
  }

  async downloadFile(fileId: string): Promise<{ buffer: Buffer; file: SlackFile }> {
    const file = await this.getFileInfo(fileId)

    if (!file.url_private) {
      throw new SlackBotError('File has no download URL', 'no_download_url')
    }

    if (!this.token) {
      throw new SlackBotError('Not authenticated. Call .login() first.', 'not_authenticated')
    }

    const response = await fetch(file.url_private, {
      headers: { Authorization: `Bearer ${this.token}` },
    })

    if (!response.ok) {
      throw new SlackBotError(`Failed to download file: ${response.statusText}`, 'download_failed')
    }

    const arrayBuffer = await response.arrayBuffer()
    return {
      buffer: Buffer.from(arrayBuffer),
      file,
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    return this.withRetry(async () => {
      const response = await this.ensureAuth().files.delete({ file: fileId })
      this.checkResponse(response)
    })
  }

  async appsConnectionsOpen(appToken: string): Promise<{ url: string }> {
    if (!appToken) {
      throw new SlackBotError('App-level token is required for Socket Mode', 'missing_app_token')
    }
    if (!appToken.startsWith('xapp-')) {
      throw new SlackBotError(
        'Token must be an app-level token (xapp-) with connections:write scope',
        'invalid_app_token_type',
      )
    }

    return this.withRetry(async () => {
      const response = await new WebClient(appToken).apps.connections.open()
      this.checkResponse(response)
      return { url: (response as { url: string }).url }
    })
  }
}
