import { WebexClient } from './client'
import { WebexCredentialManager } from './credential-manager'

export async function ensureWebexAuth(): Promise<void> {
  try {
    const credManager = new WebexCredentialManager()
    const token = await credManager.getToken()

    if (!token) return

    const client = new WebexClient()
    await client.login({ token })
    await client.testAuth()
  } catch {}
}
