import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import type { TeamsChannel, TeamsFile, TeamsMessage, TeamsTeam, TeamsUser } from './types'
import { TeamsError } from './types'

interface RateLimitBucket {
  remaining: number
  resetAt: number
}

const MSG_API_BASE = 'https://emea.ng.msg.teams.microsoft.com/v1'
const CSA_API_BASE = 'https://teams.microsoft.com/api'
const MAX_RETRIES = 3
const BASE_BACKOFF_MS = 100

export class TeamsClient {
  private token: string
  private tokenExpiresAt?: Date
  private buckets: Map<string, RateLimitBucket> = new Map()
  private globalRateLimitUntil: number = 0

  constructor(token: string, tokenExpiresAt?: string) {
    if (!token) {
      throw new TeamsError('Token is required', 'missing_token')
    }
    this.token = token
    if (tokenExpiresAt) {
      this.tokenExpiresAt = new Date(tokenExpiresAt)
    }
  }

  private isTokenExpired(): boolean {
    if (!this.tokenExpiresAt) {
      return false
    }
    return this.tokenExpiresAt.getTime() < Date.now()
  }

  private getBucketKey(method: string, path: string): string {
    const normalized = path
      .replace(/\/teams\/[^/]+/, '/teams/{team_id}')
      .replace(/\/channels\/[^/]+/, '/channels/{channel_id}')
      .replace(/\/messages\/[^/]+/, '/messages/{message_id}')
      .replace(/\/users\/[^/]+/, '/users/{user_id}')
      .replace(/\/members\/[^/]+/, '/members/{member_id}')
    return `${method}:${normalized}`
  }

  private async waitForRateLimit(bucketKey: string): Promise<void> {
    const now = Date.now()

    if (this.globalRateLimitUntil > now) {
      await this.sleep(this.globalRateLimitUntil - now)
    }

    const bucket = this.buckets.get(bucketKey)
    if (bucket && bucket.remaining === 0 && bucket.resetAt * 1000 > now) {
      await this.sleep(bucket.resetAt * 1000 - now)
    }
  }

  private updateBucket(bucketKey: string, response: Response): void {
    const remaining = response.headers.get('X-RateLimit-Remaining')
    const reset = response.headers.get('X-RateLimit-Reset')

    if (remaining !== null && reset !== null) {
      this.buckets.set(bucketKey, {
        remaining: parseInt(remaining, 10),
        resetAt: parseFloat(reset),
      })
    }
  }

  private async handleRateLimitResponse(response: Response): Promise<number> {
    const retryAfter = response.headers.get('Retry-After')
    const waitMs = parseFloat(retryAfter || '1') * 1000

    this.globalRateLimitUntil = Date.now() + waitMs
    await this.sleep(waitMs)
    return waitMs
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private async request<T>(method: string, path: string, body?: unknown, baseUrl: string = MSG_API_BASE): Promise<T> {
    if (this.isTokenExpired()) {
      throw new TeamsError('Token has expired. Run "auth extract" to refresh.', 'token_expired')
    }

    const url = `${baseUrl}${path}`
    const bucketKey = this.getBucketKey(method, path)

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      await this.waitForRateLimit(bucketKey)

      const headers: Record<string, string> = {
        'X-Skypetoken': this.token,
        'Content-Type': 'application/json',
      }

      const options: RequestInit = {
        method,
        headers,
      }

      if (body !== undefined) {
        options.body = JSON.stringify(body)
      }

      const response = await fetch(url, options)
      this.updateBucket(bucketKey, response)

      if (response.status === 429) {
        if (attempt < MAX_RETRIES) {
          await this.handleRateLimitResponse(response)
          continue
        }
        const errorBody = (await response.json().catch(() => null)) as {
          message?: string
        } | null
        throw new TeamsError(errorBody?.message ?? 'Rate limited', 'rate_limited')
      }

      if (response.status >= 500 && attempt < MAX_RETRIES) {
        await this.sleep(BASE_BACKOFF_MS * 2 ** attempt)
        continue
      }

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as {
          message?: string
          code?: string | number
        } | null
        throw new TeamsError(
          errorBody?.message ?? `HTTP ${response.status}`,
          errorBody?.code?.toString() ?? `http_${response.status}`,
        )
      }

      if (response.status === 204) {
        return undefined as T
      }

      return response.json() as Promise<T>
    }

