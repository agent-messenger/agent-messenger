import { DiscordClient } from './client'
import { DiscordCredentialManager } from './credential-manager'
import { DiscordTokenExtractor } from './token-extractor'

export async function ensureDiscordAuth(): Promise<void> {
  try {
    const credManager = new DiscordCredentialManager()
    const token = await credManager.getToken()
    if (token) return

    const extractor = new DiscordTokenExtractor()
    const extracted = await extractor.extract()
    if (!extracted) return

    const client = new DiscordClient(extracted.token)
    const authInfo = await client.testAuth()
    if (!authInfo) return

    const servers = await client.listServers()
    const serverMap: Record<string, { server_id: string; server_name: string }> = {}
    for (const server of servers) {
      serverMap[server.id] = { server_id: server.id, server_name: server.name }
    }

    await credManager.save({
      token: extracted.token,
      current_server: servers[0]?.id ?? null,
      servers: serverMap,
    })
  } catch {}
}
