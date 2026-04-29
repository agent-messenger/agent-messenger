import { existsSync } from 'node:fs'
import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

import type { ChannelBotConfig, ChannelBotCredentials, ChannelBotWorkspaceEntry } from './types'
import { ChannelBotConfigSchema } from './types'

const LEGACY_FILENAME = 'channelbot-credentials.json'
const CREDENTIALS_FILENAME = 'channeltalkbot-credentials.json'

export class ChannelBotCredentialManager {
  private configDir: string
  private credentialsPath: string
  private legacyPath: string
  private migratedLegacyFile = false
  protected renameFile: typeof rename = rename

  constructor(configDir?: string) {
    this.configDir = configDir ?? join(homedir(), '.config', 'agent-messenger')
    this.credentialsPath = join(this.configDir, CREDENTIALS_FILENAME)
    this.legacyPath = join(this.configDir, LEGACY_FILENAME)
  }

  async load(): Promise<ChannelBotConfig> {
    await this.migrateLegacyFileIfNeeded()

    if (!existsSync(this.credentialsPath)) {
      return { current: null, workspaces: {}, default_bot: null }
    }

    const content = await readFile(this.credentialsPath, 'utf-8')
    let json: unknown
    try {
      json = JSON.parse(content)
    } catch {
      return { current: null, workspaces: {}, default_bot: null }
    }
    const parsed = ChannelBotConfigSchema.safeParse(json)
    if (!parsed.success) {
      return { current: null, workspaces: {}, default_bot: null }
    }
    return parsed.data
  }

  private async migrateLegacyFileIfNeeded(): Promise<void> {
    if (this.migratedLegacyFile) return
    if (existsSync(this.credentialsPath)) {
      this.migratedLegacyFile = true
      return
    }
    if (!existsSync(this.legacyPath)) {
      this.migratedLegacyFile = true
      return
    }
    try {
      await this.renameFile(this.legacyPath, this.credentialsPath)
      process.stderr.write(
        `[agent-channeltalkbot] Migrated credentials: ${LEGACY_FILENAME} -> ${CREDENTIALS_FILENAME}\n`,
      )
    } catch {
      // Rename failed. If a concurrent process succeeded, the new file now exists — use it.
      // Otherwise (real failure: permissions, etc.) keep the new path; load() will return
      // empty config and the user can re-run `auth set`. Never fall back to writing the
      // legacy path, which would resurrect the split-brain we are migrating away from.
    }
    this.migratedLegacyFile = true
  }

  async save(config: ChannelBotConfig): Promise<void> {
    await mkdir(this.configDir, { recursive: true })
    await writeFile(this.credentialsPath, JSON.stringify(config, null, 2), { mode: 0o600 })
    await chmod(this.credentialsPath, 0o600)
  }

  async getCredentials(workspaceId?: string): Promise<ChannelBotCredentials | null> {
    const envAccessKey = process.env.E2E_CHANNELTALKBOT_ACCESS_KEY ?? process.env.E2E_CHANNELBOT_ACCESS_KEY
    const envAccessSecret = process.env.E2E_CHANNELTALKBOT_ACCESS_SECRET ?? process.env.E2E_CHANNELBOT_ACCESS_SECRET

    if (envAccessKey && envAccessSecret && !workspaceId) {
      return {
        workspace_id: 'env',
        workspace_name: 'env',
        access_key: envAccessKey,
        access_secret: envAccessSecret,
      }
    }

    const config = await this.load()

    if (workspaceId) {
      const workspace = config.workspaces[workspaceId]
      if (!workspace) return null
      return {
        workspace_id: workspace.workspace_id,
        workspace_name: workspace.workspace_name,
        access_key: workspace.access_key,
        access_secret: workspace.access_secret,
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
      access_key: workspace.access_key,
      access_secret: workspace.access_secret,
    }
  }

  async setCredentials(entry: ChannelBotWorkspaceEntry): Promise<void> {
    const config = await this.load()

    config.workspaces[entry.workspace_id] = {
      workspace_id: entry.workspace_id,
      workspace_name: entry.workspace_name,
      access_key: entry.access_key,
      access_secret: entry.access_secret,
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

  async listAll(): Promise<Array<ChannelBotWorkspaceEntry & { is_current: boolean }>> {
    const config = await this.load()
    const results: Array<ChannelBotWorkspaceEntry & { is_current: boolean }> = []

    for (const workspace of Object.values(config.workspaces)) {
      results.push({
        workspace_id: workspace.workspace_id,
        workspace_name: workspace.workspace_name,
        access_key: workspace.access_key,
        access_secret: workspace.access_secret,
        is_current: config.current?.workspace_id === workspace.workspace_id,
      })
    }

    return results
  }

  async clearCredentials(): Promise<void> {
    await this.save({ current: null, workspaces: {}, default_bot: null })
  }

  async getDefaultBot(workspaceId?: string): Promise<string | null> {
    const config = await this.load()
    const wsId = workspaceId ?? config.current?.workspace_id
    if (wsId) {
      const workspace = config.workspaces[wsId]
      if (workspace?.default_bot) return workspace.default_bot
    }
    // Fall back to global default_bot for backward compatibility
    return config.default_bot
  }

  async setDefaultBot(name: string, workspaceId?: string): Promise<void> {
    const config = await this.load()
    const wsId = workspaceId ?? config.current?.workspace_id
    if (wsId && config.workspaces[wsId]) {
      config.workspaces[wsId].default_bot = name
    } else {
      // No workspace context — set global as fallback
      config.default_bot = name
    }
    await this.save(config)
  }
}
