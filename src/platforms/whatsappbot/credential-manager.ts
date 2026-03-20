import { existsSync } from 'node:fs'
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

import type { WhatsAppBotConfig, WhatsAppBotCredentials, WhatsAppBotWorkspaceEntry } from './types'
import { WhatsAppBotConfigSchema } from './types'

export class WhatsAppBotCredentialManager {
  private configDir: string
  private credentialsPath: string

  constructor(configDir?: string) {
    this.configDir = configDir ?? join(homedir(), '.config', 'agent-messenger')
    this.credentialsPath = join(this.configDir, 'whatsappbot-credentials.json')
  }

  async load(): Promise<WhatsAppBotConfig> {
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

    const parsed = WhatsAppBotConfigSchema.safeParse(json)
    if (!parsed.success) {
      return { current: null, workspaces: {} }
    }

    return parsed.data
  }

  async save(config: WhatsAppBotConfig): Promise<void> {
    await mkdir(this.configDir, { recursive: true })
    await writeFile(this.credentialsPath, JSON.stringify(config, null, 2), { mode: 0o600 })
    await chmod(this.credentialsPath, 0o600)
  }

  async getCredentials(workspaceId?: string): Promise<WhatsAppBotCredentials | null> {
    const envPhoneNumberId = process.env.E2E_WHATSAPPBOT_PHONE_NUMBER_ID
    const envAccessToken = process.env.E2E_WHATSAPPBOT_ACCESS_TOKEN
    const envWorkspaceName = process.env.E2E_WHATSAPPBOT_WORKSPACE_NAME

    if (envPhoneNumberId && envAccessToken && !workspaceId) {
      return {
        workspace_id: envPhoneNumberId,
        workspace_name: envWorkspaceName || 'env',
        phone_number_id: envPhoneNumberId,
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
        phone_number_id: workspace.phone_number_id,
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
      phone_number_id: workspace.phone_number_id,
      access_token: workspace.access_token,
    }
  }

  async setCredentials(entry: WhatsAppBotWorkspaceEntry): Promise<void> {
    const config = await this.load()

    config.workspaces[entry.workspace_id] = {
      workspace_id: entry.workspace_id,
      workspace_name: entry.workspace_name,
      phone_number_id: entry.phone_number_id,
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

  async listAll(): Promise<Array<WhatsAppBotWorkspaceEntry & { is_current: boolean }>> {
    const config = await this.load()
    const results: Array<WhatsAppBotWorkspaceEntry & { is_current: boolean }> = []

    for (const workspace of Object.values(config.workspaces)) {
      results.push({
        workspace_id: workspace.workspace_id,
        workspace_name: workspace.workspace_name,
        phone_number_id: workspace.phone_number_id,
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
