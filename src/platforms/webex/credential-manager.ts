import { existsSync } from 'node:fs'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { getWebexAppCredentials } from './app-config'
import type { WebexConfig } from './types'
import { WebexConfigSchema } from './types'

const OAUTH_DEVICE_AUTHORIZE_URL = 'https://webexapis.com/v1/device/authorize'
const OAUTH_DEVICE_TOKEN_URL = 'https://webexapis.com/v1/device/token'
const OAUTH_TOKEN_URL = 'https://webexapis.com/v1/access_token'
const OAUTH_SCOPES = 'spark:all'

export { OAUTH_SCOPES }

export class WebexCredentialManager {
  private configDir: string
  private credentialsPath: string

  constructor(configDir?: string) {
    this.configDir = configDir ?? join(homedir(), '.config', 'agent-messenger')
    this.credentialsPath = join(this.configDir, 'webex-credentials.json')
  }

  async loadConfig(): Promise<WebexConfig | null> {
    if (!existsSync(this.credentialsPath)) return null
    const content = await readFile(this.credentialsPath, 'utf-8')
    const result = WebexConfigSchema.safeParse(JSON.parse(content))
    if (!result.success) return null
    return result.data
  }

  async saveConfig(config: WebexConfig): Promise<void> {
    await mkdir(this.configDir, { recursive: true })
    const tmpPath = `${this.credentialsPath}.tmp`
    await writeFile(tmpPath, JSON.stringify(config, null, 2), {
      encoding: 'utf-8',
      mode: 0o600,
    })
    await rename(tmpPath, this.credentialsPath)
  }

  async getToken(clientId?: string, clientSecret?: string): Promise<string | null> {
    const config = await this.loadConfig()
    if (!config) return null

    if (config.tokenType === 'manual') {
      return config.accessToken
    }

    const isExpired = config.expiresAt > 0 && config.expiresAt < Date.now() + 5 * 60 * 1000

    if (config.tokenType === 'extracted') {
      if (isExpired && config.refreshToken) {
        const builtinCreds = getWebexAppCredentials()
        const refreshed = await this.refreshToken(config.refreshToken, builtinCreds.clientId, builtinCreds.clientSecret)
        if (refreshed) {
          await this.saveConfig({ ...config, ...refreshed, tokenType: 'extracted' })
          return refreshed.accessToken
        }
      }
      return config.accessToken
    }

    if (isExpired) {
      const builtinCreds = getWebexAppCredentials()
      const resolvedClientId = clientId ?? config.clientId ?? builtinCreds.clientId
      const resolvedClientSecret = clientSecret ?? config.clientSecret ?? builtinCreds.clientSecret
      const refreshed = await this.refreshToken(config.refreshToken, resolvedClientId, resolvedClientSecret)
      if (refreshed) {
        await this.saveConfig({ ...config, ...refreshed })
        return refreshed.accessToken
      }
      return null
    }

    return config.accessToken
  }

  async refreshToken(refreshToken: string, clientId: string, clientSecret: string): Promise<WebexConfig | null> {
    try {
      const response = await fetch(OAUTH_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
        }),
      })

      if (!response.ok) return null

      const data = (await response.json()) as {
        access_token: string
        refresh_token: string
        expires_in: number
      }

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + data.expires_in * 1000,
      } satisfies Pick<WebexConfig, 'accessToken' | 'refreshToken' | 'expiresAt'>
    } catch {
      return null
    }
  }

  async requestDeviceCode(
    clientId: string,
    scopes?: string,
  ): Promise<{
    deviceCode: string
    userCode: string
    verificationUri: string
    verificationUriComplete: string
    expiresIn: number
    interval: number
  }> {
    const response = await fetch(OAUTH_DEVICE_AUTHORIZE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        scope: scopes ?? OAUTH_SCOPES,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      throw new Error(`Device authorization failed: ${response.status} ${errorBody}`)
    }

    const data = (await response.json()) as {
      device_code: string
      user_code: string
      verification_uri: string
      verification_uri_complete: string
      expires_in: number
      interval: number
    }

    return {
      deviceCode: data.device_code,
      userCode: data.user_code,
      verificationUri: data.verification_uri,
      verificationUriComplete: data.verification_uri_complete,
      expiresIn: data.expires_in,
      interval: data.interval,
    }
  }

  async pollDeviceToken(
    deviceCode: string,
    interval: number,
    expiresIn: number,
    clientId: string,
    clientSecret?: string,
  ): Promise<WebexConfig> {
    const basicAuth = btoa(`${clientId}:${clientSecret ?? ''}`)
    const deadline = Date.now() + expiresIn * 1000

    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, interval * 1000))

      const response = await fetch(OAUTH_DEVICE_TOKEN_URL, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          device_code: deviceCode,
          client_id: clientId,
        }),
      })

      if (response.ok) {
        const data = (await response.json()) as {
          access_token: string
          refresh_token: string
          expires_in: number
        }

        const config: WebexConfig = {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: Date.now() + data.expires_in * 1000,
        }

        return config
      }

      if (response.status === 428) continue

      const errorBody = (await response.json().catch(() => null)) as {
        errors?: Array<{ description: string }>
      } | null
      const errorDesc = errorBody?.errors?.[0]?.description ?? ''

      if (errorDesc.includes('authorization_pending') || errorDesc.includes('slow_down')) {
        continue
      }

      throw new Error(`Device token exchange failed: ${response.status} ${errorDesc}`)
    }

    throw new Error('Device authorization timed out')
  }

  async clearCredentials(): Promise<void> {
    if (existsSync(this.credentialsPath)) {
      await rm(this.credentialsPath)
    }
  }
}
