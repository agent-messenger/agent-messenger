import { CredentialManager } from './credential-manager'
import type { KakaoAccountCredentials } from './types'

export async function ensureKakaoAuth(): Promise<KakaoAccountCredentials> {
  const credManager = new CredentialManager()
  const account = await credManager.getAccount()

  if (account?.oauth_token) {
    return account
  }

  throw new Error(
    'No KakaoTalk credentials found. Run one of:\n' +
      '  agent-kakaotalk auth login     (recommended — keeps desktop app running)\n' +
      '  agent-kakaotalk auth extract   (reads desktop app token — must quit app first)',
  )
}
