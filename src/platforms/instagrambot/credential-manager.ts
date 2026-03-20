import { existsSync } from 'node:fs'
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

import type { InstagramBotConfig, InstagramBotCredentials, InstagramBotWorkspaceEntry } from './types'
import { InstagramBotConfigSchema } from './types'

export class InstagramBotCredentialManager {
  private configDir: string
  private credentialsPath: string

  constructor(configDir?: string) {
    this.configDir = configDir ?? join(homedir(), '.config', 'agent-messenger')
    this.credentialsPath = join(this.configDir, 'instagrambot-credentials.json')
  }

  async load(): Promise<InstagramBotConfig> {
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

    const parsed = InstagramBotConfigSchema.safeParse(json)
    if (!parsed.success) {
      return { current: null, workspaces: {} }
    }

    return parsed.data
  }

  async save(config: InstagramBotConfig): Promise<void> {
    await mkdir(this.configDir, { recursive: true })
    await writeFile(this.credentialsPath, JSON.stringify(config, null, 2), { mode: 0o600 })
    await chmod(this.credentialsPath, 0o600)
  }

  async getCredentials(workspaceId?: string): Promise<InstagramBotCredentials | null> {
    const envPageId = process.env.E2E_INSTAGRAMBOT_PAGE_ID
    const envAccessToken = process.env.E2E_INSTAGRAMBOT_ACCESS_TOKEN

    if (envPageId && envAccessToken && !workspaceId) {
      return {
        workspace_id: envPageId,
        workspace_name: 'env',
        page_id: envPageId,
        access_token: envAccessToken,
        instagram_account_id: envPageId,
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
        instagram_account_id: workspace.instagram_account_id,
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
      instagram_account_id: workspace.instagram_account_id,
    }
  }

  async setCredentials(entry: InstagramBotWorkspaceEntry): Promise<void> {
    const config = await this.load()

    config.workspaces[entry.workspace_id] = {
      workspace_id: entry.workspace_id,
      workspace_name: entry.workspace_name,
      page_id: entry.page_id,
      access_token: entry.access_token,
      instagram_account_id: entry.instagram_account_id,
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

  async listAll(): Promise<Array<InstagramBotWorkspaceEntry & { is_current: boolean }>> {
    const config = await this.load()
    const results: Array<InstagramBotWorkspaceEntry & { is_current: boolean }> = []

    for (const workspace of Object.values(config.workspaces)) {
      results.push({
        workspace_id: workspace.workspace_id,
        workspace_name: workspace.workspace_name,
        page_id: workspace.page_id,
        access_token: workspace.access_token,
        instagram_account_id: workspace.instagram_account_id,
        is_current: config.current?.workspace_id === workspace.workspace_id,
      })
    }

    return results
  }

  async clearCredentials(): Promise<void> {
    await this.save({ current: null, workspaces: {} })
  }
}
