import { exec } from 'node:child_process'

import { getWebexAppCredentials } from '@/platforms/webex/app-config'
import { WebexClient } from '@/platforms/webex/client'
import { WebexCredentialManager } from '@/platforms/webex/credential-manager'

import type { AuthHint, AuthIO, PlatformAdapter, UnifiedChannel, UnifiedMessage } from './types'

export class WebexAdapter implements PlatformAdapter {
  readonly name = 'Webex'

  private client: WebexClient | null = null
  private personEmail: string | null = null

  async login(): Promise<void> {
    const client = new WebexClient()
    await client.login()
    const me = await client.testAuth()
    this.client = client
    this.personEmail = me.emails[0] ?? null
  }

  async getChannels(): Promise<UnifiedChannel[]> {
    this.ensureClient()
    const spaces = await this.client!.listSpaces()
    return spaces.map((space) => ({
      id: space.id,
      name: space.title,
    }))
  }

  async getMessages(channelId: string, limit = 50): Promise<UnifiedMessage[]> {
    this.ensureClient()
    const messages = await this.client!.listMessages(channelId, { max: limit })
    return messages
      .map((msg) => ({
        id: msg.id,
        channelId: msg.roomId,
        author: msg.personEmail,
        content: msg.text ?? '',
        timestamp: msg.created,
      }))
      .reverse()
  }

  async sendMessage(channelId: string, text: string): Promise<void> {
    this.ensureClient()
    await this.client!.sendMessage(channelId, text)
  }

  getAuthHint(): AuthHint {
    return {
      command: 'agent-webex auth login',
      description: 'Authenticate with Cisco Webex using OAuth Device Grant. Run the command below to start.',
    }
  }

  async authenticate(io: AuthIO): Promise<void> {
    const credManager = new WebexCredentialManager()
    const { clientId, clientSecret } = getWebexAppCredentials()

    io.print('Starting Webex OAuth Device Grant flow...')
    const device = await credManager.requestDeviceCode(clientId)

    io.print(`\nOpen this URL in your browser:\n  ${device.verificationUriComplete}`)
    io.print(`\nOr go to ${device.verificationUri} and enter code: ${device.userCode}`)
    openBrowser(device.verificationUriComplete)
    io.print('\nWaiting for authorization...')

    const config = await credManager.pollDeviceToken(
      device.deviceCode,
      device.interval,
      device.expiresIn,
      clientId,
      clientSecret,
    )
    await credManager.saveConfig(config)

    const client = new WebexClient()
    await client.login({ token: config.accessToken })
    const me = await client.testAuth()
    this.client = client
    this.personEmail = me.emails[0] ?? null

    io.print(`\nAuthenticated as ${me.displayName} (${this.personEmail})`)
  }

  private ensureClient(): void {
    if (!this.client) {
      throw new Error('Not logged in. Call login() first.')
    }
  }
}

function openBrowser(url: string): void {
  const command =
    process.platform === 'darwin'
      ? `open "${url}"`
      : process.platform === 'win32'
        ? `start "" "${url}"`
        : `xdg-open "${url}"`
  exec(command)
}
