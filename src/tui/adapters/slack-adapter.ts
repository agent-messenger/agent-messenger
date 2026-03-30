import { SlackClient } from '@/platforms/slack/client'
import { SlackCredentialManager } from '@/platforms/slack/credential-manager'
import { SlackListener } from '@/platforms/slack/listener'
import type { SlackRTMMessageEvent } from '@/platforms/slack/types'

import type { AuthHint, AuthIO, PlatformAdapter, UnifiedChannel, UnifiedMessage, Workspace } from './types'

export class SlackAdapter implements PlatformAdapter {
  readonly name = 'Slack'

  private client: SlackClient | null = null
  private listener: SlackListener | null = null
  private userMap: Map<string, string> = new Map()
  private credManager = new SlackCredentialManager()
  private currentWorkspace: Workspace | null = null

  async login(): Promise<void> {
    const client = new SlackClient()
    await client.login()
    await this.buildUserMap(client)

    const config = await this.credManager.load()
    if (config.current_workspace && config.workspaces[config.current_workspace]) {
      const ws = config.workspaces[config.current_workspace]
      this.currentWorkspace = { id: ws.workspace_id, name: ws.workspace_name }
    }
  }

  async getChannels(): Promise<UnifiedChannel[]> {
    const client = this.ensureClient()
    const channels = await client.listChannels()
    return channels.map((ch) => ({ id: ch.id, name: '#' + ch.name }))
  }

  async getMessages(channelId: string, limit = 50): Promise<UnifiedMessage[]> {
    const client = this.ensureClient()
    const messages = await client.getMessages(channelId, limit)
    return messages
      .map((msg) => ({
        id: msg.ts,
        channelId,
        author: this.userMap.get(msg.user ?? '') || msg.username || msg.user || 'unknown',
        content: msg.text,
        timestamp: msg.ts,
      }))
      .reverse()
  }

  async sendMessage(channelId: string, text: string): Promise<void> {
    const client = this.ensureClient()
    await client.sendMessage(channelId, text)
  }

  async startListening(onMessage: (msg: UnifiedMessage) => void): Promise<void> {
    const client = this.ensureClient()
    const listener = new SlackListener(client)
    await listener.start()
    listener.on('message', (event: SlackRTMMessageEvent) => {
      if (event.subtype) return
      onMessage({
        id: event.ts,
        channelId: event.channel,
        author: this.userMap.get(event.user ?? '') || event.user || 'unknown',
        content: event.text ?? '',
        timestamp: event.ts,
      })
    })
    this.listener = listener
  }

  stopListening(): void {
    this.listener?.stop()
    this.listener = null
  }

  async getWorkspaces(): Promise<Workspace[]> {
    const config = await this.credManager.load()
    return Object.values(config.workspaces).map((ws) => ({
      id: ws.workspace_id,
      name: ws.workspace_name,
    }))
  }

  async switchWorkspace(workspaceId: string): Promise<void> {
    this.stopListening()
    const creds = await this.credManager.getWorkspace(workspaceId)
    if (!creds) throw new Error(`Workspace ${workspaceId} not found`)

    const client = new SlackClient()
    await client.login({ token: creds.token, cookie: creds.cookie })
    await this.buildUserMap(client)
    await this.credManager.setCurrentWorkspace(workspaceId)
    this.currentWorkspace = { id: creds.workspace_id, name: creds.workspace_name }
  }

  getCurrentWorkspace(): Workspace | null {
    return this.currentWorkspace
  }

  getAuthHint(): AuthHint {
    return {
      command: 'agent-slack auth extract',
      description: 'Log in to the Slack desktop app, then run the command below to extract credentials.',
    }
  }

  async authenticate(io: AuthIO): Promise<void> {
    io.print('Extracting credentials from Slack desktop app...')
    await this.login()
  }

  private async buildUserMap(client: SlackClient): Promise<void> {
    this.client = client
    const users = await client.listUsers()
    const map = new Map<string, string>()
    for (const user of users) {
      map.set(user.id, user.real_name || user.name)
    }
    this.userMap = map
  }

  private ensureClient(): SlackClient {
    if (!this.client) {
      throw new Error('Not logged in. Call login() first.')
    }
    return this.client
  }
}
