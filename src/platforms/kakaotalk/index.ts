export { KakaoTalkClient, KakaoTalkError } from './client'
export { CredentialManager } from './credential-manager'
export type { PendingLoginState } from './credential-manager'
export type {
  KakaoAccountCredentials,
  KakaoChat,
  KakaoConfig,
  KakaoDeviceType,
  KakaoMessage,
  KakaoSendResult,
} from './types'
export {
  KakaoAccountCredentialsSchema,
  KakaoChatSchema,
  KakaoConfigSchema,
  KakaoMessageSchema,
  KakaoSendResultSchema,
} from './types'

import { KakaoTalkClient, KakaoTalkError } from './client'
import { CredentialManager } from './credential-manager'

export async function createKakaoTalkClient(): Promise<KakaoTalkClient> {
  const { ensureKakaoAuth } = await import('./ensure-auth')
  const account = await ensureKakaoAuth()
  return new KakaoTalkClient(account.oauth_token, account.user_id, account.device_uuid)
}
