import type { WebexMembership, WebexMessage, WebexPerson, WebexSpace } from './types'
import { WebexError } from './types'
import { WebexCredentialManager } from './credential-manager'

const BASE_URL = 'https://webexapis.com/v1'
const MAX_RETRIES = 3
const BASE_BACKOFF_MS = 100

interface RateLimitBucket {
  remaining: number
  resetAt: number
}

export class WebexClient {
  private token: string | null = null
  private deviceUrl: string | null = null
  private tokenType: string | null = null
  private buckets: Map<string, RateLimitBucket> = new Map()
  private globalRateLimitUntil: number = 0

  async login(credentials?: { token: string }): Promise<this> {
    if (credentials) {
      if (!credentials.token) {
        throw new WebexError('Token is required', 'missing_token')
      }
      this.token = credentials.token
      return this
    }

    const { ensureWebexAuth } = await import('./ensure-auth')
    await ensureWebexAuth()
    const credManager = new WebexCredentialManager()
    const config = await credManager.loadConfig()
    const token = await credManager.getToken(config?.clientId, config?.clientSecret)
    if (!token) {
      throw new WebexError(
        'No Webex credentials found. Run "auth login" to authenticate.',
        'no_credentials',
      )
    }
    this.deviceUrl = config?.deviceUrl ?? null
    this.tokenType = config?.tokenType ?? null
    return this.login({ token })
  }

  private ensureAuth(): string {
    if (this.token === null) {
      throw new WebexError('Not authenticated. Call .login() first.', 'not_authenticated')
    }
    return this.token
  }

  private getBucketKey(method: string, path: string): string {
    const normalized = path.replace(
      /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi,
      '/{id}',
    )
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

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${BASE_URL}${path}`
    const bucketKey = this.getBucketKey(method, path)

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      await this.waitForRateLimit(bucketKey)

      const options: RequestInit = {
        method,
        headers: {
          Authorization: `Bearer ${this.ensureAuth()}`,
          'Content-Type': 'application/json',
        },
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
        throw new WebexError(errorBody?.message ?? 'Rate limited', 'rate_limited')
      }

      if (response.status >= 500 && attempt < MAX_RETRIES) {
        await this.sleep(BASE_BACKOFF_MS * 2 ** attempt)
        continue
      }

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as {
          message?: string
          errors?: Array<{ description: string }>
          trackingId?: string
        } | null
        const message =
          errorBody?.message ??
          errorBody?.errors?.[0]?.description ??
          `HTTP ${response.status}`
        throw new WebexError(message, `http_${response.status}`)
      }

      if (response.status === 204) {
        return undefined as T
      }

      return response.json() as Promise<T>
    }

    throw new WebexError('Request failed after retries', 'max_retries')
  }

  async testAuth(): Promise<WebexPerson> {
    return this.request<WebexPerson>('GET', '/people/me')
  }

  async listSpaces(options?: { type?: string; max?: number }): Promise<WebexSpace[]> {
    const params = new URLSearchParams()
    if (options?.type) params.set('type', options.type)
    params.set('max', String(options?.max ?? 50))
    const query = params.toString()
    const data = await this.request<{ items: WebexSpace[] }>('GET', `/rooms?${query}`)
    return data.items
  }

  async getSpace(spaceId: string): Promise<WebexSpace> {
    return this.request<WebexSpace>('GET', `/rooms/${spaceId}`)
  }

  async sendMessage(
    roomId: string,
    text: string,
    options?: { markdown?: boolean },
  ): Promise<WebexMessage> {
    if (this.useInternalAPI) {
      return this.sendMessageInternal(roomId, text)
    }
    const body = options?.markdown ? { roomId, markdown: text } : { roomId, text }
    return this.request<WebexMessage>('POST', '/messages', body)
  }

  private get useInternalAPI(): boolean {
    return this.tokenType === 'extracted' && this.deviceUrl !== null
  }

  private get convBaseUrl(): string {
    const match = this.deviceUrl?.match(/wdm(-[a-z0-9]+)\.wbx2\.com/)
    return `https://conv${match?.[1] ?? ''}.wbx2.com/conversation/api/v1`
  }

