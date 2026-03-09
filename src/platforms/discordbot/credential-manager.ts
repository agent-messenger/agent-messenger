import { existsSync } from 'node:fs'
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

import type { DiscordBotConfig, DiscordBotCredentials } from './types'
import { DiscordBotConfigSchema } from './types'

export class DiscordBotCredentialManager {
  private configDir: string
  private credentialsPath: string

  constructor(configDir?: string) {
    this.configDir = configDir ?? join(homedir(), '.config', 'agent-messenger')
    this.credentialsPath = join(this.configDir, 'discordbot-credentials.json')
  }

  async load(): Promise<DiscordBotConfig> {
    if (!existsSync(this.credentialsPath)) {
      return { current: null, bots: {}, current_server: null, servers: {} }
    }

    const content = await readFile(this.credentialsPath, 'utf-8')
    const parsed = DiscordBotConfigSchema.safeParse(JSON.parse(content))
    if (!parsed.success) {
      return { current: null, bots: {}, current_server: null, servers: {} }
    }
    return parsed.data
  }

  async save(config: DiscordBotConfig): Promise<void> {
    await mkdir(this.configDir, { recursive: true })
    await writeFile(this.credentialsPath, JSON.stringify(config, null, 2), { mode: 0o600 })
    await chmod(this.credentialsPath, 0o600)
  }

  async getCredentials(botId?: string): Promise<DiscordBotCredentials | null> {
    const envToken = process.env.E2E_DISCORDBOT_TOKEN
    const envServerId = process.env.E2E_DISCORDBOT_SERVER_ID
    const envServerName = process.env.E2E_DISCORDBOT_SERVER_NAME || 'E2E Server'

    if (envToken && !botId) {
      return {
        token: envToken,
        bot_id: 'env',
        bot_name: 'env',
        server_id: envServerId,
        server_name: envServerName,
      }
    }

    const config = await this.load()

    if (botId) {
      const bot = config.bots[botId]
      if (!bot) return null
      return {
        token: bot.token,
        bot_id: bot.bot_id,
        bot_name: bot.bot_name,
      }
    }

    if (!config.current) {
      return null
    }

    const bot = config.bots[config.current.bot_id]
    if (!bot) return null

    return {
      token: bot.token,
      bot_id: bot.bot_id,
      bot_name: bot.bot_name,
    }
  }

  async setCredentials(creds: DiscordBotCredentials): Promise<void> {
    const config = await this.load()

    config.bots[creds.bot_id] = {
      bot_id: creds.bot_id,
      bot_name: creds.bot_name,
      token: creds.token,
    }

    config.current = {
      bot_id: creds.bot_id,
    }

    await this.save(config)
  }

  async removeBot(botId: string): Promise<boolean> {
    const config = await this.load()

    if (!config.bots[botId]) {
      return false
    }

    delete config.bots[botId]

    if (config.current?.bot_id === botId) {
      config.current = null
    }

    await this.save(config)
    return true
  }

  async setCurrent(botId: string): Promise<boolean> {
    const config = await this.load()

    if (!config.bots[botId]) {
      return false
    }

    config.current = {
      bot_id: botId,
    }

    await this.save(config)
    return true
  }

  async listAll(): Promise<Array<DiscordBotCredentials & { is_current: boolean }>> {
    const config = await this.load()
    const results: Array<DiscordBotCredentials & { is_current: boolean }> = []

    for (const bot of Object.values(config.bots)) {
      results.push({
        token: bot.token,
        bot_id: bot.bot_id,
        bot_name: bot.bot_name,
        is_current: config.current?.bot_id === bot.bot_id,
      })
    }

    return results
  }

  async clearCredentials(): Promise<void> {
    await this.save({ current: null, bots: {}, current_server: null, servers: {} })
  }

  async getCurrentServer(): Promise<string | null> {
    const config = await this.load()
    return config.current_server
  }

  async setCurrentServer(serverId: string, serverName: string): Promise<void> {
    const config = await this.load()

    config.current_server = serverId
    config.servers[serverId] = {
      server_id: serverId,
      server_name: serverName,
    }

    await this.save(config)
  }
}
