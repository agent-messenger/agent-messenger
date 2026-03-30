import { DiscordClient } from '@/platforms/discord/client'
import { DiscordListener } from '@/platforms/discord/listener'

import type { AuthHint, AuthIO, PlatformAdapter, UnifiedChannel, UnifiedMessage, Workspace } from './types'

export class DiscordAdapter implements PlatformAdapter {
  readonly name = 'Discord'

  private client: DiscordClient | null = null
  private listener: DiscordListener | null = null
  private serverId: string | null = null
  private serverName: string | null = null
  private servers: Workspace[] = []

  async login(): Promise<void> {
    const client = new DiscordClient()
    await client.login()
    const servers = await client.listServers()
    if (servers.length === 0) {
      throw new Error('No Discord servers found')
    }
    this.client = client
    this.servers = servers.map((s) => ({ id: s.id, name: s.name }))
    this.serverId = servers[0].id
    this.serverName = servers[0].name
  }

  async getChannels(): Promise<UnifiedChannel[]> {
    this.ensureClient()
    const channels = await this.client!.listChannels(this.serverId!)
    return channels
      .filter((ch) => ch.type === 0)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((ch) => ({ id: ch.id, name: '#' + ch.name, parentId: this.serverId! }))
  }

  async getMessages(channelId: string, limit = 50): Promise<UnifiedMessage[]> {
    this.ensureClient()
    const messages = await this.client!.getMessages(channelId, limit)
    return messages
      .map((msg) => ({
        id: msg.id,
        channelId: msg.channel_id,
        author: msg.author.username,
        content: msg.content,
        timestamp: msg.timestamp,
      }))
      .reverse()
  }

  async sendMessage(channelId: string, text: string): Promise<void> {
    this.ensureClient()
    await this.client!.sendMessage(channelId, text)
  }

  async startListening(onMessage: (msg: UnifiedMessage) => void): Promise<void> {
    this.ensureClient()
    const listener = new DiscordListener(this.client!)
    await listener.start()
    listener.on('message_create', (event) => {
      if (event.guild_id !== this.serverId) return
      onMessage({
        id: event.id,
        channelId: event.channel_id,
        author: event.author.username,
        content: event.content,
        timestamp: event.timestamp,
      })
    })
    this.listener = listener
  }

  stopListening(): void {
    this.listener?.stop()
    this.listener = null
  }

  async getWorkspaces(): Promise<Workspace[]> {
    return this.servers
  }

  async switchWorkspace(serverId: string): Promise<void> {
    this.stopListening()
    const server = this.servers.find((s) => s.id === serverId)
    if (!server) throw new Error(`Server ${serverId} not found`)
    this.serverId = server.id
    this.serverName = server.name
  }

  getCurrentWorkspace(): Workspace | null {
    if (!this.serverId || !this.serverName) return null
    return { id: this.serverId, name: this.serverName }
  }

  getAuthHint(): AuthHint {
    return {
      command: 'agent-discord auth extract',
      description: 'Log in to the Discord desktop app, then run the command below to extract credentials.',
    }
  }

  async authenticate(io: AuthIO): Promise<void> {
    io.print('Extracting credentials from Discord desktop app...')
    await this.login()
  }

  private ensureClient(): void {
    if (!this.client) {
      throw new Error('Not logged in. Call login() first.')
    }
  }
}
