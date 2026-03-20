import { CredentialManager } from './credential-manager'
import { KakaoTokenExtractor } from './token-extractor'
import type { KakaoAccountCredentials } from './types'

export async function ensureKakaoAuth(): Promise<KakaoAccountCredentials> {
  const credManager = new CredentialManager()
  const account = await credManager.getAccount()

  if (account?.oauth_token) {
    return account
  }

  const extractor = new KakaoTokenExtractor()
  const token = await extractor.extract()

  if (!token) {
    throw new Error(
      'No KakaoTalk credentials found. Make sure the KakaoTalk desktop app is installed and logged in, then run: agent-kakaotalk auth extract',
    )
  }

  const accountId = token.user_id || 'default'
  const now = new Date().toISOString()
  const newAccount: KakaoAccountCredentials = {
    account_id: accountId,
    oauth_token: token.oauth_token,
    user_id: token.user_id,
    refresh_token: token.refresh_token,
    device_uuid: token.device_uuid,
    created_at: now,
    updated_at: now,
  }

  await credManager.setAccount(newAccount)
  await credManager.setCurrentAccount(accountId)
  return newAccount
}
