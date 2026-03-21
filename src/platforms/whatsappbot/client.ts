import type { WhatsAppBotMessageResponse, WhatsAppBotTemplate } from './types'
import { WhatsAppBotError } from './types'

const BASE_URL = 'https://graph.facebook.com/v23.0'
const MAX_RETRIES = 3
const BASE_BACKOFF_MS = 100

export class WhatsAppBotClient {
  private phoneNumberId: string
  private accessToken: string
  private rateLimitRemaining: number | null = null
  private rateLimitResetAt: number = 0

  constructor(phoneNumberId: string, accessToken: string) {
    if (!phoneNumberId) {
      throw new WhatsAppBotError('Phone number ID is required', 'missing_phone_number_id')
    }
    if (!accessToken) {
      throw new WhatsAppBotError('Access token is required', 'missing_access_token')
    }
    this.phoneNumberId = phoneNumberId
    this.accessToken = accessToken
  }

  async verifyToken(): Promise<{ verified_name: string }> {
    return this.request<{ verified_name: string }>('GET', `/${this.phoneNumberId}?fields=verified_name`)
  }

  async sendTextMessage(to: string, text: string, previewUrl?: boolean): Promise<WhatsAppBotMessageResponse> {
    return this.request<WhatsAppBotMessageResponse>('POST', `/${this.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text, preview_url: previewUrl ?? false },
    })
  }

  async sendTemplateMessage(
    to: string,
    templateName: string,
    languageCode: string,
    components?: unknown[],
  ): Promise<WhatsAppBotMessageResponse> {
    return this.request<WhatsAppBotMessageResponse>('POST', `/${this.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: { name: templateName, language: { code: languageCode }, components },
    })
  }

  async sendReaction(to: string, messageId: string, emoji: string): Promise<WhatsAppBotMessageResponse> {
    return this.request<WhatsAppBotMessageResponse>('POST', `/${this.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      to,
      type: 'reaction',
      reaction: { message_id: messageId, emoji },
    })
  }

  async sendImageMessage(to: string, imageUrl: string, caption?: string): Promise<WhatsAppBotMessageResponse> {
    return this.request<WhatsAppBotMessageResponse>('POST', `/${this.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      to,
      type: 'image',
      image: { link: imageUrl, caption },
    })
  }

  async sendDocumentMessage(
    to: string,
    documentUrl: string,
    filename?: string,
    caption?: string,
  ): Promise<WhatsAppBotMessageResponse> {
    return this.request<WhatsAppBotMessageResponse>('POST', `/${this.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      to,
      type: 'document',
      document: { link: documentUrl, filename, caption },
    })
  }

  async listTemplates(params?: { limit?: number }): Promise<WhatsAppBotTemplate[]> {
    return this.request<WhatsAppBotTemplate[]>('GET', this.buildPath(`/${this.phoneNumberId}/message_templates`, params), undefined, 'data')
  }

  async getTemplate(templateName: string): Promise<WhatsAppBotTemplate> {
    const templates = await this.request<WhatsAppBotTemplate[]>(
      'GET',
      `/${this.phoneNumberId}/message_templates?name=${encodeURIComponent(templateName)}`,
      undefined,
      'data',
    )
    const template = templates[0]
    if (!template) {
      throw new WhatsAppBotError(`Template "${templateName}" not found`, 'not_found')
    }
    return template
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
    const usageHeader = response.headers.get('x-business-use-case-usage')
    if (usageHeader) {
      try {
        const usage = JSON.parse(usageHeader) as Record<string, Array<{ call_count: number; total_cputime: number; total_time: number; type: string; estimated_time_to_regain_access: number }>>
        for (const entries of Object.values(usage)) {
          for (const entry of entries) {
            if (entry.call_count >= 100) {
              this.rateLimitRemaining = 0
              this.rateLimitResetAt = Date.now() + (entry.estimated_time_to_regain_access ?? 60) * 1000
            }
          }
        }
      } catch {
        // ignore parse errors
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
        throw new WhatsAppBotError(`Network error: ${lastError.message}`, 'network_error')
      }

      this.updateRateLimit(response)

      if (response.status === 429) {
        if (attempt < MAX_RETRIES) {
          const retryAfter = Number.parseFloat(response.headers.get('Retry-After') || '1')
          const retryAfterMs = (Number.isNaN(retryAfter) ? 1 : retryAfter) * 1000
          await this.sleep(retryAfterMs)
          continue
        }
        throw new WhatsAppBotError('Rate limited', 'rate_limited')
      }

      if (response.status >= 500 && response.status <= 599) {
        if (attempt < MAX_RETRIES && method === 'GET') {
          await this.sleep(BASE_BACKOFF_MS * 2 ** attempt)
          continue
        }

        const errorBody = await response.json().catch(() => ({})) as {
          error?: { message?: string; code?: number }
        }
        const msg = errorBody.error?.message || `HTTP ${response.status}`
        const code = errorBody.error?.code ? String(errorBody.error.code) : `http_${response.status}`
        throw new WhatsAppBotError(msg, code)
      }

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({})) as {
          error?: { message?: string; code?: number }
        }
        const msg = errorBody.error?.message || `HTTP ${response.status}`
        const code = errorBody.error?.code ? String(errorBody.error.code) : `http_${response.status}`
        throw new WhatsAppBotError(msg, code)
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

    throw lastError || new WhatsAppBotError('Request failed after retries', 'max_retries')
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
