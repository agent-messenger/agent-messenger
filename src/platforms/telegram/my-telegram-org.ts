import { TelegramError } from './types'

const MY_TELEGRAM_URL = 'https://my.telegram.org'
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'

export async function provisionTelegramApp(options: {
  phone: string
  promptForCode: () => Promise<string>
}): Promise<{ api_id: number; api_hash: string }> {
  const randomHash = await sendCode(options.phone)
  const code = await options.promptForCode()
  const stelToken = await login(options.phone, randomHash, code)
  return getOrCreateApp(stelToken)
}

async function sendCode(phone: string): Promise<string> {
  const response = await fetch(`${MY_TELEGRAM_URL}/auth/send_password`, {
    method: 'POST',
    headers: createAjaxHeaders(),
    body: new URLSearchParams({ phone }),
  })

  const text = await response.text()

  if (text.includes('Sorry, too many tries')) {
    throw new TelegramError('Too many attempts. Try again later.', 'rate_limited')
  }

  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new TelegramError('Failed to parse my.telegram.org response', 'parse_error')
  }

  const randomHash = extractRandomHash(data)
  if (!randomHash) {
    throw new TelegramError('Failed to parse my.telegram.org response', 'parse_error')
  }

  return randomHash
}

async function login(phone: string, randomHash: string, code: string): Promise<string> {
  const response = await fetch(`${MY_TELEGRAM_URL}/auth/login`, {
    method: 'POST',
    headers: createAjaxHeaders(),
    body: new URLSearchParams({
      phone,
      random_hash: randomHash,
      password: code,
    }),
    redirect: 'manual',
  })

  const text = await response.text()

  if (text === 'Invalid confirmation code!') {
    throw new TelegramError('Invalid confirmation code', 'invalid_code')
  }

  if (text !== 'true') {
    throw new TelegramError('Failed to parse my.telegram.org response', 'parse_error')
  }

  const stelToken = extractCookieValue(response.headers, 'stel_token')
  if (!stelToken) {
    throw new TelegramError('Failed to parse my.telegram.org response', 'parse_error')
  }

  return stelToken
}

async function getOrCreateApp(stelToken: string): Promise<{ api_id: number; api_hash: string }> {
  const response = await fetch(`${MY_TELEGRAM_URL}/apps`, {
    headers: {
      Cookie: `stel_token=${stelToken}`,
      'User-Agent': USER_AGENT,
    },
  })

  const html = await response.text()

  if (isAppConfigurationPage(html)) {
    return extractAppCredentials(html)
  }

  if (!isCreateApplicationPage(html)) {
    throw new TelegramError('Failed to parse my.telegram.org response', 'parse_error')
  }

  const creationHash = extractCreationHash(html)
  if (!creationHash) {
    throw new TelegramError('Failed to parse my.telegram.org response', 'parse_error')
  }

  const createResponse = await fetch(`${MY_TELEGRAM_URL}/apps/create`, {
    method: 'POST',
    headers: {
      ...createFormHeaders(),
      Cookie: `stel_token=${stelToken}`,
    },
    body: new URLSearchParams({
      hash: creationHash,
      app_title: 'agentmessenger',
      app_shortname: 'agentmessenger',
      app_platform: 'other',
      app_url: '',
      app_desc: '',
    }),
  })

  return extractAppCredentials(await createResponse.text())
}

function createAjaxHeaders(): Record<string, string> {
  return {
    ...createFormHeaders(),
    Origin: MY_TELEGRAM_URL,
    'X-Requested-With': 'XMLHttpRequest',
  }
}

function createFormHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'User-Agent': USER_AGENT,
  }
}

function extractRandomHash(data: unknown): string | null {
  if (!data || typeof data !== 'object') {
    return null
  }

  const randomHash = (data as { random_hash?: unknown }).random_hash
  return typeof randomHash === 'string' && randomHash ? randomHash : null
}

function extractCookieValue(headers: Headers, cookieName: string): string | null {
  const cookiePattern = new RegExp(`(?:^|;\\s*)${escapeRegExp(cookieName)}=([^;]+)`)
  const setCookieHeaders = getSetCookieHeaders(headers)

  for (const header of setCookieHeaders) {
    const match = header.match(cookiePattern)
    if (match) {
      return match[1]
    }
  }

  return null
}

function getSetCookieHeaders(headers: Headers): string[] {
  const headersWithGetSetCookie = headers as Headers & { getSetCookie?: () => string[] }
  if (typeof headersWithGetSetCookie.getSetCookie === 'function') {
    return headersWithGetSetCookie.getSetCookie()
  }

  const singleHeader = headers.get('set-cookie')
  return singleHeader ? [singleHeader] : []
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isAppConfigurationPage(html: string): boolean {
  return /<title>\s*App configuration\s*<\/title>/i.test(html)
}

function isCreateApplicationPage(html: string): boolean {
  return /<title>\s*Create new application\s*<\/title>/i.test(html)
}

function extractAppCredentials(html: string): { api_id: number; api_hash: string } {
  const apiIdMatch = html.match(/<span class="form-control input-xlarge uneditable-input"[^>]*><strong>(\d+)<\/strong><\/span>/)
  const apiHashMatch = html.match(/<span class="form-control input-xlarge uneditable-input"[^>]*>([a-f0-9]{32})<\/span>/)

  if (!apiIdMatch?.[1] || !apiHashMatch?.[1]) {
    throw new TelegramError('Failed to parse my.telegram.org response', 'parse_error')
  }

  return {
    api_id: Number(apiIdMatch[1]),
    api_hash: apiHashMatch[1],
  }
}

function extractCreationHash(html: string): string | null {
  const hashMatch = html.match(/<input[^>]*name="hash"[^>]*value="([^"]+)"/)
  return hashMatch?.[1] ?? null
}
