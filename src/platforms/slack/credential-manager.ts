import { existsSync } from 'node:fs'
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

import type { Config, WorkspaceCredentials } from './types'

export class CredentialManager {
  private configDir: string
  private credentialsPath: string

  constructor(configDir?: string) {
    this.configDir = configDir ?? join(homedir(), '.config', 'agent-messenger')
    this.credentialsPath = join(this.configDir, 'slack-credentials.json')
  }

  async load(): Promise<Config> {
    if (!existsSync(this.credentialsPath)) {
      return {
        current_workspace: null,
        workspaces: {},
      }
    }

    const content = await readFile(this.credentialsPath, 'utf-8')
    return JSON.parse(content) as Config
  }

  async save(config: Config): Promise<void> {
    await mkdir(this.configDir, { recursive: true })

    await writeFile(this.credentialsPath, JSON.stringify(config, null, 2))
    await chmod(this.credentialsPath, 0o600)
  }

  async getWorkspace(id?: string): Promise<WorkspaceCredentials | null> {
    // Check env vars first (take precedence over file-based credentials)
    // Only use env credentials if no specific id requested, or id matches env workspace
    const envToken = process.env.E2E_SLACK_TOKEN
    const envCookie = process.env.E2E_SLACK_COOKIE
    const envWorkspaceId = process.env.E2E_SLACK_WORKSPACE_ID
    const envWorkspaceName = process.env.E2E_SLACK_WORKSPACE_NAME

    if (envToken && envCookie && envWorkspaceId && envWorkspaceName) {
      if (!id || id === envWorkspaceId) {
        return {
          token: envToken,
          cookie: envCookie,
          workspace_id: envWorkspaceId,
          workspace_name: envWorkspaceName,
        }
      }
    }

    const config = await this.load()

    if (id) {
      return config.workspaces[id] ?? null
    }

    if (!config.current_workspace) {
      return null
    }

    return config.workspaces[config.current_workspace] ?? null
  }

  async setWorkspace(creds: WorkspaceCredentials): Promise<void> {
    const config = await this.load()
    config.workspaces[creds.workspace_id] = creds
    await this.save(config)
  }

  async removeWorkspace(id: string): Promise<void> {
    const config = await this.load()
    delete config.workspaces[id]

    if (config.current_workspace === id) {
      config.current_workspace = null
    }

    await this.save(config)
  }

  async setCurrentWorkspace(id: string): Promise<void> {
    const config = await this.load()
    config.current_workspace = id
    await this.save(config)
  }
}