  private get internalHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.ensureAuth()}`,
      'Content-Type': 'application/json',
      'cisco-device-url': this.deviceUrl!,
    }
  }

  private decodeConvUuid(roomId: string): string {
    return Buffer.from(roomId, 'base64').toString('utf8').split('/').pop() ?? roomId
  }

  private async internalRequest<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.convBaseUrl}${path}`, {
      ...init,
      headers: { ...this.internalHeaders, ...init?.headers as Record<string, string> },
    })

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => null)) as { message?: string } | null
      throw new WebexError(
        errorBody?.message ?? `HTTP ${response.status}`,
        `http_${response.status}`,
      )
    }

    if (response.status === 204) return undefined as T
    return response.json() as Promise<T>
  }

  private activityToMessage(a: InternalActivity, roomId: string): WebexMessage {
    return {
      id: a.id,
      roomId,
      roomType: 'group' as const,
      text: a.object?.content ?? a.object?.displayName,
      personId: a.actor?.entryUUID ?? a.actor?.id ?? '',
      personEmail: a.actor?.emailAddress ?? '',
      created: a.published,
    }
  }

  private async sendMessageInternal(roomId: string, text: string): Promise<WebexMessage> {
    const convUuid = this.decodeConvUuid(roomId)
    const result = await this.internalRequest<InternalActivity>('/activities', {
      method: 'POST',
      body: JSON.stringify({
        verb: 'post',
        object: { objectType: 'comment', displayName: text, content: text },
        target: { id: convUuid, objectType: 'conversation' },
        clientTempId: `tmp-${Date.now()}`,
      }),
    })
    return this.activityToMessage(result, roomId)
  }

  async sendDirectMessage(
    personEmail: string,
    text: string,
    options?: { markdown?: boolean },
  ): Promise<WebexMessage> {
    const body = options?.markdown
      ? { toPersonEmail: personEmail, markdown: text }
      : { toPersonEmail: personEmail, text }
    return this.request<WebexMessage>('POST', '/messages', body)
  }

  async listMessages(roomId: string, options?: { max?: number }): Promise<WebexMessage[]> {
    if (this.useInternalAPI) {
      const convUuid = this.decodeConvUuid(roomId)
      const max = options?.max ?? 50
      const conv = await this.internalRequest<InternalConversation>(
        `/conversations/${convUuid}?activitiesLimit=${max}&participantsLimit=0`,
      )
      return (conv.activities?.items ?? [])
        .filter((a) => a.verb === 'post')
        .map((a) => this.activityToMessage(a, roomId))
    }
    const params = new URLSearchParams()
    params.set('roomId', roomId)
    params.set('max', String(options?.max ?? 50))
    const data = await this.request<{ items: WebexMessage[] }>('GET', `/messages?${params}`)
    return data.items
  }

  async getMessage(messageId: string): Promise<WebexMessage> {
    if (this.useInternalAPI) {
      const activity = await this.internalRequest<InternalActivity>(`/activities/${messageId}`)
      return this.activityToMessage(activity, '')
    }
    return this.request<WebexMessage>('GET', `/messages/${messageId}`)
  }

  async deleteMessage(messageId: string): Promise<void> {
    if (this.useInternalAPI) {
      const activity = await this.internalRequest<InternalActivity>(`/activities/${messageId}`)
      const convId = activity.target?.id
      if (!convId) throw new WebexError('Cannot determine conversation for activity', 'internal_error')
      await this.internalRequest<unknown>('/activities', {
        method: 'POST',
        body: JSON.stringify({
          verb: 'delete',
          object: { id: messageId, objectType: 'activity' },
          target: { id: convId, objectType: 'conversation' },
        }),
      })
      return
    }
    return this.request<void>('DELETE', `/messages/${messageId}`)
  }

  async editMessage(
    messageId: string,
    roomId: string,
    text: string,
    options?: { markdown?: boolean },
  ): Promise<WebexMessage> {
    const body = options?.markdown ? { roomId, markdown: text } : { roomId, text }
    return this.request<WebexMessage>('PUT', `/messages/${messageId}`, body)
  }

  async listPeople(options?: {
    email?: string
    displayName?: string
    max?: number
  }): Promise<WebexPerson[]> {
    const params = new URLSearchParams()
    if (options?.email) params.set('email', options.email)
    if (options?.displayName) params.set('displayName', options.displayName)
    if (options?.max) params.set('max', String(options.max))
    const query = params.toString()
    const path = query ? `/people?${query}` : '/people'
    const data = await this.request<{ items: WebexPerson[] }>('GET', path)
    return data.items
  }

  async listMemberships(
    roomId: string,
    options?: { max?: number },
  ): Promise<WebexMembership[]> {
    const params = new URLSearchParams()
    params.set('roomId', roomId)
    if (options?.max) params.set('max', String(options.max))
    const data = await this.request<{ items: WebexMembership[] }>(
      'GET',
      `/memberships?${params}`,
    )
    return data.items
  }
}

interface InternalActivity {
  id: string
  verb: string
  actor?: { displayName?: string; emailAddress?: string; entryUUID?: string; id?: string }
  object?: { content?: string; displayName?: string; objectType?: string }
  target?: { id: string }
  published: string
}

interface InternalConversation {
  id: string
  activities?: { items: InternalActivity[] }
}
