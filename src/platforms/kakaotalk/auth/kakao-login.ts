import { createHash, randomBytes } from 'node:crypto'

import { APP_VERSION } from '../protocol/config'
import type { KakaoDeviceType, KakaoLoginResult } from '../types'

// Android sub-device agent identity. Using Android (tablet) avoids conflicting
// with the macOS desktop app's PC slot. See protocol/NOTICE.md for attribution.
const ANDROID_AGENT = `android/${APP_VERSION}`
const ANDROID_USER_AGENT = `KT/${APP_VERSION} An/${APP_VERSION} en`
const ANDROID_LOGIN_URL = 'https://katalk.kakao.com/android/account/login.json'
const ANDROID_PASSCODE_URL = 'https://katalk.kakao.com/android/account/request_passcode.json'
const ANDROID_REGISTER_URL = 'https://katalk.kakao.com/android/account/register_device.json'

const DEVICE_NAME = 'agent-messenger'

function generateDeviceUuid(): string {
  return randomBytes(20).toString('hex')
}

// X-VC for Android: SHA512("BARD|{userAgent}|DANTE|{email}|SIAN")[:16]
function computeXVC(email: string): string {
  const input = `BARD|${ANDROID_USER_AGENT}|DANTE|${email}|SIAN`
  return createHash('sha512').update(input).digest('hex').substring(0, 16)
}

function buildHeaders(email: string): Record<string, string> {
  return {
    'Content-Type': 'application/x-www-form-urlencoded',
    'A': ANDROID_AGENT,
    'User-Agent': ANDROID_USER_AGENT,
    'Accept': 'application/json',
    'X-VC': computeXVC(email),
  }
}

interface LoginResponse {
  status: number
  access_token?: string
  refresh_token?: string
  userId?: number
  mainDeviceAgentName?: string
  [key: string]: unknown
}

export interface LoginCredentials {
  access_token: string
  refresh_token: string
  user_id: string
  device_uuid: string
  device_type: KakaoDeviceType
}

const STATUS_OK = 0
const STATUS_DEVICE_NOT_REGISTERED = -100

export async function attemptLogin(
  email: string,
  password: string,
  deviceUuid: string,
  deviceType: KakaoDeviceType,
  forced: boolean,
): Promise<KakaoLoginResult & { credentials?: LoginCredentials }> {
  const body = new URLSearchParams({
    email,
    password,
    device_uuid: deviceUuid,
    device_name: DEVICE_NAME,
    os_version: '13.0',
    permanent: 'true',
    forced: forced ? 'true' : 'false',
  })

  const response = await fetch(ANDROID_LOGIN_URL, {
    method: 'POST',
    headers: buildHeaders(email),
    body: body.toString(),
  })

  const data = (await response.json()) as LoginResponse

  if (data.status === STATUS_OK && data.access_token) {
    return {
      authenticated: true,
      account_id: String(data.userId ?? ''),
      user_id: String(data.userId ?? ''),
      device_type: deviceType,
      credentials: {
        access_token: data.access_token,
        refresh_token: data.refresh_token ?? '',
        user_id: String(data.userId ?? ''),
        device_uuid: deviceUuid,
        device_type: deviceType,
      },
    }
  }

  if (data.status === STATUS_DEVICE_NOT_REGISTERED) {
    return {
      authenticated: false,
      next_action: 'provide_passcode',
      message: 'Device not registered. SMS passcode sent to your phone.',
    }
  }

  return {
    authenticated: false,
    error: `login_failed`,
    message: `Login failed with status ${data.status}`,
  }
}

export async function requestPasscode(email: string, password: string, deviceUuid: string): Promise<KakaoLoginResult> {
  const body = new URLSearchParams({
    email,
    password,
    device_uuid: deviceUuid,
    device_name: DEVICE_NAME,
    os_version: '13.0',
    permanent: 'true',
  })

  const response = await fetch(ANDROID_PASSCODE_URL, {
    method: 'POST',
    headers: buildHeaders(email),
    body: body.toString(),
  })

  const data = (await response.json()) as { status: number }

  if (data.status === STATUS_OK) {
    return {
      authenticated: false,
      next_action: 'provide_passcode',
      message: 'SMS passcode sent to your phone.',
    }
  }

  return {
    authenticated: false,
    error: 'passcode_request_failed',
    message: `Passcode request failed with status ${data.status}`,
  }
}

export async function registerDevice(
  email: string,
  password: string,
  passcode: string,
  deviceUuid: string,
): Promise<KakaoLoginResult> {
  const body = new URLSearchParams({
    email,
    password,
    device_uuid: deviceUuid,
    device_name: DEVICE_NAME,
    os_version: '13.0',
    permanent: 'true',
    passcode,
  })

  const response = await fetch(ANDROID_REGISTER_URL, {
    method: 'POST',
    headers: buildHeaders(email),
    body: body.toString(),
  })

  const data = (await response.json()) as { status: number }

  if (data.status === STATUS_OK) {
    return { authenticated: false, message: 'Device registered. Proceeding to login...' }
  }

  return {
    authenticated: false,
    error: 'registration_failed',
    message: `Device registration failed with status ${data.status}`,
  }
}

export async function loginFlow(options: {
  email: string
  password: string
  passcode?: string
  deviceType?: KakaoDeviceType
  force?: boolean
  savedDeviceUuid?: string
}): Promise<KakaoLoginResult & { credentials?: LoginCredentials }> {
  const deviceType = options.deviceType ?? 'tablet'
  const deviceUuid = options.savedDeviceUuid ?? generateDeviceUuid()
  const forced = options.force ?? false

  // Step 1: Try login (forced:false for tablet-first safe attempt)
  const loginResult = await attemptLogin(options.email, options.password, deviceUuid, deviceType, forced)

  if (loginResult.authenticated) {
    return loginResult
  }

  if (loginResult.next_action === 'provide_passcode') {
    if (!options.passcode) {
      // Request passcode SMS
      const passcodeResult = await requestPasscode(options.email, options.password, deviceUuid)
      return {
        ...passcodeResult,
        // Pass back the device UUID so the next call can reuse it
        credentials: {
          access_token: '',
          refresh_token: '',
          user_id: '',
          device_uuid: deviceUuid,
          device_type: deviceType,
        },
      }
    }

    // Step 2: Register with passcode
    const regResult = await registerDevice(options.email, options.password, options.passcode, deviceUuid)
    if (regResult.error) {
      return regResult
    }

    // Step 3: Login again after registration
    return attemptLogin(options.email, options.password, deviceUuid, deviceType, forced)
  }

  // Slot occupied — need user to choose device type or force
  if (!forced && loginResult.error === 'login_failed') {
    return {
      authenticated: false,
      next_action: 'choose_device',
      message: `${deviceType} slot may be occupied. Use --device-type with --force to replace, or try a different slot.`,
      warning: `Using --force will kick the existing ${deviceType} session.`,
    }
  }

  return loginResult
}

export { generateDeviceUuid }