    throw new TeamsError('Request failed after retries', 'max_retries')
  }

  private async requestFormData<T>(path: string, formData: FormData, baseUrl: string = MSG_API_BASE): Promise<T> {
    if (this.isTokenExpired()) {
      throw new TeamsError('Token has expired. Run "auth extract" to refresh.', 'token_expired')
    }

    const url = `${baseUrl}${path}`
    const bucketKey = this.getBucketKey('POST', path)

    await this.waitForRateLimit(bucketKey)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Skypetoken': this.token,
      },
      body: formData,
    })

    this.updateBucket(bucketKey, response)

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => null)) as {
        message?: string
        code?: string | number
      } | null
      throw new TeamsError(
        errorBody?.message ?? `HTTP ${response.status}`,
        errorBody?.code?.toString() ?? `http_${response.status}`,
      )
    }

    return response.json() as Promise<T>
  }

  async testAuth(): Promise<TeamsUser> {
    interface UserProperties {
      userDetails?: string
      locale?: string
    }
    const props = await this.request<UserProperties>('GET', '/users/ME/properties')
    const userDetails = props.userDetails ? JSON.parse(props.userDetails) : {}
    return {
      id: 'ME',
      displayName: userDetails.name || 'Teams User',
    }
  }

  async listTeams(): Promise<TeamsTeam[]> {
    interface Conversation {
      id: string
      threadProperties?: {
        groupId?: string
        spaceThreadTopic?: string
        productThreadType?: string
        threadType?: string
      }
    }
    interface ConversationsResponse {
      conversations: Conversation[]
    }
    const data = await this.request<ConversationsResponse>('GET', '/users/ME/conversations')

    const teamsMap = new Map<string, TeamsTeam>()
    for (const conv of data.conversations) {
      const tp = conv.threadProperties
      if (!tp?.groupId) continue
      if (!tp.productThreadType?.includes('Teams') && tp.threadType !== 'space') continue

      if (!teamsMap.has(tp.groupId)) {
        teamsMap.set(tp.groupId, {
          id: tp.groupId,
          name: tp.spaceThreadTopic || 'Unknown Team',
        })
      }
    }

    return Array.from(teamsMap.values())
  }

  async getTeam(teamId: string): Promise<TeamsTeam> {
    return this.request<TeamsTeam>('GET', `/csa/api/v1/teams/${teamId}`, undefined, CSA_API_BASE)
  }

  async listChannels(teamId: string): Promise<TeamsChannel[]> {
    return this.request<TeamsChannel[]>('GET', `/csa/api/v1/teams/${teamId}/channels`, undefined, CSA_API_BASE)
  }

  async getChannel(teamId: string, channelId: string): Promise<TeamsChannel> {
    return this.request<TeamsChannel>(
      'GET',
      `/csa/api/v1/teams/${teamId}/channels/${channelId}`,
      undefined,
      CSA_API_BASE,
    )
  }

  async sendMessage(teamId: string, channelId: string, content: string): Promise<TeamsMessage> {
    return this.request<TeamsMessage>(
      'POST',
      `/csa/emea/api/v2/teams/${teamId}/channels/${channelId}/messages`,
      { content },
      CSA_API_BASE,
    )
  }

  async getMessages(teamId: string, channelId: string, limit: number = 50): Promise<TeamsMessage[]> {
    return this.request<TeamsMessage[]>(
      'GET',
      `/csa/emea/api/v2/teams/${teamId}/channels/${channelId}/messages?limit=${limit}`,
      undefined,
      CSA_API_BASE,
    )
  }

  async getMessage(teamId: string, channelId: string, messageId: string): Promise<TeamsMessage> {
    return this.request<TeamsMessage>(
      'GET',
      `/csa/emea/api/v2/teams/${teamId}/channels/${channelId}/messages/${messageId}`,
      undefined,
      CSA_API_BASE,
    )
  }

  async deleteMessage(teamId: string, channelId: string, messageId: string): Promise<void> {
    return this.request<void>(
      'DELETE',
      `/csa/emea/api/v2/teams/${teamId}/channels/${channelId}/messages/${messageId}`,
      undefined,
      CSA_API_BASE,
    )
  }

  async addReaction(teamId: string, channelId: string, messageId: string, emoji: string): Promise<void> {
    return this.request<void>(
      'POST',
      `/csa/emea/api/v2/teams/${teamId}/channels/${channelId}/messages/${messageId}/reactions`,
      { emoji },
      CSA_API_BASE,
    )
  }

  async removeReaction(teamId: string, channelId: string, messageId: string, emoji: string): Promise<void> {
    return this.request<void>(
      'DELETE',
      `/csa/emea/api/v2/teams/${teamId}/channels/${channelId}/messages/${messageId}/reactions/${emoji}`,
      undefined,
      CSA_API_BASE,
    )
  }

  async listUsers(teamId: string): Promise<TeamsUser[]> {
    return this.request<TeamsUser[]>('GET', `/csa/api/v1/teams/${teamId}/members`, undefined, CSA_API_BASE)
  }

  async getUser(userId: string): Promise<TeamsUser> {
    return this.request<TeamsUser>('GET', `/csa/api/v1/users/${userId}`, undefined, CSA_API_BASE)
  }

  async uploadFile(teamId: string, channelId: string, filePath: string): Promise<TeamsFile> {
    const fileBuffer = await readFile(filePath)
    const filename = basename(filePath) || 'file'

    const formData = new FormData()
    formData.append('file', new Blob([fileBuffer]), filename)

    return this.requestFormData<TeamsFile>(
      `/csa/emea/api/v2/teams/${teamId}/channels/${channelId}/files`,
      formData,
      CSA_API_BASE,
    )
  }

  async listFiles(teamId: string, channelId: string): Promise<TeamsFile[]> {
    return this.request<TeamsFile[]>(
      'GET',
      `/csa/emea/api/v2/teams/${teamId}/channels/${channelId}/files`,
      undefined,
      CSA_API_BASE,
    )
  }
}
