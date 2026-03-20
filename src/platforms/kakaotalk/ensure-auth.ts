import { CredentialManager } from './credential-manager'
import { KakaoTokenExtractor } from './token-extractor'
import { reloginWithCachedForm, renewOAuthToken } from './token-renew'
import type { KakaoAccountCredentials } from './types'

export async function ensureKakaoAuth(): Promise<KakaoAccountCredentials> {
  const credManager = new CredentialManager()
  const existing = await credManager.getAccount()

  if (existing?.oauth_token && existing.oauth_token.length < 100) {
    return existing
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

  // The Cache.db REST token (~138 chars) doesn't work for LOCO LOGINLIST.
  // Try: 1) refresh_token renewal  2) relogin with cached login.json form
  let oauthToken = token.oauth_token
  let refreshToken = token.refresh_token
  let deviceUuid = token.device_uuid

  if (refreshToken) {
    try {
      const renewed = await renewOAuthToken(refreshToken, oauthToken)
      oauthToken = renewed.access_token
      refreshToken = renewed.refresh_token
    } catch {
      // refresh_token stale — fall through to relogin
    }
  }

  // If renewal didn't produce a short LOCO token, try full relogin
  if (oauthToken.length >= 100 && token.login_form_body) {
    try {
      const result = await reloginWithCachedForm(token.login_form_body)
      oauthToken = result.access_token
      refreshToken = result.refresh_token
      deviceUuid = deviceUuid || result.device_uuid
    } catch {
      // relogin failed — will proceed with what we have
    }
  }

  const account: KakaoAccountCredentials = {
    account_id: accountId,
    oauth_token: oauthToken,
    user_id: token.user_id,
    refresh_token: refreshToken,
    device_uuid: deviceUuid,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  }

  await credManager.setAccount(account)
  await credManager.setCurrentAccount(accountId)
  return account
}
