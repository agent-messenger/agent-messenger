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
    if (this.tokenType === 'extracted' && this.deviceUrl) {
      return this.sendMessageViaConversationAPI(roomId, text)
    }
    const body = options?.markdown ? { roomId, markdown: text } : { roomId, text }
    return this.request<WebexMessage>('POST', '/messages', body)
  }

  private async sendMessageViaConversationAPI(roomId: string, text: string): Promise<WebexMessage> {
    const token = this.ensureAuth()

    const decodedRoomId = Buffer.from(roomId, 'base64').toString('utf8')
    const convUuid = decodedRoomId.split('/').pop() ?? roomId

    const clusterSuffixMatch = this.deviceUrl!.match(/wdm(-[a-z0-9]+)\.wbx2\.com/)
    const clusterSuffix = clusterSuffixMatch?.[1] ?? ''
    const convBaseUrl = `https://conv${clusterSuffix}.wbx2.com/conversation/api/v1`

    const activity = {
      verb: 'post',
      object: { objectType: 'comment', displayName: text, content: text },
      target: { id: convUuid, objectType: 'conversation' },
      clientTempId: `tmp-${Date.now()}`,
    }

    const response = await fetch(`${convBaseUrl}/activities`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'cisco-device-url': this.deviceUrl!,
      },
      body: JSON.stringify(activity),
    })

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => null)) as { message?: string } | null
      throw new WebexError(
        errorBody?.message ?? `HTTP ${response.status}`,
        `http_${response.status}`,
      )
    }

    const result = (await response.json()) as {
      id: string
      actor: { displayName: string; emailAddress: string; entryUUID?: string; id?: string }
      object: { content?: string; displayName?: string }
      target: { id: string }
      published: string
    }

    return {
      id: result.id,
      roomId,
      roomType: 'group' as const,
      text: result.object.content ?? result.object.displayName,
      personId: result.actor.entryUUID ?? result.actor.id ?? '',
      personEmail: result.actor.emailAddress,
      created: result.published,
    }
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
    const params = new URLSearchParams()
    params.set('roomId', roomId)
    params.set('max', String(options?.max ?? 50))
    const data = await this.request<{ items: WebexMessage[] }>('GET', `/messages?${params}`)
    return data.items
  }

  async getMessage(messageId: string): Promise<WebexMessage> {
    return this.request<WebexMessage>('GET', `/messages/${messageId}`)
  }

  async deleteMessage(messageId: string): Promise<void> {
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
