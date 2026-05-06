import { existsSync } from 'node:fs'
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { getConfigDir } from '../../shared/utils/config-dir'

export interface DiscordConfig {
  token: string | null
  current_server: string | null
  servers: Record<string, { server_id: string; server_name: string }>
}

export class DiscordCredentialManager {
  private configDir: string
  private credentialsPath: string

  constructor(configDir?: string) {
    this.configDir = configDir ?? getConfigDir()
    this.credentialsPath = join(this.configDir, 'discord-credentials.json')
  }

  async load(): Promise<DiscordConfig> {
    if (!existsSync(this.credentialsPath)) {
      return {
        token: null,
        current_server: null,
        servers: {},
      }
    }

    const content = await readFile(this.credentialsPath, 'utf-8')
    return JSON.parse(content) as DiscordConfig
  }

  async save(config: DiscordConfig): Promise<void> {
    await mkdir(this.configDir, { recursive: true })

    await writeFile(this.credentialsPath, JSON.stringify(config, null, 2))
    await chmod(this.credentialsPath, 0o600)
  }

  async getToken(): Promise<string | null> {
    // Check env var first (takes precedence over file-based credentials)
    const envToken = process.env.E2E_DISCORD_TOKEN
    if (envToken) {
      return envToken
    }

    const config = await this.load()
    return config.token
  }

  async setToken(token: string): Promise<void> {
    const config = await this.load()
    config.token = token
    await this.save(config)
  }

  async clearToken(): Promise<void> {
    const config = await this.load()
    config.token = null
    await this.save(config)
  }

  async getCurrentServer(): Promise<string | null> {
    // Check env var first (takes precedence over file-based credentials)
    const envServerId = process.env.E2E_DISCORD_SERVER_ID
    if (envServerId) {
      return envServerId
    }

    const config = await this.load()
    return config.current_server
  }

  async setCurrentServer(serverId: string): Promise<void> {
    const config = await this.load()
    config.current_server = serverId
    await this.save(config)
  }

  async getServers(): Promise<Record<string, { server_id: string; server_name: string }>> {
    const config = await this.load()
    return config.servers
  }

  async setServers(servers: Record<string, { server_id: string; server_name: string }>): Promise<void> {
    const config = await this.load()
    config.servers = servers
    await this.save(config)
  }

  async getCredentials(): Promise<{ token: string; serverId: string } | null> {
    const token = await this.getToken()
    const serverId = await this.getCurrentServer()

    if (!token || !serverId) {
      return null
    }

    return { token, serverId }
  }
}
