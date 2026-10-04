import { afterEach, beforeEach, describe, expect, it } from 'bun:test'

import { DiscordBotClient } from './client'
import { listThreads, resolveThread } from './client-threads'
import type { DiscordChannel } from './types'

interface FetchCall {
  url: string
  options?: RequestInit
}

describe('Discord thread client helpers', () => {
  const originalFetch = globalThis.fetch
  let fetchCalls: FetchCall[] = []
  let fetchResponses: Response[] = []
  let fetchIndex = 0

  beforeEach(() => {
    fetchCalls = []
    fetchResponses = []
    fetchIndex = 0
    ;(globalThis as Record<string, unknown>).fetch = async (
      url: string | URL | Request,
      options?: RequestInit,
    ): Promise<Response> => {
      fetchCalls.push({ url: url.toString(), options })
      const response = fetchResponses[fetchIndex]
      fetchIndex++
      if (!response) {
        throw new Error('No mock response configured')
      }
      return response
    }
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  const mockResponse = (body: unknown, status = 200) => {
    fetchResponses.push(
      new Response(body === null ? null : JSON.stringify(body), {
        status,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Remaining': '10',
          'X-RateLimit-Reset': String(Date.now() / 1000 + 60),
          'X-RateLimit-Bucket': 'test-bucket',
        },
      }),
    )
  }

  const fetchTransport = {
    request: async <T>(method: string, path: string): Promise<T> => {
      const response = await fetch(`https://discord.com/api/v10${path}`, { method })
      return response.json() as Promise<T>
    },
  }

  const thread = (id: string, name: string, parentId: string): DiscordChannel => ({
    id,
    guild_id: 'guild1',
    name,
    type: 11,
    parent_id: parentId,
  })

  it('numeric passthrough makes zero fetch calls', async () => {
    await expect(resolveThread(fetchTransport, 'guild1', 'parent1', '123')).resolves.toBe('123')
    expect(fetchCalls).toHaveLength(0)
  })

  it('numeric-looking names are treated as ids', async () => {
    await expect(resolveThread(fetchTransport, 'guild1', 'parent1', '123')).resolves.toBe('123')
    expect(fetchCalls).toHaveLength(0)
  })

  it('resolves a name from active threads filtered by parent', async () => {
    mockResponse({ threads: [thread('thread1', 'ops', 'parent1'), thread('thread2', 'other', 'parent1')], members: [] })

    await expect(resolveThread(fetchTransport, 'guild1', 'parent1', 'ops')).resolves.toBe('thread1')
    expect(fetchCalls).toHaveLength(1)
    expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/guilds/guild1/threads/active')
  })

  it('strips a leading hash when resolving a name', async () => {
    mockResponse({ threads: [thread('thread1', 'ops', 'parent1')], members: [] })

    await expect(resolveThread(fetchTransport, 'guild1', 'parent1', '#ops')).resolves.toBe('thread1')
  })

  it('ignores a same-named thread under a different parent', async () => {
    mockResponse({ threads: [thread('thread2', 'ops', 'parent2')], members: [] })

    const error = await resolveThread(fetchTransport, 'guild1', 'parent1', 'ops').catch((caught) => caught)
    expect(error.code).toBe('thread_not_found')
  })

  it('rejects two same-named active threads under one parent as ambiguous', async () => {
    mockResponse({ threads: [thread('thread1', 'ops', 'parent1'), thread('thread2', 'ops', 'parent1')], members: [] })

    const error = await resolveThread(fetchTransport, 'guild1', 'parent1', 'ops').catch((caught) => caught)
    expect(error.code).toBe('thread_ambiguous')
    expect(error.message).toContain('thread1')
    expect(error.message).toContain('thread2')
  })

  it('does not resolve archived-only names', async () => {
    mockResponse({ threads: [], members: [] })

    const error = await resolveThread(fetchTransport, 'guild1', 'parent1', 'old').catch((caught) => caught)
    expect(error.code).toBe('thread_not_found')
    expect(error.message).toContain('--archived')
    expect(fetchCalls).toHaveLength(1)
    expect(fetchCalls[0].url).not.toContain('/threads/archived/')
  })

  it('names the missing thread in the not-found error', async () => {
    mockResponse({ threads: [], members: [] })

    const error = await resolveThread(fetchTransport, 'guild1', 'parent1', 'missing').catch((caught) => caught)
    expect(error.code).toBe('thread_not_found')
    expect(error.message).toContain('Thread not found: "missing"')
  })

  it('requires a parent for archived thread listing', async () => {
    const error = await listThreads(fetchTransport, 'guild1', { archived: true }).catch((caught) => caught)
    expect(error.code).toBe('parent_required')
    expect(fetchCalls).toHaveLength(0)
  })

  it('lists archived public threads for a parent and returns has_more', async () => {
    const archived = thread('thread1', 'old', 'parent1')
    mockResponse({ threads: [archived], members: [], has_more: true })

    await expect(listThreads(fetchTransport, 'guild1', { parentId: 'parent1', archived: true })).resolves.toEqual({
      threads: [archived],
      has_more: true,
    })
    expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/channels/parent1/threads/archived/public?limit=100')
  })

  it('lists all active threads by default', async () => {
    const threads = [thread('thread1', 'ops', 'parent1'), thread('thread2', 'other', 'parent2')]
    mockResponse({ threads, members: [] })

    await expect(listThreads(fetchTransport, 'guild1')).resolves.toEqual({ threads })
    expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/guilds/guild1/threads/active')
  })

  it('filters active threads by parent', async () => {
    const matching = thread('thread1', 'ops', 'parent1')
    mockResponse({ threads: [matching, thread('thread2', 'other', 'parent2')], members: [] })

    await expect(listThreads(fetchTransport, 'guild1', { parentId: 'parent1' })).resolves.toEqual({
      threads: [matching],
    })
  })

  it('delegates listThreads through the client', async () => {
    const threads = [thread('thread1', 'ops', 'parent1')]
    mockResponse({ threads, members: [] })
    const client = await new DiscordBotClient().login({ token: 'bot-token' })

    await expect(client.listThreads('guild1', { parentId: 'parent1' })).resolves.toEqual({ threads })
    expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/guilds/guild1/threads/active')
  })

  it('delegates resolveThread through the client', async () => {
    mockResponse({ threads: [thread('thread1', 'ops', 'parent1')], members: [] })
    const client = await new DiscordBotClient().login({ token: 'bot-token' })

    await expect(client.resolveThread('guild1', 'parent1', 'ops')).resolves.toBe('thread1')
    expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/guilds/guild1/threads/active')
  })
})
