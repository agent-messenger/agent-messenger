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
  device_uuid: string
  device_type: KakaoDeviceType
  created_at: string
  updated_at: string
}

export interface KakaoConfig {
  current_account: string | null
  accounts: Record<string, KakaoAccountCredentials>
}

export type KakaoDeviceType = 'pc' | 'tablet'

export interface KakaoAuthOptions {
  email?: string
  password?: string
  passcode?: string
  deviceType?: KakaoDeviceType
  force?: boolean
  pretty?: boolean
  debug?: boolean
}

export interface KakaoLoginResult {
  authenticated: boolean
  next_action?: string
  message?: string
  warning?: string
  account_id?: string
  device_type?: KakaoDeviceType
  user_id?: string
  error?: string
  passcode?: string
  remaining_seconds?: number
}

export const KAKAO_NEXT_ACTIONS: Record<string, { next_action: string; message: string }> = {
  provide_email: { next_action: 'provide_email', message: 'Provide --email flag.' },
  provide_password: { next_action: 'provide_password', message: 'Provide --password flag.' },
  provide_passcode: {
    next_action: 'provide_passcode',
    message: 'SMS passcode sent to your phone. Provide --passcode flag.',
  },
  choose_device: {
    next_action: 'choose_device',
    message:
      'Tablet slot occupied. Provide --device-type pc or --device-type tablet with --force to replace.',
  },
}
