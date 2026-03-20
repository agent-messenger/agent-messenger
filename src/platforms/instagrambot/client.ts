import type { InstagramBotPageInfo, InstagramBotSendMessageResponse } from './types'
import { InstagramBotError as InstagramBotErrorClass } from './types'

const BASE_URL = 'https://graph.facebook.com/v23.0'
const MAX_RETRIES = 3
const BASE_BACKOFF_MS = 100

interface GraphApiErrorResponse {
  error?: {
    message?: string
    type?: string
    code?: number
    fbtrace_id?: string
  }
}

export class InstagramBotClient {
  private pageId: string
  private accessToken: string
  private rateLimitResetAt: number = 0

  constructor(pageId: string, accessToken: string) {
    if (!pageId) {
      throw new InstagramBotErrorClass('Page ID is required', 'missing_page_id')
    }
    if (!accessToken) {
      throw new InstagramBotErrorClass('Access token is required', 'missing_access_token')
    }
    this.pageId = pageId
    this.accessToken = accessToken
  }

  async getPageInfo(pageId = this.pageId): Promise<InstagramBotPageInfo> {
    return this.request<InstagramBotPageInfo>('GET', `/${pageId}?fields=instagram_business_account,name`)
  }

  async sendMessage(recipientId: string, text: string): Promise<InstagramBotSendMessageResponse> {
    return this.request<InstagramBotSendMessageResponse>('POST', `/${this.pageId}/messages`, {
      recipient: { id: recipientId },
      message: { text },
    })
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    }
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now()
    if (this.rateLimitResetAt > now) {
      await this.sleep(this.rateLimitResetAt - now)
    }
  }

  private updateRateLimit(response: Response): void {
    if (response.status !== 429) {
      this.rateLimitResetAt = 0
      return
    }

    const retryAfter = Number.parseFloat(response.headers.get('Retry-After') || '1')
    const retryAfterMs = (Number.isNaN(retryAfter) ? 1 : retryAfter) * 1000
    this.rateLimitResetAt = Date.now() + retryAfterMs
  }

  private async request<T>(method: string, path: string, body?: unknown, unwrapKey?: string): Promise<T> {
    const url = `${BASE_URL}${path}`
    let lastError: Error | undefined

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      await this.waitForRateLimit()

      const options: RequestInit = {
        method,
        headers: this.getHeaders(),
      }

      if (body !== undefined) {
        options.body = JSON.stringify(body)
      }

      let response: Response

      try {
        response = await fetch(url, options)
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        if (attempt < MAX_RETRIES && method === 'GET') {
          await this.sleep(BASE_BACKOFF_MS * 2 ** attempt)
          continue
        }
        throw new InstagramBotErrorClass(`Network error: ${lastError.message}`, 'network_error')
      }

      this.updateRateLimit(response)

      if (response.status === 429) {
        if (attempt < MAX_RETRIES) {
          const retryAfter = Number.parseFloat(response.headers.get('Retry-After') || '1')
          const retryAfterMs = (Number.isNaN(retryAfter) ? 1 : retryAfter) * 1000
          await this.sleep(retryAfterMs)
          continue
        }
        throw new InstagramBotErrorClass('Rate limited', 'rate_limited')
      }

      if (response.status >= 500 && response.status <= 599) {
        if (attempt < MAX_RETRIES && method === 'GET') {
          await this.sleep(BASE_BACKOFF_MS * 2 ** attempt)
          continue
        }

        const errorBody = (await response.json().catch(() => ({}))) as GraphApiErrorResponse
        throw this.createApiError(errorBody, response.status)
      }

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({}))) as GraphApiErrorResponse
        throw this.createApiError(errorBody, response.status)
      }

      if (response.status === 204) {
        return undefined as T
      }

      const data = await response.json()
      if (unwrapKey && data != null && typeof data === 'object' && unwrapKey in data) {
        return (data as Record<string, unknown>)[unwrapKey] as T
      }
      return data as T
    }

    throw lastError || new InstagramBotErrorClass('Request failed after retries', 'max_retries')
  }

  private createApiError(errorBody: GraphApiErrorResponse, status: number): InstagramBotErrorClass {
    const message = errorBody.error?.message || `HTTP ${status}`
    const code = errorBody.error?.code != null ? String(errorBody.error.code) : `http_${status}`
    return new InstagramBotErrorClass(message, code)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
