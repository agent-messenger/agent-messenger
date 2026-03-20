import type { FBMessengerBotPage, FBMessengerBotSendMessageResponse } from './types'
import { FBMessengerBotError as FBMessengerBotErrorClass } from './types'

const BASE_URL = 'https://graph.facebook.com/v23.0'
const MAX_RETRIES = 3
const BASE_BACKOFF_MS = 100

interface MetaGraphApiErrorBody {
  error?: {
    message?: string
    code?: number
  }
}

export class FBMessengerBotClient {
  private pageId: string
  private accessToken: string

  constructor(pageId: string, accessToken: string) {
    if (!pageId) {
      throw new FBMessengerBotErrorClass('Page ID is required', 'missing_page_id')
    }
    if (!accessToken) {
      throw new FBMessengerBotErrorClass('Access token is required', 'missing_access_token')
    }
    this.pageId = pageId
    this.accessToken = accessToken
  }

  async getPageInfo(): Promise<FBMessengerBotPage> {
    return this.request<FBMessengerBotPage>('GET', `/${this.pageId}?fields=name,id`)
  }

  async sendMessage(
    recipientId: string,
    text: string,
    messagingType: 'RESPONSE' | 'UPDATE' | 'MESSAGE_TAG' = 'RESPONSE',
  ): Promise<FBMessengerBotSendMessageResponse> {
    return this.request<FBMessengerBotSendMessageResponse>('POST', `/${this.pageId}/messages`, {
      recipient: { id: recipientId },
      message: { text },
      messaging_type: messagingType,
    })
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    }
  }

  private async request<T>(method: string, path: string, body?: unknown, unwrapKey?: string): Promise<T> {
    const url = `${BASE_URL}${path}`
    let lastError: Error | undefined

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
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
        throw new FBMessengerBotErrorClass(`Network error: ${lastError.message}`, 'network_error')
      }

      if (response.status === 429) {
        if (attempt < MAX_RETRIES) {
          const retryAfter = Number.parseFloat(response.headers.get('Retry-After') || '1')
          const retryAfterMs = (Number.isNaN(retryAfter) ? 1 : retryAfter) * 1000
          await this.sleep(retryAfterMs)
          continue
        }
        throw new FBMessengerBotErrorClass('Rate limited', 'rate_limited')
      }

      if (response.status >= 500 && response.status <= 599) {
        if (attempt < MAX_RETRIES && method === 'GET') {
          await this.sleep(BASE_BACKOFF_MS * 2 ** attempt)
          continue
        }

        const errorBody = (await response.json().catch(() => ({}))) as MetaGraphApiErrorBody
        throw this.createApiError(response.status, errorBody)
      }

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({}))) as MetaGraphApiErrorBody
        throw this.createApiError(response.status, errorBody)
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

    throw lastError || new FBMessengerBotErrorClass('Request failed after retries', 'max_retries')
  }

  private createApiError(status: number, body: MetaGraphApiErrorBody): FBMessengerBotErrorClass {
    const message = body.error?.message || `HTTP ${status}`
    const code = body.error?.code !== undefined ? String(body.error.code) : `http_${status}`
    return new FBMessengerBotErrorClass(message, code)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
