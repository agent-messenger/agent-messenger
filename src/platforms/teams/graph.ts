import type { TeamsChannel, TeamsFile, TeamsMessage, TeamsTeam, TeamsUser } from './types'
import { TeamsError } from './types'

type RecordValue = Record<string, any>
const BASE = 'https://graph.microsoft.com/v1.0'
export const segment = (value: string): string => encodeURIComponent(value)

// Render text for agents while retaining the untouched server body separately.
export function messageText(html: string): string {
  return html
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(?:p|div|li|h[1-6]|blockquote|pre)>\s*(?=<|$)/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(
      /&(?:amp|lt|gt|quot|apos|nbsp|#39);/g,
      (value) =>
        ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ', '&#39;': "'" })[
          value
        ] ?? value,
    )
    .replace(/&#(x[\da-f]+|\d+);/gi, (value, code: string) => {
      const number = code[0].toLowerCase() === 'x' ? parseInt(code.slice(1), 16) : Number(code)
      return number <= 0x10ffff ? String.fromCodePoint(number) : value
    })
    .replace(/^\n|\n$/g, '')
}

export function graphMessage(raw: RecordValue, channelId: string, rootId?: string): TeamsMessage {
  const author = raw.from?.user ?? raw.from?.application ?? {}
  const replyId = rootId ?? raw.replyToId ?? undefined
  return {
    id: raw.id,
    channel_id: channelId,
    author: { id: author.id ?? '', displayName: author.displayName ?? 'Unknown' },
    content: raw.body?.contentType === 'text' ? (raw.body.content ?? '') : messageText(raw.body?.content ?? ''),
    timestamp: raw.createdDateTime ?? '',
    ...(replyId ? { root_message_id: replyId, parent_message_id: replyId, is_thread_reply: true } : {}),
    raw_content: raw.body?.content ?? '',
    content_type: raw.body?.contentType ?? 'html',
    mentions: raw.mentions ?? [],
    attachments: raw.attachments ?? [],
    edited_at: raw.lastEditedDateTime ?? undefined,
    deleted_at: raw.deletedDateTime ?? undefined,
    raw,
  }
}

export const graphTeam = (raw: RecordValue): TeamsTeam => ({
  id: raw.id,
  name: raw.displayName,
  description: raw.description,
})
export const graphChannel = (raw: RecordValue, teamId: string): TeamsChannel => ({
  id: raw.id,
  team_id: teamId,
  name: raw.displayName,
  type: raw.membershipType,
})
export const graphUser = (raw: RecordValue): TeamsUser => ({
  id: raw.userId ?? raw.id,
  displayName: raw.displayName,
  email: raw.email ?? raw.mail,
  userPrincipalName: raw.userPrincipalName,
})
export const graphFile = (raw: RecordValue, driveId: string): TeamsFile => ({
  id: raw.id,
  name: raw.name,
  size: raw.size ?? 0,
  url: raw.webUrl ?? '',
  contentType: raw.file?.mimeType,
  drive_id: driveId,
  is_folder: Boolean(raw.folder),
})

export class TeamsGraph {
  constructor(private token: () => Promise<string>) {}

  async request<T = RecordValue>(method: string, path: string, body?: unknown, binary?: Uint8Array): Promise<T> {
    const url = path.startsWith('/') ? BASE + path : path
    if (!url.startsWith(BASE + '/')) throw new TeamsError('Untrusted Graph pagination URL.', 'untrusted_pagination')
    const accessToken = await this.token()
    const attempts = method === 'GET' ? 3 : 0
    for (let attempt = 0; attempt <= attempts; attempt++) {
      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': binary ? 'application/octet-stream' : 'application/json',
        },
        body: binary
          ? (binary as unknown as RequestInit['body'])
          : body === undefined
            ? undefined
            : JSON.stringify(body),
      })
      if ((response.status === 429 || response.status >= 500) && attempt < attempts) {
        const wait = response.headers.get('Retry-After')
        const delay = wait && /^\d+(?:\.\d+)?$/.test(wait) ? Number(wait) * 1000 : 100 * 2 ** attempt
        await new Promise((resolve) => setTimeout(resolve, Math.min(delay, 60000)))
        continue
      }
      if (response.status === 204) return undefined as T
      const result = (await response.json().catch(() => ({}))) as RecordValue
      if (!response.ok)
        throw new TeamsError(
          result.error?.message ?? `HTTP ${response.status}`,
          result.error?.code ?? `graph_${response.status}`,
        )
      return result as T
    }
    throw new TeamsError('Graph request exhausted retries.', 'graph_retries')
  }

  async collection(path: string, limit = Number.MAX_SAFE_INTEGER): Promise<RecordValue[]> {
    if (!Number.isSafeInteger(limit) || limit < 1)
      throw new TeamsError('Limit must be a positive integer.', 'invalid_pagination')
    const values: RecordValue[] = [],
      seen = new Set<string>()
    let next: string | undefined = path
    while (next && values.length < limit) {
      if (seen.has(next)) throw new TeamsError('Repeated Graph pagination cursor.', 'repeated_pagination')
      seen.add(next)
      const page: RecordValue = await this.request('GET', next)
      if (!Array.isArray(page.value))
        throw new TeamsError('Graph collection missing value array.', 'invalid_graph_response')
      values.push(...page.value.slice(0, limit - values.length))
      next = page['@odata.nextLink']
    }
    return values
  }
}
