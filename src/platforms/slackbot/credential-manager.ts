import { existsSync } from 'node:fs'
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { SlackBotConfig, SlackBotCredentials } from './types'

export class SlackBotCredentialManager {
  private configDir: string
  private credentialsPath: string

  constructor(configDir?: string) {
    this.configDir = configDir ?? join(homedir(), '.config', 'agent-messenger')
    this.credentialsPath = join(this.configDir, 'slackbot-credentials.json')
  }

  async load(): Promise<SlackBotConfig> {
    if (!existsSync(this.credentialsPath)) {
      return {
        current_workspace: null,
        token: null,
        workspaces: {},
      }
    }

    const content = await readFile(this.credentialsPath, 'utf-8')
    return JSON.parse(content) as SlackBotConfig
  }

  async save(config: SlackBotConfig): Promise<void> {
    await mkdir(this.configDir, { recursive: true })
    await writeFile(this.credentialsPath, JSON.stringify(config, null, 2))
    await chmod(this.credentialsPath, 0o600)
  }

  async getCredentials(): Promise<SlackBotCredentials | null> {
    // Check env vars first (take precedence over file-based credentials)
    const envToken = process.env.E2E_SLACKBOT_TOKEN
    const envWorkspaceId = process.env.E2E_SLACKBOT_WORKSPACE_ID
    const envWorkspaceName = process.env.E2E_SLACKBOT_WORKSPACE_NAME

    if (envToken && envWorkspaceId && envWorkspaceName) {
      return {
        token: envToken,
        workspace_id: envWorkspaceId,
        workspace_name: envWorkspaceName,
      }
    }

    const config = await this.load()

    if (!config.token || !config.current_workspace) {
      return null
    }

    const workspace = config.workspaces[config.current_workspace]
    if (!workspace) {
      return null
    }

    return {
      token: config.token,
      workspace_id: workspace.workspace_id,
      workspace_name: workspace.workspace_name,
    }
  }

  async setCredentials(creds: SlackBotCredentials): Promise<void> {
    const config = await this.load()
    
    config.token = creds.token
    config.current_workspace = creds.workspace_id
    config.workspaces[creds.workspace_id] = {
      workspace_id: creds.workspace_id,
      workspace_name: creds.workspace_name,
    }

    await this.save(config)
  }

  async clearCredentials(): Promise<void> {
    const config: SlackBotConfig = {
      current_workspace: null,
      token: null,
      workspaces: {},
    }
    await this.save(config)
  }

  async getToken(): Promise<string | null> {
    // Check env var first
    const envToken = process.env.E2E_SLACKBOT_TOKEN
    if (envToken) {
      return envToken
    }

    const config = await this.load()
    return config.token
  }

  async getCurrentWorkspace(): Promise<string | null> {
    // Check env var first
    const envWorkspaceId = process.env.E2E_SLACKBOT_WORKSPACE_ID
    if (envWorkspaceId) {
      return envWorkspaceId
    }

    const config = await this.load()
    return config.current_workspace
  }
}
