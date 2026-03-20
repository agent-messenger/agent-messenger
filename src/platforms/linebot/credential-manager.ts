import { existsSync } from 'node:fs'
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

import type { LineBotConfig, LineBotCredentials, LineBotWorkspaceEntry } from './types'
import { LineBotConfigSchema } from './types'

export class LineBotCredentialManager {
  private configDir: string
  private credentialsPath: string

  constructor(configDir?: string) {
    this.configDir = configDir ?? join(homedir(), '.config', 'agent-messenger')
    this.credentialsPath = join(this.configDir, 'linebot-credentials.json')
  }

  async load(): Promise<LineBotConfig> {
    if (!existsSync(this.credentialsPath)) {
      return { current: null, workspaces: {} }
    }

    const content = await readFile(this.credentialsPath, 'utf-8')
    let json: unknown
    try {
      json = JSON.parse(content)
    } catch {
      return { current: null, workspaces: {} }
    }

    const parsed = LineBotConfigSchema.safeParse(json)
    if (!parsed.success) {
      return { current: null, workspaces: {} }
    }

    return parsed.data
  }

  async save(config: LineBotConfig): Promise<void> {
    await mkdir(this.configDir, { recursive: true })
    await writeFile(this.credentialsPath, JSON.stringify(config, null, 2), { mode: 0o600 })
    await chmod(this.credentialsPath, 0o600)
  }

  async getCredentials(channelId?: string): Promise<LineBotCredentials | null> {
    const envToken = process.env.E2E_LINEBOT_CHANNEL_ACCESS_TOKEN

    if (envToken && !channelId) {
      return {
        channel_id: process.env.E2E_LINEBOT_CHANNEL_ID || 'env',
        channel_name: process.env.E2E_LINEBOT_CHANNEL_NAME || 'env',
        channel_access_token: envToken,
      }
    }

    const config = await this.load()

    if (channelId) {
      const workspace = config.workspaces[channelId]
      if (!workspace) return null
      return {
        channel_id: workspace.channel_id,
        channel_name: workspace.channel_name,
        channel_access_token: workspace.channel_access_token,
      }
    }

    if (!config.current) {
      return null
    }

    const workspace = config.workspaces[config.current.channel_id]
    if (!workspace) return null

    return {
      channel_id: workspace.channel_id,
      channel_name: workspace.channel_name,
      channel_access_token: workspace.channel_access_token,
    }
  }

  async setCredentials(entry: LineBotWorkspaceEntry): Promise<void> {
    const config = await this.load()

    config.workspaces[entry.channel_id] = {
      channel_id: entry.channel_id,
      channel_name: entry.channel_name,
      channel_access_token: entry.channel_access_token,
    }

    config.current = {
      channel_id: entry.channel_id,
    }

    await this.save(config)
  }

  async removeWorkspace(channelId: string): Promise<boolean> {
    const config = await this.load()

    if (!config.workspaces[channelId]) {
      return false
    }

    delete config.workspaces[channelId]

    if (config.current?.channel_id === channelId) {
      config.current = null
    }

    await this.save(config)
    return true
  }

  async setCurrent(channelId: string): Promise<boolean> {
    const config = await this.load()

    if (!config.workspaces[channelId]) {
      return false
    }

    config.current = {
      channel_id: channelId,
    }

    await this.save(config)
    return true
  }

  async listAll(): Promise<Array<LineBotWorkspaceEntry & { is_current: boolean }>> {
    const config = await this.load()
    const results: Array<LineBotWorkspaceEntry & { is_current: boolean }> = []

    for (const workspace of Object.values(config.workspaces)) {
      results.push({
        channel_id: workspace.channel_id,
        channel_name: workspace.channel_name,
        channel_access_token: workspace.channel_access_token,
        is_current: config.current?.channel_id === workspace.channel_id,
      })
    }

    return results
  }

  async clearCredentials(): Promise<void> {
    await this.save({ current: null, workspaces: {} })
  }
}
