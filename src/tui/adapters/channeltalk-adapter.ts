import { ChannelClient } from '@/platforms/channeltalk/client'
import { ChannelCredentialManager } from '@/platforms/channeltalk/credential-manager'

import type { AuthHint, AuthIO, PlatformAdapter, UnifiedChannel, UnifiedMessage, Workspace } from './types'

export class ChannelTalkAdapter implements PlatformAdapter {
  readonly name = 'Channel Talk'

  private client: ChannelClient | null = null
  private credManager = new ChannelCredentialManager()
  private currentWorkspace: Workspace | null = null
  private channelId: string | null = null

  async login(): Promise<void> {
    const client = new ChannelClient()
    await client.login()
    this.client = client

    const creds = await this.credManager.getCredentials()
    if (creds) {
      this.currentWorkspace = { id: creds.workspace_id, name: creds.workspace_name }
      this.channelId = creds.workspace_id
    }
  }

  async getChannels(): Promise<UnifiedChannel[]> {
    const client = this.ensureClient()
    if (!this.channelId) return []

    const groups = await client.listGroups(this.channelId)
    return groups.map((group) => ({
      id: group.id,
      name: group.name || group.title || group.id,
    }))
  }

  async getMessages(channelId: string, limit = 50): Promise<UnifiedMessage[]> {
    const client = this.ensureClient()
    if (!this.channelId) return []

    const messages = await client.getGroupMessages(this.channelId, channelId, { limit })
    return messages
      .map((msg) => ({
        id: msg.id,
        channelId,
        author: msg.personId ?? 'unknown',
        content: ChannelClient.extractText(msg),
        timestamp: msg.createdAt ? new Date(msg.createdAt).toISOString() : new Date().toISOString(),
      }))
      .reverse()
  }

  async sendMessage(channelId: string, text: string): Promise<void> {
    const client = this.ensureClient()
    if (!this.channelId) return

    const blocks = ChannelClient.wrapTextInBlocks(text)
    await client.sendGroupMessage(this.channelId, channelId, blocks)
  }

  async getWorkspaces(): Promise<Workspace[]> {
    const all = await this.credManager.listAll()
    return all.map((ws) => ({
      id: ws.workspace_id,
      name: ws.workspace_name,
    }))
  }

  async switchWorkspace(workspaceId: string): Promise<void> {
    const creds = await this.credManager.getCredentials(workspaceId)
    if (!creds) throw new Error(`Workspace ${workspaceId} not found`)

    const client = new ChannelClient()
    await client.login({ accountCookie: creds.account_cookie, sessionCookie: creds.session_cookie ?? undefined })
    this.client = client
    this.currentWorkspace = { id: creds.workspace_id, name: creds.workspace_name }
    this.channelId = creds.workspace_id
  }

  getCurrentWorkspace(): Workspace | null {
    return this.currentWorkspace
  }

  getAuthHint(): AuthHint {
    return {
      command: 'agent-channeltalk auth extract',
      description: 'Log in to the Channel Talk desktop app, then run the command below to extract credentials.',
    }
  }

  async authenticate(io: AuthIO): Promise<void> {
    io.print('Extracting credentials from Channel Talk desktop app...')
    await this.login()
  }

  private ensureClient(): ChannelClient {
    if (!this.client) {
      throw new Error('Not logged in. Call login() first.')
    }
    return this.client
  }
}
