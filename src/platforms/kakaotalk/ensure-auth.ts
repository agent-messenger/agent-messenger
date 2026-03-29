import { CredentialManager } from './credential-manager'
import type { KakaoAccountCredentials } from './types'

export async function ensureKakaoAuth(accountId?: string): Promise<KakaoAccountCredentials> {
  const credManager = new CredentialManager()
  const account = await credManager.getAccount(accountId)

  if (account?.oauth_token) {
    return account
  }

  throw new Error(
    'No KakaoTalk credentials found. Run:\n' +
      '  agent-kakaotalk auth login     (recommended — registers as sub-device, desktop app stays running)',
  )
}
