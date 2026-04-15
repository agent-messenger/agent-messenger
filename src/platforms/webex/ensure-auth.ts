import { WebexClient } from './client'
import { WebexCredentialManager } from './credential-manager'
import { WebexTokenExtractor } from './token-extractor'

export async function ensureWebexAuth(): Promise<void> {
  try {
    const credManager = new WebexCredentialManager()
    const config = await credManager.loadConfig()

    if (config) {
      const token = await credManager.getToken(config.clientId, config.clientSecret)
      if (token) {
        const client = new WebexClient()
        await client.login({
          token,
          deviceUrl: config.deviceUrl,
          tokenType: config.tokenType,
        })
        await client.testAuth()
        return
      }
    }

    const extractor = new WebexTokenExtractor()
    const extracted = await extractor.extract()
    if (!extracted) return

    const client = new WebexClient()
    await client.login({
      token: extracted.accessToken,
      deviceUrl: extracted.deviceUrl,
      tokenType: 'extracted',
    })
    await client.testAuth()

    await credManager.saveConfig({
      accessToken: extracted.accessToken,
      refreshToken: extracted.refreshToken ?? '',
      expiresAt: extracted.expiresAt ?? 0,
      tokenType: 'extracted',
      deviceUrl: extracted.deviceUrl,
      userId: extracted.userId,
      encryptionKeys: extracted.encryptionKeys ? Object.fromEntries(extracted.encryptionKeys) : undefined,
    })
  } catch {
    // Intentionally silent — best-effort preflight that should not block commands
  }
}
