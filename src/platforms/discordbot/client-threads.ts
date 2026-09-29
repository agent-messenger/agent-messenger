import type { DiscordThreadListResult } from './types'
import { DiscordBotError } from './types'

export interface ThreadTransport {
  request<T>(method: string, path: string, body?: unknown): Promise<T>
}

interface ThreadListResponse {
  threads: DiscordThreadListResult['threads']
  members: unknown[]
  has_more?: boolean
}

export async function listThreads(
  t: ThreadTransport,
  guildId: string,
  options?: { parentId?: string; archived?: boolean },
): Promise<DiscordThreadListResult> {
  if (options?.archived === true) {
    if (!options.parentId) {
      throw new DiscordBotError('thread list --archived requires a channel', 'parent_required')
    }

    const response = await t.request<ThreadListResponse>(
      'GET',
      `/channels/${options.parentId}/threads/archived/public?limit=100`,
    )
    return { threads: response.threads, has_more: response.has_more }
  }

  const response = await t.request<ThreadListResponse>('GET', `/guilds/${guildId}/threads/active`)
  const threads = options?.parentId
    ? response.threads.filter((thread) => thread.parent_id === options.parentId)
    : response.threads
  return { threads }
}

export async function resolveThread(
  t: ThreadTransport,
  guildId: string,
  parentChannelId: string,
  thread: string,
): Promise<string> {
  if (/^\d+$/.test(thread)) {
    return thread
  }

  const name = thread.replace(/^#/, '')
  const response = await t.request<ThreadListResponse>('GET', `/guilds/${guildId}/threads/active`)
  const matches = response.threads.filter(
    (candidate) => candidate.parent_id === parentChannelId && candidate.name === name,
  )

  if (matches.length === 1) {
    return matches[0].id
  }

  if (matches.length > 1) {
    throw new DiscordBotError(
      `Ambiguous thread "${name}" in this channel: ${matches.map((match) => match.id).join(', ')}. Use the thread ID.`,
      'thread_ambiguous',
    )
  }

  throw new DiscordBotError(
    `Thread not found: "${name}". Run "thread list <channel>" (add --archived for archived threads) or use the thread ID. If <channel> is itself a thread, send to it directly without --thread.`,
    'thread_not_found',
  )
}
