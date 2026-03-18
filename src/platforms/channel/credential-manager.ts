import { existsSync } from 'node:fs'
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

import type { ChannelConfig, ChannelCredentials, ChannelWorkspaceEntry } from './types'
import { ChannelConfigSchema } from './types'

export class ChannelCredentialManager {
  private credentialsPath: string

  constructor(private configDir: string = join(homedir(), '.config', 'agent-messenger')) {
    this.credentialsPath = join(this.configDir, 'channel-credentials.json')
  }

  async load(): Promise<ChannelConfig> {
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
    const parsed = ChannelConfigSchema.safeParse(json)
    if (!parsed.success) {
      return { current: null, workspaces: {} }
    }
    return parsed.data
  }

  async save(config: ChannelConfig): Promise<void> {
    await mkdir(this.configDir, { recursive: true })
    await writeFile(this.credentialsPath, JSON.stringify(config, null, 2), { mode: 0o600 })
    await chmod(this.credentialsPath, 0o600)
  }

  async getCredentials(workspaceId?: string): Promise<ChannelCredentials | null> {
    const envAccountCookie = process.env.E2E_CHANNEL_ACCOUNT_COOKIE
    const envSessionCookie = process.env.E2E_CHANNEL_SESSION_COOKIE
    const envWorkspaceId = process.env.E2E_CHANNEL_CHANNEL_ID

    if (envAccountCookie && envSessionCookie && envWorkspaceId && !workspaceId) {
      return {
        workspace_id: envWorkspaceId,
        workspace_name: 'env',
        account_cookie: envAccountCookie,
        session_cookie: envSessionCookie,
      }
    }

    const config = await this.load()

    if (workspaceId) {
      const workspace = config.workspaces[workspaceId]
      if (!workspace) return null
      return {
        workspace_id: workspace.workspace_id,
        workspace_name: workspace.workspace_name,
        account_cookie: workspace.account_cookie,
        session_cookie: workspace.session_cookie,
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
      account_cookie: workspace.account_cookie,
      session_cookie: workspace.session_cookie,
    }
  }

  async setCredentials(entry: ChannelWorkspaceEntry): Promise<void> {
    const config = await this.load()

    config.workspaces[entry.workspace_id] = {
      workspace_id: entry.workspace_id,
      workspace_name: entry.workspace_name,
      account_id: entry.account_id,
      account_name: entry.account_name,
      account_cookie: entry.account_cookie,
      session_cookie: entry.session_cookie,
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

  async listAll(): Promise<Array<ChannelWorkspaceEntry & { is_current: boolean }>> {
    const config = await this.load()
    const results: Array<ChannelWorkspaceEntry & { is_current: boolean }> = []

    for (const workspace of Object.values(config.workspaces)) {
      results.push({
        workspace_id: workspace.workspace_id,
        workspace_name: workspace.workspace_name,
        account_id: workspace.account_id,
        account_name: workspace.account_name,
        account_cookie: workspace.account_cookie,
        session_cookie: workspace.session_cookie,
        is_current: config.current?.workspace_id === workspace.workspace_id,
      })
    }

    return results
  }

  async clearCredentials(): Promise<void> {
    await this.save({ current: null, workspaces: {} })
  }
}
