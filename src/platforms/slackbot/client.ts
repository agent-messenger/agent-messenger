import { WebClient } from '@slack/web-api'
import { SlackBotError, type SlackChannel, type SlackMessage, type SlackUser } from './types'

const MAX_RETRIES = 3
const RATE_LIMIT_ERROR_CODE = 'slack_webapi_rate_limited_error'

export class SlackBotClient {
  private client: WebClient

  constructor(token: string) {
    if (!token) {
      throw new SlackBotError('Token is required', 'missing_token')
    }
    if (!token.startsWith('xoxb-')) {
      throw new SlackBotError('Token must be a bot token (xoxb-)', 'invalid_token_type')
    }

    this.client = new WebClient(token)
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
    throw new SlackBotError(lastError?.message || 'Unknown error', (lastError as any)?.code || 'unknown_error')
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
      const response = await this.client.auth.test()
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

  async postMessage(channel: string, text: string, options?: { thread_ts?: string }): Promise<SlackMessage> {
    return this.withRetry(async () => {
      const response = await this.client.chat.postMessage({
        channel,
        text,
        thread_ts: options?.thread_ts,
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
      const response = await this.client.conversations.history({
        channel,
        limit: options?.limit || 20,
        cursor: options?.cursor,
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
        edited: msg.edited
          ? {
              user: msg.edited.user || '',
              ts: msg.edited.ts || '',
            }
          : undefined,
      }))
    })
  }

  async getMessage(channel: string, ts: string): Promise<SlackMessage | null> {
    return this.withRetry(async () => {
      const response = await this.client.conversations.history({
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
        edited: msg.edited
          ? {
              user: msg.edited.user || '',
              ts: msg.edited.ts || '',
            }
          : undefined,
      }
    })
  }

  async addReaction(channel: string, timestamp: string, emoji: string): Promise<void> {
    // Normalize emoji (remove colons if present)
    const normalizedEmoji = emoji.replace(/^:|:$/g, '')

    return this.withRetry(async () => {
      const response = await this.client.reactions.add({
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
      const response = await this.client.reactions.remove({
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
        const res = await this.client.conversations.list({
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
      const response = await this.client.conversations.info({ channel })
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
        const res = await this.client.users.list({
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
      const response = await this.client.users.info({ user: userId })
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
      const response = await this.client.chat.update({ channel, ts, text })
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
      const response = await this.client.conversations.replies({
        channel,
        ts,
        limit: options?.limit || 100,
        cursor: options?.cursor,
      })
      this.checkResponse(response)

      return (response.messages || []).map((msg: any) => ({
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
      }))
    })
  }

  async joinChannel(channel: string): Promise<void> {
    return this.withRetry(async () => {
      const response = await this.client.conversations.join({ channel })
      this.checkResponse(response)
    })
  }

  async deleteMessage(channel: string, ts: string): Promise<void> {
    return this.withRetry(async () => {
      const response = await this.client.chat.delete({ channel, ts })
      this.checkResponse(response)
    })
  }
}
