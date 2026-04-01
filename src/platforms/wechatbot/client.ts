import type { WeChatBotNewsArticle, WeChatBotTemplate, WeChatBotUserInfo } from './types'
import { WeChatBotError } from './types'

const BASE_URL = 'https://api.weixin.qq.com'
const MAX_RETRIES = 3
const BASE_BACKOFF_MS = 100

export class WeChatBotClient {
  private appId: string | null = null
  private appSecret: string | null = null
  private accessToken: string | null = null
  private tokenExpiresAt: number = 0

  async login(credentials?: { appId: string; appSecret: string }): Promise<this> {
    if (credentials) {
      if (!credentials.appId) {
        throw new WeChatBotError('App ID is required', 'missing_app_id')
      }
      if (!credentials.appSecret) {
        throw new WeChatBotError('App Secret is required', 'missing_app_secret')
      }
      this.appId = credentials.appId
      this.appSecret = credentials.appSecret
      return this
    }
    const { WeChatBotCredentialManager } = await import('./credential-manager')
    const credManager = new WeChatBotCredentialManager()
    const creds = await credManager.getCredentials()
    if (!creds) {
      throw new WeChatBotError(
        'No WeChat Bot credentials found. Run "agent-wechatbot auth set" first.',
        'no_credentials',
      )
    }
    return this.login({ appId: creds.app_id, appSecret: creds.app_secret })
  }

  private ensureAuth(): void {
    if (this.appId === null) {
      throw new WeChatBotError('Not authenticated. Call .login() first.', 'not_authenticated')
    }
  }

  private async ensureAccessToken(): Promise<string> {
    const now = Date.now()
    if (this.accessToken && now < this.tokenExpiresAt) {
      return this.accessToken
    }
    const result = await this.fetchAccessToken()
    this.accessToken = result.access_token
    this.tokenExpiresAt = now + (result.expires_in - 10) * 1000
    return this.accessToken
  }

  private async fetchAccessToken(): Promise<{ access_token: string; expires_in: number }> {
    const url = `${BASE_URL}/cgi-bin/token?grant_type=client_credential&appid=${this.appId}&secret=${this.appSecret}`
    let response: Response
    try {
      response = await fetch(url)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      throw new WeChatBotError(`Network error fetching access token: ${msg}`, 'network_error')
    }

    const data = (await response.json()) as { access_token?: string; expires_in?: number; errcode?: number; errmsg?: string }

    if (data.errcode) {
      throw new WeChatBotError(data.errmsg ?? `Error ${data.errcode}`, String(data.errcode))
    }

    if (!data.access_token) {
      throw new WeChatBotError('Failed to obtain access token', 'token_fetch_failed')
    }

    return { access_token: data.access_token, expires_in: data.expires_in ?? 7200 }
  }

  async verifyCredentials(): Promise<boolean> {
    this.ensureAuth()
    try {
      await this.fetchAccessToken()
      return true
    } catch {
      return false
    }
  }

  async sendTextMessage(openId: string, text: string): Promise<void> {
    await this.request<void>('POST', '/cgi-bin/message/custom/send', {
      touser: openId,
      msgtype: 'text',
      text: { content: text },
    })
  }

  async sendImageMessage(openId: string, mediaId: string): Promise<void> {
    await this.request<void>('POST', '/cgi-bin/message/custom/send', {
      touser: openId,
      msgtype: 'image',
      image: { media_id: mediaId },
    })
  }

  async sendNewsMessage(openId: string, articles: WeChatBotNewsArticle[]): Promise<void> {
    await this.request<void>('POST', '/cgi-bin/message/custom/send', {
      touser: openId,
      msgtype: 'news',
      news: { articles },
    })
  }

  async sendTemplateMessage(
    openId: string,
    templateId: string,
    data: Record<string, { value: string }>,
    url?: string,
  ): Promise<{ msgid: number }> {
    return this.request<{ msgid: number }>('POST', '/cgi-bin/message/template/send', {
      touser: openId,
      template_id: templateId,
      url,
      data,
    })
  }

  async listTemplates(): Promise<WeChatBotTemplate[]> {
    const result = await this.request<{ template_list: WeChatBotTemplate[] }>(
      'GET',
      '/cgi-bin/template/get_all_private_template',
    )
    return result.template_list
  }

  async deleteTemplate(templateId: string): Promise<void> {
    await this.request<void>('POST', '/cgi-bin/template/del_private_template', {
      template_id: templateId,
    })
  }

  async getFollowers(nextOpenId?: string): Promise<{
    total: number
    count: number
    openids: string[]
    next_openid: string
  }> {
    const path = this.buildPath('/cgi-bin/user/get', nextOpenId ? { next_openid: nextOpenId } : undefined)
    const result = await this.request<{
      total: number
      count: number
      data: { openid: string[] }
      next_openid: string
    }>('GET', path)
    return {
      total: result.total,
      count: result.count,
      openids: result.data?.openid ?? [],
      next_openid: result.next_openid,
    }
  }

  async getUserInfo(openId: string, lang = 'zh_CN'): Promise<WeChatBotUserInfo> {
    const path = this.buildPath('/cgi-bin/user/info', { openid: openId, lang })
    return this.request<WeChatBotUserInfo>('GET', path)
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    this.ensureAuth()
    let lastError: Error | undefined
    let tokenInvalidated = false

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const token = await this.ensureAccessToken()
      const url = `${BASE_URL}${path}${path.includes('?') ? '&' : '?'}access_token=${token}`

      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
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
        throw new WeChatBotError(`Network error: ${lastError.message}`, 'network_error')
      }

      if (response.status >= 500 && response.status <= 599) {
        if (attempt < MAX_RETRIES && method === 'GET') {
          await this.sleep(BASE_BACKOFF_MS * 2 ** attempt)
          continue
        }
        throw new WeChatBotError(`HTTP ${response.status}`, `http_${response.status}`)
      }

      const data = (await response.json()) as {
        errcode?: number
        errmsg?: string
        [key: string]: unknown
      }

      if (data.errcode === 40001 || data.errcode === 42001) {
        if (!tokenInvalidated) {
          tokenInvalidated = true
          this.accessToken = null
          this.tokenExpiresAt = 0
          continue
        }
        throw new WeChatBotError(data.errmsg ?? `Error ${data.errcode}`, String(data.errcode))
      }

      if (data.errcode === -1) {
        if (attempt < MAX_RETRIES) {
          await this.sleep(BASE_BACKOFF_MS * 2 ** attempt)
          continue
        }
        throw new WeChatBotError('WeChat system busy', '-1')
      }

      if (data.errcode === 45009) {
        throw new WeChatBotError('WeChat API frequency limit exceeded', '45009')
      }

      if (data.errcode && data.errcode !== 0) {
        throw new WeChatBotError(data.errmsg ?? `Error ${data.errcode}`, String(data.errcode))
      }

      return data as T
    }

    throw lastError ?? new WeChatBotError('Request failed after retries', 'max_retries')
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
