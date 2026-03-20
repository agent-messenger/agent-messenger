import type { WhatsAppBusinessProfile, WhatsAppSendMessageResponse } from './types'
import { WhatsAppBotError as WhatsAppBotErrorClass } from './types'

const BASE_URL = 'https://graph.facebook.com/v23.0'
const MAX_RETRIES = 3
const BASE_BACKOFF_MS = 100

interface GraphApiErrorResponse {
  error?: {
    message?: string
    code?: number
    error_subcode?: number
  }
}

export class WhatsAppBotClient {
  private phoneNumberId: string
  private accessToken: string
  private rateLimitRemaining: number | null = null
  private rateLimitResetAt = 0

  constructor(phoneNumberId: string, accessToken: string) {
    if (!phoneNumberId) {
      throw new WhatsAppBotErrorClass('Phone number ID is required', 'missing_phone_number_id')
    }
    if (!accessToken) {
      throw new WhatsAppBotErrorClass('Access token is required', 'missing_access_token')
    }

    this.phoneNumberId = phoneNumberId
    this.accessToken = accessToken
  }

  async getBusinessProfile(): Promise<WhatsAppBusinessProfile> {
    const response = await this.request<{ data: WhatsAppBusinessProfile[] }>(
      'GET',
      `/${this.phoneNumberId}/whatsapp_business_profile`,
    )

    return response.data[0] ?? {}
  }

  async sendTextMessage(to: string, text: string): Promise<WhatsAppSendMessageResponse> {
    return this.request<WhatsAppSendMessageResponse>('POST', `/${this.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body: text },
    })
  }

  async sendTemplateMessage(to: string, templateName: string, language: string): Promise<WhatsAppSendMessageResponse> {
    return this.request<WhatsAppSendMessageResponse>('POST', `/${this.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: language },
      },
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
    if (this.rateLimitRemaining === 0 && this.rateLimitResetAt > now) {
      await this.sleep(this.rateLimitResetAt - now)
    }
  }

  private updateRateLimit(response: Response): void {
    const remainingHeader = response.headers.get('x-ratelimit-remaining')
    const resetHeader = response.headers.get('x-ratelimit-reset')
    const retryAfterHeader = response.headers.get('Retry-After')

    if (remainingHeader !== null) {
      const remaining = Number.parseInt(remainingHeader, 10)
      if (!Number.isNaN(remaining)) {
        this.rateLimitRemaining = remaining
      }
    }

    if (resetHeader !== null) {
      const reset = Number.parseFloat(resetHeader)
      if (!Number.isNaN(reset)) {
        this.rateLimitResetAt = reset > 1_000_000_000_000 ? reset : reset * 1000
      }
    }

    if (retryAfterHeader !== null) {
      const retryAfter = Number.parseFloat(retryAfterHeader)
      if (!Number.isNaN(retryAfter)) {
        this.rateLimitRemaining = 0
        this.rateLimitResetAt = Date.now() + retryAfter * 1000
      }
    }
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
        throw new WhatsAppBotErrorClass(`Network error: ${lastError.message}`, 'network_error')
      }

      this.updateRateLimit(response)

      const responseBody = await this.parseJson(response)
      const graphError = this.getGraphError(responseBody)
      const isThrottleError = response.status === 429 || graphError?.code === 4 || graphError?.error_subcode === 130429

      if (isThrottleError) {
        if (attempt < MAX_RETRIES) {
          const retryAfter = Number.parseFloat(response.headers.get('Retry-After') || '1')
          const retryAfterMs = (Number.isNaN(retryAfter) ? 1 : retryAfter) * 1000
          this.rateLimitRemaining = 0
          this.rateLimitResetAt = Date.now() + retryAfterMs
          await this.sleep(retryAfterMs)
          continue
        }
        throw new WhatsAppBotErrorClass(graphError?.message || 'Rate limited', 'rate_limited')
      }

      if (response.status >= 500 && response.status <= 599) {
        if (attempt < MAX_RETRIES && method === 'GET') {
          await this.sleep(BASE_BACKOFF_MS * 2 ** attempt)
          continue
        }

        throw new WhatsAppBotErrorClass(
          graphError?.message || `HTTP ${response.status}`,
          this.getErrorCode(graphError, response.status),
        )
      }

      if (!response.ok) {
        throw new WhatsAppBotErrorClass(
          graphError?.message || `HTTP ${response.status}`,
          this.getErrorCode(graphError, response.status),
        )
      }

      if (response.status === 204) {
        return undefined as T
      }

      if (unwrapKey && responseBody != null && typeof responseBody === 'object' && unwrapKey in responseBody) {
        return responseBody[unwrapKey] as T
      }

      return responseBody as T
    }

    throw lastError || new WhatsAppBotErrorClass('Request failed after retries', 'max_retries')
  }

  private async parseJson(response: Response): Promise<Record<string, unknown>> {
    const text = await response.text()
    if (!text) {
      return {}
    }

    try {
      const parsed: unknown = JSON.parse(text)
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, unknown>
      }
      return {}
    } catch {
      return {}
    }
  }

  private getGraphError(body: Record<string, unknown>): GraphApiErrorResponse['error'] {
    const parsed = body as GraphApiErrorResponse
    return parsed.error
  }

  private getErrorCode(error: GraphApiErrorResponse['error'], status: number): string {
    if (error?.error_subcode != null) {
      return String(error.error_subcode)
    }
    if (error?.code != null) {
      return String(error.code)
    }
    return `http_${status}`
  }

  private buildPath(path: string, params?: Record<string, string | number | undefined>): string {
    if (!params) {
      return path
    }

    const searchParams = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        searchParams.set(key, String(value))
      }
    }

    const query = searchParams.toString()
    if (!query) {
      return path
    }

    return `${path}?${query}`
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
