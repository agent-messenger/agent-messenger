import { APP_VERSION } from './protocol/config'

export interface LoginResult {
  access_token: string
  refresh_token: string
  userId: number
  device_uuid: string
}

interface RenewResult {
  access_token: string
  refresh_token: string
  token_type: string
}

// Calls katalk.kakao.com/mac/account/renew_token.json to exchange a
// refresh_token for a fresh access_token usable with LOCO LOGINLIST.
export async function renewOAuthToken(
  refreshToken: string,
  currentAccessToken: string,
): Promise<RenewResult> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    access_token: currentAccessToken,
  })

  const response = await fetch('https://katalk.kakao.com/mac/account/renew_token.json', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'A': `mac/${APP_VERSION}/en`,
      'User-Agent': `KT/${APP_VERSION} Mc/${APP_VERSION} en`,
      'Accept': 'application/json',
    },
    body: body.toString(),
  })

  if (!response.ok) {
    throw new Error(`Token renewal failed: HTTP ${response.status}`)
  }

  const data = await response.json() as Record<string, unknown>

  if (typeof data.access_token !== 'string') {
    const status = data.status ?? data.error ?? 'unknown'
    throw new Error(`Token renewal rejected: ${status}`)
  }

  return {
    access_token: data.access_token as string,
    refresh_token: (data.refresh_token as string) ?? refreshToken,
    token_type: (data.token_type as string) ?? 'bearer',
  }
}

// Replays the cached login.json POST to get a fresh LOCO-compatible access_token.
// The formBody is the original URL-encoded POST body extracted from NSURLCache,
// containing email, password, device_uuid, etc. Password is only used in-memory.
export async function reloginWithCachedForm(formBody: string): Promise<LoginResult> {
  const { createHash } = await import('node:crypto')
  const params = new URLSearchParams(formBody)
  const email = params.get('email') ?? ''
  const deviceUuid = params.get('device_uuid') ?? ''

  // X-VC = SHA512("JAYDEN|{userAgent}|JAYMOND|{email}|{deviceUUID}")[:16]
  const ua = `KT/${APP_VERSION} Mc/${APP_VERSION} en`
  const xvcInput = `JAYDEN|${ua}|JAYMOND|${email}|${deviceUuid}`
  const xvc = createHash('sha512').update(xvcInput).digest('hex').substring(0, 16)

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'A': `mac/${APP_VERSION}/en`,
    'User-Agent': ua,
    'Accept': 'application/json',
    'X-VC': xvc,
  }

  const response = await fetch('https://katalk.kakao.com/mac/account/login.json', {
    method: 'POST',
    headers,
    body: formBody,
  })

  if (!response.ok) {
    throw new Error(`Relogin failed: HTTP ${response.status}`)
  }

  const data = await response.json() as Record<string, unknown>

  if (data.status !== 0 && typeof data.access_token !== 'string') {
    throw new Error(`Relogin rejected: status ${data.status}`)
  }

  return {
    access_token: data.access_token as string,
    refresh_token: data.refresh_token as string,
    userId: data.userId as number,
    device_uuid: data.deviceUUID as string ?? '',
  }
}
