import { HTTPFetchError, messagingApi } from '@line/bot-sdk'

import type {
  LineBotBotInfo,
  LineBotGroupMembersIds,
  LineBotGroupSummary,
  LineBotProfile,
  LineBotPushResponse,
  LineBotTextMessage,
} from './types'
import {
  LineBotBotInfoSchema,
  LineBotError,
  LineBotGroupMembersIdsSchema,
  LineBotGroupSummarySchema,
  LineBotProfileSchema,
  LineBotPushResponseSchema,
} from './types'

const MAX_RETRIES = 3
const BASE_BACKOFF_MS = 100

export class LineBotClient {
  private client: messagingApi.MessagingApiClient
  private rateLimitResetAt = 0

  constructor(channelAccessToken: string) {
    if (!channelAccessToken) {
      throw new LineBotError('Channel access token is required', 'missing_channel_access_token')
    }

    this.client = new messagingApi.MessagingApiClient({ channelAccessToken })
  }

  async getBotInfo(): Promise<LineBotBotInfo> {
    const response = await this.request(() => this.client.getBotInfo(), 'getBotInfo')
    return LineBotBotInfoSchema.parse(response)
  }

  async pushMessage(to: string, messages: LineBotTextMessage[]): Promise<LineBotPushResponse> {
    this.validateMessages(messages)
    const response = await this.request(
      () => this.client.pushMessage({ to, messages }),
      'pushMessage',
    )
    return LineBotPushResponseSchema.parse(response)
  }

  async broadcast(messages: LineBotTextMessage[]): Promise<LineBotPushResponse> {
    this.validateMessages(messages)
    const response = await this.request(
      () => this.client.broadcast({ messages }),
      'broadcast',
    )
    return LineBotPushResponseSchema.parse(response)
  }

  async getProfile(userId: string): Promise<LineBotProfile> {
    const response = await this.request(() => this.client.getProfile(userId), 'getProfile')
    return LineBotProfileSchema.parse(response)
  }

  async getGroupSummary(groupId: string): Promise<LineBotGroupSummary> {
    const response = await this.request(() => this.client.getGroupSummary(groupId), 'getGroupSummary')
    return LineBotGroupSummarySchema.parse(response)
  }

  async getGroupMembersIds(groupId: string, start?: string): Promise<LineBotGroupMembersIds> {
    const response = await this.request(
      () => this.client.getGroupMembersIds(groupId, start),
      'getGroupMembersIds',
    )
    return LineBotGroupMembersIdsSchema.parse(response)
  }

  private async request<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    let lastError: Error | undefined

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      await this.waitForRateLimit()

      try {
        return await operation()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        if (error instanceof HTTPFetchError) {
          if (error.status === 429) {
            const retryAfterMs = this.getRetryAfterMs(error.headers)
            this.rateLimitResetAt = Date.now() + retryAfterMs

            if (attempt < MAX_RETRIES) {
              await this.sleep(retryAfterMs)
              continue
            }

            throw new LineBotError('Rate limited', 'rate_limited')
          }

          if (error.status >= 500 && error.status <= 599 && attempt < MAX_RETRIES) {
            await this.sleep(BASE_BACKOFF_MS * 2 ** attempt)
            continue
          }

          throw new LineBotError(this.getHttpErrorMessage(error), `http_${error.status}`)
        }

        if (attempt < MAX_RETRIES) {
          await this.sleep(BASE_BACKOFF_MS * 2 ** attempt)
          continue
        }

        throw new LineBotError(`${operationName} failed: ${lastError.message}`, 'request_failed')
      }
    }

    throw lastError ?? new LineBotError('Request failed after retries', 'max_retries')
  }

  private validateMessages(messages: LineBotTextMessage[]): void {
    if (messages.length === 0) {
      throw new LineBotError('At least one message is required', 'missing_messages')
    }

    if (messages.length > 5) {
      throw new LineBotError('LINE supports at most 5 messages per request', 'too_many_messages')
    }
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now()
    if (this.rateLimitResetAt > now) {
      await this.sleep(this.rateLimitResetAt - now)
    }
  }

  private getRetryAfterMs(headers: Headers): number {
    const retryAfter = Number.parseFloat(headers.get('Retry-After') || '1')
    const seconds = Number.isNaN(retryAfter) ? 1 : retryAfter
    return seconds * 1000
  }

  private getHttpErrorMessage(error: HTTPFetchError): string {
    try {
      const parsed = JSON.parse(error.body) as { message?: string }
      return parsed.message || `HTTP ${error.status}`
    } catch {
      return error.body || `HTTP ${error.status}`
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
