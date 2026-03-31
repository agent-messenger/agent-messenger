import { WebexClient } from './client'
import { WebexCredentialManager } from './credential-manager'

export async function ensureWebexAuth(): Promise<void> {
  try {
    const credManager = new WebexCredentialManager()
    const config = await credManager.loadConfig()
    if (!config) return

    const token = await credManager.getToken(config.clientId, config.clientSecret)
    if (!token) return

    const client = new WebexClient()
    await client.login({ token })
    await client.testAuth()
  } catch {
    // Intentionally silent — best-effort preflight that should not block commands
  }
}
