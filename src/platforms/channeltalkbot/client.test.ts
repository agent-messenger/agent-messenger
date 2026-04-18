import { afterEach, beforeEach, describe, expect, it } from 'bun:test'

import { ChannelBotClient } from './client'
import { ChannelBotError } from './types'

describe('ChannelBotClient', () => {
  const originalFetch = globalThis.fetch
  let fetchCalls: Array<{ url: string; options?: RequestInit }> = []
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

  const mockResponse = (body: unknown, status = 200, headers: Record<string, string> = {}) => {
    fetchResponses.push(
      new Response(body === null ? null : JSON.stringify(body), {
        status,
        headers: {
          'Content-Type': 'application/json',
          'x-ratelimit-remaining': '10',
          'x-ratelimit-reset': String(Date.now() / 1000 + 60),
          ...headers,
        },
      }),
    )
  }

  it('successful GET request returns unwrapped JSON', async () => {
    mockResponse({ channel: { id: 'ch-1', name: 'My Channel' } })

    const client = await new ChannelBotClient().login({ accessKey: 'key-1', accessSecret: 'secret-1' })
    const channel = await client.getChannel()

    expect(channel.id).toBe('ch-1')
    expect(fetchCalls[0].url).toBe('https://api.channel.io/open/v5/channel')
  })

  it('auth headers are set on every request', async () => {
    mockResponse({ channel: { id: 'ch-1', name: 'My Channel' } })
    mockResponse({ user: { id: 'u-1', channelId: 'ch-1' } })

    const client = await new ChannelBotClient().login({ accessKey: 'my-access-key', accessSecret: 'my-access-secret' })
    await client.getChannel()
    await client.getUser('u-1')

    expect(fetchCalls).toHaveLength(2)
    for (const call of fetchCalls) {
      const headers = call.options?.headers as Record<string, string>
      expect(headers['x-access-key']).toBe('my-access-key')
      expect(headers['x-access-secret']).toBe('my-access-secret')
      expect(headers['Content-Type']).toBe('application/json')
    }
  })

  it('429 response triggers retry with Retry-After wait', async () => {
    mockResponse({ message: 'Rate limited' }, 429, { 'Retry-After': '0.05' })
    mockResponse({ channel: { id: 'ch-1', name: 'My Channel' } })

    const client = await new ChannelBotClient().login({ accessKey: 'key-1', accessSecret: 'secret-1' })
    const start = Date.now()
    const channel = await client.getChannel()
    const elapsed = Date.now() - start

    expect(channel.id).toBe('ch-1')
    expect(fetchCalls).toHaveLength(2)
    expect(elapsed).toBeGreaterThanOrEqual(40)
  })

  it('500 response triggers retry with exponential backoff', async () => {
    mockResponse({ message: 'Server error' }, 500)
    mockResponse({ message: 'Server error' }, 500)
    mockResponse({ channel: { id: 'ch-1', name: 'My Channel' } })

    const client = await new ChannelBotClient().login({ accessKey: 'key-1', accessSecret: 'secret-1' })
    const start = Date.now()
    const channel = await client.getChannel()
    const elapsed = Date.now() - start

    expect(channel.id).toBe('ch-1')
    expect(fetchCalls).toHaveLength(3)
    expect(elapsed).toBeGreaterThanOrEqual(280)
  })

  it('4xx non-429 throws immediately without retry', async () => {
    mockResponse({ message: 'Forbidden' }, 403)

    const client = await new ChannelBotClient().login({ accessKey: 'key-1', accessSecret: 'secret-1' })
    await expect(client.getChannel()).rejects.toThrow(ChannelBotError)
    expect(fetchCalls).toHaveLength(1)
  })

  it('network error retries then throws ChannelBotError with code network_error', async () => {
    ;(globalThis as Record<string, unknown>).fetch = async (
      url: string | URL | Request,
      options?: RequestInit,
    ): Promise<Response> => {
      fetchCalls.push({ url: url.toString(), options })
      throw new Error('socket hang up')
    }

    const client = await new ChannelBotClient().login({ accessKey: 'key-1', accessSecret: 'secret-1' })

    try {
      await client.getChannel()
      expect.unreachable('Expected network error')
    } catch (error) {
      expect(error).toBeInstanceOf(ChannelBotError)
      expect((error as ChannelBotError).code).toBe('network_error')
      expect(fetchCalls).toHaveLength(4)
    }
  })

  it('204 response returns undefined', async () => {
    mockResponse(null, 204)

    const client = await new ChannelBotClient().login({ accessKey: 'key-1', accessSecret: 'secret-1' })
    const result = await client.deleteUserChat('chat-1')

    expect(result).toBeUndefined()
  })

  it('wrapTextInBlocks returns a single text block with value', () => {
    expect(ChannelBotClient.wrapTextInBlocks('Hello world')).toEqual([{ type: 'text', value: 'Hello world' }])
  })

  it('sendUserChatMessage includes botName in query string', async () => {
    mockResponse({ message: { id: 'm-1' } })

    const client = await new ChannelBotClient().login({ accessKey: 'key-1', accessSecret: 'secret-1' })
    await client.sendUserChatMessage('chat-1', [{ type: 'text', value: 'hello' }], 'SupportBot')

    expect(fetchCalls[0].url).toBe('https://api.channel.io/open/v5/user-chats/chat-1/messages?botName=SupportBot')
  })

  it('sendGroupMessage includes botName in query string', async () => {
    mockResponse({ message: { id: 'm-1' } })

    const client = await new ChannelBotClient().login({ accessKey: 'key-1', accessSecret: 'secret-1' })
    await client.sendGroupMessage('grp-1', [{ type: 'text', value: 'hello' }], 'OpsBot')

    expect(fetchCalls[0].url).toBe('https://api.channel.io/open/v5/groups/grp-1/messages?botName=OpsBot')
  })

  it('resolveGroup("@team-name") calls groups by name endpoint', async () => {
    mockResponse({ group: { id: 'grp-1', channelId: 'ch-1', name: 'team-name' } })

    const client = await new ChannelBotClient().login({ accessKey: 'key-1', accessSecret: 'secret-1' })
    await client.resolveGroup('@team-name')

    expect(fetchCalls[0].url).toBe('https://api.channel.io/open/v5/groups/@team-name')
  })

  it('resolveGroup("grp123") calls groups by id endpoint', async () => {
    mockResponse({ group: { id: 'grp123', channelId: 'ch-1', name: 'team-name' } })

    const client = await new ChannelBotClient().login({ accessKey: 'key-1', accessSecret: 'secret-1' })
    await client.resolveGroup('grp123')

    expect(fetchCalls[0].url).toBe('https://api.channel.io/open/v5/groups/grp123')
  })

  it('pagination params are included in query string', async () => {
    mockResponse({ messages: [] })

    const client = await new ChannelBotClient().login({ accessKey: 'key-1', accessSecret: 'secret-1' })
    await client.getUserChatMessages('chat-1', { since: 'cursor-1', limit: 25, sortOrder: 'desc' })

    const url = new URL(fetchCalls[0].url)
    expect(url.origin + url.pathname).toBe('https://api.channel.io/open/v5/user-chats/chat-1/messages')
    expect(url.searchParams.get('since')).toBe('cursor-1')
    expect(url.searchParams.get('limit')).toBe('25')
    expect(url.searchParams.get('sortOrder')).toBe('desc')
  })
})
