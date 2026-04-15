import { WebexCredentialManager } from './credential-manager'
import { WebexEncryptionService } from './encryption'
import { markdownToHtml, stripMarkdown } from './markdown-to-html'
import type { WebexMembership, WebexMessage, WebexPerson, WebexSpace } from './types'
import { WebexError } from './types'

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
  private encryption: WebexEncryptionService | null = null

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
      throw new WebexError('No Webex credentials found. Run "auth login" to authenticate.', 'no_credentials')
    }
    this.deviceUrl = config?.deviceUrl ?? null
    this.tokenType = config?.tokenType ?? null
    await this.login({ token })

    if (this.tokenType === 'extracted' && config?.encryptionKeys) {
      const keysMap = new Map(Object.entries(config.encryptionKeys))
      if (keysMap.size > 0) {
        this.encryption = new WebexEncryptionService(keysMap)
      }
    }

    return this
  }

  private ensureAuth(): string {
    if (this.token === null) {
      throw new WebexError('Not authenticated. Call .login() first.', 'not_authenticated')
    }
    return this.token
  }

  private getBucketKey(method: string, path: string): string {
    const normalized = path.replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi, '/{id}')
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
        const message = errorBody?.message ?? errorBody?.errors?.[0]?.description ?? `HTTP ${response.status}`
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

  async sendMessage(roomId: string, text: string, options?: { markdown?: boolean }): Promise<WebexMessage> {
    if (this.useInternalAPI) {
      return this.sendMessageInternal(roomId, text, options)
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
      headers: { ...this.internalHeaders, ...(init?.headers as Record<string, string>) },
    })

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => null)) as { message?: string } | null
      throw new WebexError(errorBody?.message ?? `HTTP ${response.status}`, `http_${response.status}`)
    }

    if (response.status === 204) return undefined as T
    return response.json() as Promise<T>
  }

  private async activityToMessage(a: InternalActivity, roomId: string): Promise<WebexMessage> {
    let text = a.object?.displayName ?? a.object?.content

    if (this.encryption && text?.startsWith('eyJ')) {
      const keyUrl = a.encryptionKeyUrl ?? a.object?.encryptionKeyUrl
      if (keyUrl) {
        const decrypted = await this.encryption.decryptText(keyUrl, text)
        if (decrypted !== null) {
          text = decrypted
        }
      }
    }

    return {
      id: a.id,
      roomId,
      roomType: 'group' as const,
      text,
      personId: a.actor?.entryUUID ?? a.actor?.id ?? '',
      personEmail: a.actor?.emailAddress ?? '',
      created: a.published,
    }
  }

  private async buildEncryptedObject(
    convUuid: string,
    text: string,
    options?: { markdown?: boolean },
  ): Promise<{ object: Record<string, string>; encryptionKeyUrl?: string }> {
    const displayName = options?.markdown ? stripMarkdown(text) : text
    const content = options?.markdown ? markdownToHtml(text) : undefined

    if (this.encryption) {
      const conv = await this.internalRequest<InternalConversation>(
        `/conversations/${convUuid}?activitiesLimit=0&participantsLimit=0`,
      )
      const keyUri = conv.defaultActivityEncryptionKeyUrl
      if (keyUri) {
        const encryptedDisplayName = await this.encryption.encryptText(keyUri, displayName)
        const encryptedContent = content ? await this.encryption.encryptText(keyUri, content) : undefined
        if (encryptedDisplayName) {
          const object: Record<string, string> = {
            objectType: 'comment',
            displayName: encryptedDisplayName,
          }
          if (encryptedContent) {
            object.content = encryptedContent
          }
          return { object, encryptionKeyUrl: keyUri }
        }
      }
    }

    const object: Record<string, string> = { objectType: 'comment', displayName }
    if (content) {
      object.content = content
    }
    return { object }
  }

  private async sendMessageInternal(
    roomId: string,
    text: string,
    options?: { markdown?: boolean },
  ): Promise<WebexMessage> {
    const convUuid = this.decodeConvUuid(roomId)
    const { object, encryptionKeyUrl } = await this.buildEncryptedObject(convUuid, text, options)

    const activity: Record<string, unknown> = {
      verb: 'post',
      object,
      target: { id: convUuid, objectType: 'conversation' },
      clientTempId: `tmp-${Date.now()}`,
    }

    if (encryptionKeyUrl) {
      activity['encryptionKeyUrl'] = encryptionKeyUrl
    }

    const result = await this.internalRequest<InternalActivity>('/activities', {
      method: 'POST',
      body: JSON.stringify(activity),
    })
    return this.activityToMessage(result, roomId)
  }

  async sendDirectMessage(personEmail: string, text: string, options?: { markdown?: boolean }): Promise<WebexMessage> {
    if (this.useInternalAPI) {
      const roomId = await this.findDirectRoomByEmail(personEmail)
      if (!roomId) {
        throw new WebexError(`No existing direct conversation with ${personEmail}`, 'not_found')
      }
      return this.sendMessageInternal(roomId, text, options)
    }
    const body = options?.markdown
      ? { toPersonEmail: personEmail, markdown: text }
      : { toPersonEmail: personEmail, text }
    return this.request<WebexMessage>('POST', '/messages', body)
  }

  private async findDirectRoomByEmail(email: string): Promise<string | null> {
    const rooms = await this.request<{ items: WebexSpace[] }>('GET', `/rooms?type=direct&max=100`)
    for (const room of rooms.items) {
      const members = await this.request<{ items: WebexMembership[] }>('GET', `/memberships?roomId=${room.id}&max=10`)
      if (members.items.some((m) => m.personEmail === email)) {
        return room.id
      }
    }
    return null
  }

  async listMessages(roomId: string, options?: { max?: number }): Promise<WebexMessage[]> {
    if (this.useInternalAPI) {
      const convUuid = this.decodeConvUuid(roomId)
      const max = options?.max ?? 50
      const conv = await this.internalRequest<InternalConversation>(
        `/conversations/${convUuid}?activitiesLimit=${max}&participantsLimit=0`,
      )
      const activities = (conv.activities?.items ?? []).filter((a) => a.verb === 'post')
      return Promise.all(activities.map((a) => this.activityToMessage(a, roomId)))
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
      const convId = activity.target?.id ?? ''
      const roomId = convId ? Buffer.from(`ciscospark://urn:TEAM:unknown/ROOM/${convId}`).toString('base64') : ''
      return this.activityToMessage(activity, roomId)
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
    if (this.useInternalAPI) {
      const convUuid = this.decodeConvUuid(roomId)
      const { object, encryptionKeyUrl } = await this.buildEncryptedObject(convUuid, text, options)

      const activity: Record<string, unknown> = {
        verb: 'post',
        object,
        target: { id: convUuid, objectType: 'conversation' },
        parent: { id: messageId, type: 'edit' },
        clientTempId: `tmp-${Date.now()}`,
      }

      if (encryptionKeyUrl) {
        activity['encryptionKeyUrl'] = encryptionKeyUrl
      }

      const result = await this.internalRequest<InternalActivity>('/activities', {
        method: 'POST',
        body: JSON.stringify(activity),
      })
      return this.activityToMessage(result, roomId)
    }
    const body = options?.markdown ? { roomId, markdown: text } : { roomId, text }
    return this.request<WebexMessage>('PUT', `/messages/${messageId}`, body)
  }

  async listPeople(options?: { email?: string; displayName?: string; max?: number }): Promise<WebexPerson[]> {
    const params = new URLSearchParams()
    if (options?.email) params.set('email', options.email)
    if (options?.displayName) params.set('displayName', options.displayName)
    if (options?.max) params.set('max', String(options.max))
    const query = params.toString()
    const path = query ? `/people?${query}` : '/people'
    const data = await this.request<{ items: WebexPerson[] }>('GET', path)
    return data.items
  }

  async listMyMemberships(options?: { max?: number }): Promise<WebexMembership[]> {
    const params = new URLSearchParams()
    params.set('max', String(options?.max ?? 100))
    const data = await this.request<{ items: WebexMembership[] }>('GET', `/memberships?${params}`)
    return data.items
  }

  async listMemberships(roomId: string, options?: { max?: number }): Promise<WebexMembership[]> {
    const params = new URLSearchParams()
    params.set('roomId', roomId)
    if (options?.max) params.set('max', String(options.max))
    const data = await this.request<{ items: WebexMembership[] }>('GET', `/memberships?${params}`)
    return data.items
  }
}

interface InternalActivity {
  id: string
  verb: string
  actor?: { displayName?: string; emailAddress?: string; entryUUID?: string; id?: string }
  object?: {
    content?: string
    displayName?: string
    objectType?: string
    encryptionKeyUrl?: string
  }
  target?: { id: string; encryptionKeyUrl?: string }
  published: string
  encryptionKeyUrl?: string
}

interface InternalConversation {
  id: string
  activities?: { items: InternalActivity[] }
  defaultActivityEncryptionKeyUrl?: string
  kmsResourceObjectUrl?: string
  encryptionKeyUrl?: string
}
