import { existsSync } from 'node:fs'
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

import type { FBMessengerBotConfig, FBMessengerBotCredentials, FBMessengerBotWorkspaceEntry } from './types'
import { FBMessengerBotConfigSchema } from './types'

export class FBMessengerBotCredentialManager {
  private configDir: string
  private credentialsPath: string

  constructor(configDir?: string) {
    this.configDir = configDir ?? join(homedir(), '.config', 'agent-messenger')
    this.credentialsPath = join(this.configDir, 'fbmessengerbot-credentials.json')
  }

  async load(): Promise<FBMessengerBotConfig> {
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

    const parsed = FBMessengerBotConfigSchema.safeParse(json)
    if (!parsed.success) {
      return { current: null, workspaces: {} }
    }

    return parsed.data
  }

  async save(config: FBMessengerBotConfig): Promise<void> {
    await mkdir(this.configDir, { recursive: true })
    await writeFile(this.credentialsPath, JSON.stringify(config, null, 2), { mode: 0o600 })
    await chmod(this.credentialsPath, 0o600)
  }

  async getCredentials(workspaceId?: string): Promise<FBMessengerBotCredentials | null> {
    const envPageId = process.env.E2E_FBMESSENGERBOT_PAGE_ID
    const envAccessToken = process.env.E2E_FBMESSENGERBOT_ACCESS_TOKEN

    if (envPageId && envAccessToken && !workspaceId) {
      return {
        workspace_id: envPageId,
        workspace_name: 'env',
        page_id: envPageId,
        access_token: envAccessToken,
      }
    }

    const config = await this.load()

    if (workspaceId) {
      const workspace = config.workspaces[workspaceId]
      if (!workspace) return null
      return {
        workspace_id: workspace.workspace_id,
        workspace_name: workspace.workspace_name,
        page_id: workspace.page_id,
        access_token: workspace.access_token,
      }
    }

    if (!config.current) {
      return null
    }

    const workspace = config.workspaces[config.current.workspace_id]
    if (!workspace) return null

    return {
      workspace_id: workspace.workspace_id,
      workspace_name: workspace.workspace_name,
      page_id: workspace.page_id,
      access_token: workspace.access_token,
    }
  }

  async setCredentials(entry: FBMessengerBotWorkspaceEntry): Promise<void> {
    const config = await this.load()

    config.workspaces[entry.workspace_id] = {
      workspace_id: entry.workspace_id,
      workspace_name: entry.workspace_name,
      page_id: entry.page_id,
      access_token: entry.access_token,
    }

    config.current = {
      workspace_id: entry.workspace_id,
    }

    await this.save(config)
  }

  async removeWorkspace(workspaceId: string): Promise<boolean> {
    const config = await this.load()

    if (!config.workspaces[workspaceId]) {
      return false
    }

    delete config.workspaces[workspaceId]

    if (config.current?.workspace_id === workspaceId) {
      config.current = null
    }

    await this.save(config)
    return true
  }

  async setCurrent(workspaceId: string): Promise<boolean> {
    const config = await this.load()

    if (!config.workspaces[workspaceId]) {
      return false
    }

    config.current = {
      workspace_id: workspaceId,
    }

    await this.save(config)
    return true
  }

  async listAll(): Promise<Array<FBMessengerBotWorkspaceEntry & { is_current: boolean }>> {
    const config = await this.load()
    const results: Array<FBMessengerBotWorkspaceEntry & { is_current: boolean }> = []

    for (const workspace of Object.values(config.workspaces)) {
      results.push({
        workspace_id: workspace.workspace_id,
        workspace_name: workspace.workspace_name,
        page_id: workspace.page_id,
        access_token: workspace.access_token,
        is_current: config.current?.workspace_id === workspace.workspace_id,
      })
    }

    return results
  }

  async clearCredentials(): Promise<void> {
    await this.save({ current: null, workspaces: {} })
  }
}
