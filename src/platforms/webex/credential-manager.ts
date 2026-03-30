import { existsSync } from 'node:fs'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

import type { WebexConfig } from './types'

export class WebexCredentialManager {
  private configDir: string
  private credentialsPath: string

  constructor(configDir?: string) {
    this.configDir = configDir ?? join(homedir(), '.config', 'agent-messenger')
    this.credentialsPath = join(this.configDir, 'webex-credentials.json')
  }

  async loadConfig(): Promise<WebexConfig | null> {
    if (!existsSync(this.credentialsPath)) {
      return null
    }
    const content = await readFile(this.credentialsPath, 'utf-8')
    return JSON.parse(content) as WebexConfig
  }

  async saveConfig(config: WebexConfig): Promise<void> {
    await mkdir(this.configDir, { recursive: true })
    await writeFile(this.credentialsPath, JSON.stringify(config, null, 2), {
      encoding: 'utf-8',
      mode: 0o600,
    })
  }

  async getToken(): Promise<string | null> {
    const config = await this.loadConfig()
    return config?.token ?? null
  }

  async setToken(token: string): Promise<void> {
    await this.saveConfig({ token })
  }

  async clearCredentials(): Promise<void> {
    if (existsSync(this.credentialsPath)) {
      await rm(this.credentialsPath)
    }
  }
}
