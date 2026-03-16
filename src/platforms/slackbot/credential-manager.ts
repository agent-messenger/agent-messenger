import { existsSync } from 'node:fs'
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

import type { SlackBotConfig, SlackBotCredentials, SlackBotWorkspace } from './types'

export class SlackBotCredentialManager {
  private configDir: string
  private credentialsPath: string

  constructor(configDir?: string) {
    this.configDir = configDir ?? join(homedir(), '.config', 'agent-messenger')
    this.credentialsPath = join(this.configDir, 'slackbot-credentials.json')
  }

  async load(): Promise<SlackBotConfig> {
    if (!existsSync(this.credentialsPath)) {
      return { current: null, workspaces: {} }
    }

    const content = await readFile(this.credentialsPath, 'utf-8')
    return JSON.parse(content) as SlackBotConfig
  }

  async save(config: SlackBotConfig): Promise<void> {
    await mkdir(this.configDir, { recursive: true })
    await writeFile(this.credentialsPath, JSON.stringify(config, null, 2))
    await chmod(this.credentialsPath, 0o600)
  }

  async getCredentials(botId?: string): Promise<SlackBotCredentials | null> {
    const config = await this.load()

    if (botId) {
      return this.findBot(config, botId)
    }

    const envToken = process.env.E2E_SLACKBOT_TOKEN
    const envWorkspaceId = process.env.E2E_SLACKBOT_WORKSPACE_ID
    const envWorkspaceName = process.env.E2E_SLACKBOT_WORKSPACE_NAME

    if (envToken && envWorkspaceId && envWorkspaceName) {
      return {
        token: envToken,
        workspace_id: envWorkspaceId,
        workspace_name: envWorkspaceName,
        bot_id: 'env',
        bot_name: 'env',
      }
    }

    if (!config.current) {
      return null
    }

    const workspace = config.workspaces[config.current.workspace_id]
    if (!workspace) return null

    const bot = workspace.bots[config.current.bot_id]
    if (!bot) return null

    return {
      token: bot.token,
      workspace_id: workspace.workspace_id,
      workspace_name: workspace.workspace_name,
      bot_id: bot.bot_id,
      bot_name: bot.bot_name,
    }
  }

  private findBot(config: SlackBotConfig, botId: string): SlackBotCredentials | null {
    // Try "workspace_id/bot_id" format first
    if (botId.includes('/')) {
      const [workspaceId, id] = botId.split('/')
      const workspace = config.workspaces[workspaceId]
      if (!workspace) return null
      const bot = workspace.bots[id]
      if (!bot) return null
      return {
        token: bot.token,
        workspace_id: workspace.workspace_id,
        workspace_name: workspace.workspace_name,
        bot_id: bot.bot_id,
        bot_name: bot.bot_name,
      }
    }

    // Search by bot_id across all workspaces — must be unique
    const matches: SlackBotCredentials[] = []
    for (const workspace of Object.values(config.workspaces)) {
      const bot = workspace.bots[botId]
      if (bot) {
        matches.push({
          token: bot.token,
          workspace_id: workspace.workspace_id,
          workspace_name: workspace.workspace_name,
          bot_id: bot.bot_id,
          bot_name: bot.bot_name,
        })
      }
    }

    if (matches.length === 1) return matches[0]
    return null
  }

  async setCredentials(creds: SlackBotCredentials): Promise<void> {
    const config = await this.load()

    if (!config.workspaces[creds.workspace_id]) {
      config.workspaces[creds.workspace_id] = {
        workspace_id: creds.workspace_id,
        workspace_name: creds.workspace_name,
        bots: {},
      }
    }

    const workspace = config.workspaces[creds.workspace_id]
    workspace.workspace_name = creds.workspace_name
    workspace.bots[creds.bot_id] = {
      bot_id: creds.bot_id,
      bot_name: creds.bot_name,
      token: creds.token,
    }

    config.current = {
      workspace_id: creds.workspace_id,
      bot_id: creds.bot_id,
    }

    await this.save(config)
  }

  async removeBot(botId: string): Promise<boolean> {
    const config = await this.load()

    if (botId.includes('/')) {
      const [workspaceId, id] = botId.split('/')
      const workspace = config.workspaces[workspaceId]
      if (!workspace || !workspace.bots[id]) return false

      delete workspace.bots[id]
      if (Object.keys(workspace.bots).length === 0) {
        delete config.workspaces[workspaceId]
      }

      if (config.current?.workspace_id === workspaceId && config.current?.bot_id === id) {
        config.current = null
      }

      await this.save(config)
      return true
    }

    const matches: { workspace: SlackBotWorkspace }[] = []
    for (const workspace of Object.values(config.workspaces)) {
      if (workspace.bots[botId]) {
        matches.push({ workspace })
      }
    }

    if (matches.length !== 1) return false

    const { workspace } = matches[0]
    delete workspace.bots[botId]
    if (Object.keys(workspace.bots).length === 0) {
      delete config.workspaces[workspace.workspace_id]
    }
    if (config.current?.workspace_id === workspace.workspace_id && config.current?.bot_id === botId) {
      config.current = null
    }
    await this.save(config)
    return true
  }

  async setCurrent(botId: string): Promise<boolean> {
    const config = await this.load()
    const creds = this.findBot(config, botId)
    if (!creds) return false

    config.current = {
      workspace_id: creds.workspace_id,
      bot_id: creds.bot_id,
    }

    await this.save(config)
    return true
  }

  async listAll(): Promise<Array<SlackBotCredentials & { is_current: boolean }>> {
    const config = await this.load()
    const results: Array<SlackBotCredentials & { is_current: boolean }> = []

    for (const workspace of Object.values(config.workspaces)) {
      for (const bot of Object.values(workspace.bots)) {
        results.push({
          token: bot.token,
          workspace_id: workspace.workspace_id,
          workspace_name: workspace.workspace_name,
          bot_id: bot.bot_id,
          bot_name: bot.bot_name,
          is_current: config.current?.workspace_id === workspace.workspace_id && config.current?.bot_id === bot.bot_id,
        })
      }
    }

    return results
  }

  async clearCredentials(): Promise<void> {
    await this.save({ current: null, workspaces: {} })
  }
}
