import { TeamsClient } from '@/platforms/teams/client'

import type { AuthHint, AuthIO, PlatformAdapter, UnifiedChannel, UnifiedMessage, Workspace } from './types'

export class TeamsAdapter implements PlatformAdapter {
  readonly name = 'Teams'

  private client: TeamsClient | null = null
  private teamId: string | null = null
  private teamName: string | null = null
  private teams: Workspace[] = []

  async login(): Promise<void> {
    this.client = new TeamsClient()
    await this.client.login()
    const teams = await this.client.listTeams()
    if (!teams.length) throw new Error('No Teams found')
    this.teams = teams.map((t) => ({ id: t.id, name: t.name }))
    this.teamId = teams[0].id
    this.teamName = teams[0].name
  }

  async getChannels(): Promise<UnifiedChannel[]> {
    this.ensureClient()
    const channels = await this.client!.listChannels(this.teamId!)
    return channels.map((ch) => ({
      id: ch.id,
      name: ch.name,
      parentId: this.teamId!,
    }))
  }

  async getMessages(channelId: string, limit = 50): Promise<UnifiedMessage[]> {
    this.ensureClient()
    const messages = await this.client!.getMessages(this.teamId!, channelId, limit)
    return messages
      .map((msg) => ({
        id: msg.id,
        channelId,
        author: msg.author.displayName || 'unknown',
        content: this.stripHtml(msg.content),
        timestamp: msg.timestamp,
      }))
      .reverse()
  }

  async sendMessage(channelId: string, text: string): Promise<void> {
    this.ensureClient()
    await this.client!.sendMessage(this.teamId!, channelId, text)
  }

  async getWorkspaces(): Promise<Workspace[]> {
    return this.teams
  }

  async switchWorkspace(teamId: string): Promise<void> {
    const team = this.teams.find((t) => t.id === teamId)
    if (!team) throw new Error(`Team ${teamId} not found`)
    this.teamId = team.id
    this.teamName = team.name
  }

  getCurrentWorkspace(): Workspace | null {
    if (!this.teamId || !this.teamName) return null
    return { id: this.teamId, name: this.teamName }
  }

  getAuthHint(): AuthHint {
    return {
      command: 'agent-teams auth extract',
      description: 'Log in to the Microsoft Teams desktop app, then run the command below to extract credentials.',
    }
  }

  async authenticate(io: AuthIO): Promise<void> {
    io.print('Extracting credentials from Microsoft Teams desktop app...')
    await this.login()
  }

  private ensureClient(): void {
    if (!this.client || !this.teamId) throw new Error('Not logged in')
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim()
  }
}
