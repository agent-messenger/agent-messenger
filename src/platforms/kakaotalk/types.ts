export interface ExtractedKakaoToken {
  oauth_token: string
  user_id: string
  refresh_token?: string
  device_uuid?: string
  agent_header?: string
  user_agent?: string
  xvc_header?: string
  login_form_body?: string
}

export interface KakaoAccountCredentials {
  account_id: string
  oauth_token: string
  user_id: string
  refresh_token?: string
  device_uuid?: string
  created_at: string
  updated_at: string
}

export interface KakaoConfig {
  current_account: string | null
  accounts: Record<string, KakaoAccountCredentials>
}
