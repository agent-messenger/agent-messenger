import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { ChannelClient } from './client'
import { ChannelError } from './types'

describe('ChannelClient', () => {
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

  const getHeaders = (callIndex = 0) => fetchCalls[callIndex]?.options?.headers as Record<string, string>

  const getJsonBody = (callIndex = 0) => JSON.parse(String(fetchCalls[callIndex]?.options?.body)) as Record<string, unknown>

  test('login() requires account cookie', async () => {
    await expect(new ChannelClient().login({ accountCookie: '' })).rejects.toThrow(ChannelError)
    await expect(new ChannelClient().login({ accountCookie: '', sessionCookie: 'session-cookie' })).rejects.toThrow(ChannelError)
    const client = await new ChannelClient().login({ accountCookie: 'account-cookie' })
    expect(client).toBeInstanceOf(ChannelClient)
    const client2 = await new ChannelClient().login({ accountCookie: 'account-cookie', sessionCookie: '' })
    expect(client2).toBeInstanceOf(ChannelClient)
  })

  test('successful GET request returns unwrapped JSON', async () => {
    mockResponse({ account: { id: 'acc-1', name: 'Desk Owner', email: 'owner@example.com', emailVerified: true, language: 'en', country: 'KR', createdAt: 1 } })

    const client = await new ChannelClient().login({ accountCookie: 'account-cookie', sessionCookie: 'session-cookie' })
    const account = await client.getAccount()

    expect(account.id).toBe('acc-1')
    expect(fetchCalls[0].url).toBe('https://desk-api.channel.io/desk/account')
  })

  test('cookie auth headers are set on every request', async () => {
    mockResponse({ account: { id: 'acc-1', name: 'Desk Owner', email: 'owner@example.com', emailVerified: true, language: 'en', country: 'KR', createdAt: 1 } })
    mockResponse({ channel: { id: 'ch-1', name: 'Support' } })

    const client = await new ChannelClient().login({ accountCookie: 'account-cookie', sessionCookie: 'session-cookie' })
    await client.getAccount()
    await client.getChannel('ch-1')

    expect(fetchCalls).toHaveLength(2)
    for (const call of fetchCalls) {
      const headers = call.options?.headers as Record<string, string>
      expect(headers.Cookie).toBe('x-account=account-cookie; ch-session-1=session-cookie')
      expect(headers['Content-Type']).toBe('application/json')
    }
  })

  test('429 response triggers retry with Retry-After wait', async () => {
    mockResponse({ errors: [{ message: 'Rate limited' }] }, 429, { 'Retry-After': '0.05' })
    mockResponse({ account: { id: 'acc-1', name: 'Desk Owner', email: 'owner@example.com', emailVerified: true, language: 'en', country: 'KR', createdAt: 1 } })

    const client = await new ChannelClient().login({ accountCookie: 'account-cookie', sessionCookie: 'session-cookie' })
    const start = Date.now()
    const account = await client.getAccount()
    const elapsed = Date.now() - start

    expect(account.id).toBe('acc-1')
    expect(fetchCalls).toHaveLength(2)
    expect(elapsed).toBeGreaterThanOrEqual(40)
  })

  test('500 response triggers retry with exponential backoff for GET requests', async () => {
    mockResponse({ errors: [{ message: 'Server error' }] }, 500)
    mockResponse({ errors: [{ message: 'Server error' }] }, 500)
    mockResponse({ account: { id: 'acc-1', name: 'Desk Owner', email: 'owner@example.com', emailVerified: true, language: 'en', country: 'KR', createdAt: 1 } })

    const client = await new ChannelClient().login({ accountCookie: 'account-cookie', sessionCookie: 'session-cookie' })
    const start = Date.now()
    const account = await client.getAccount()
    const elapsed = Date.now() - start

    expect(account.id).toBe('acc-1')
    expect(fetchCalls).toHaveLength(3)
    expect(elapsed).toBeGreaterThanOrEqual(280)
  })

  test('4xx non-429 throws immediately without retry', async () => {
    mockResponse({ type: 'forbidden', errors: [{ message: 'Forbidden' }] }, 403)

    const client = await new ChannelClient().login({ accountCookie: 'account-cookie', sessionCookie: 'session-cookie' })
    await expect(client.getAccount()).rejects.toThrow(ChannelError)
    expect(fetchCalls).toHaveLength(1)
  })

  test('network error retries then throws ChannelError with code network_error', async () => {
    ;(globalThis as Record<string, unknown>).fetch = async (
      url: string | URL | Request,
      options?: RequestInit,
    ): Promise<Response> => {
      fetchCalls.push({ url: url.toString(), options })
      throw new Error('socket hang up')
    }

    const client = await new ChannelClient().login({ accountCookie: 'account-cookie', sessionCookie: 'session-cookie' })

    try {
      await client.getAccount()
      expect.unreachable('Expected network error')
    } catch (error) {
      expect(error).toBeInstanceOf(ChannelError)
      expect((error as ChannelError).code).toBe('network_error')
      expect(fetchCalls).toHaveLength(4)
    }
  })

  test('204 response returns undefined', async () => {
    mockResponse(null, 204)

    const client = await new ChannelClient().login({ accountCookie: 'account-cookie', sessionCookie: 'session-cookie' })
    const result = await (client as unknown as { request: <T>(method: string, path: string) => Promise<T> }).request<void>('GET', '/desk/account')

    expect(result).toBeUndefined()
  })

  test('wrapTextInBlocks returns a single text block and extractText joins block and plain text', () => {
    expect(ChannelClient.wrapTextInBlocks('Hello world')).toEqual([
      { type: 'text', value: 'Hello world' },
    ])

    expect(ChannelClient.extractText({
      id: 'msg-1',
      blocks: [
        { type: 'text', value: 'hello' },
        { type: 'text', value: 'world' },
      ],
      plainText: 'fallback',
    })).toBe('hello\nworld\nfallback')
  })

  test('listChannels includes query params', async () => {
    mockResponse({ channels: [{ id: 'ch-1', name: 'Support' }] })

    const client = await new ChannelClient().login({ accountCookie: 'account-cookie', sessionCookie: 'session-cookie' })
    const channels = await client.listChannels({ limit: 500 })

    expect(channels[0]?.id).toBe('ch-1')
    expect(fetchCalls[0].url).toBe('https://desk-api.channel.io/desk/channels?limit=500')
  })

  test('getChannel uses the channel detail endpoint', async () => {
    mockResponse({ channel: { id: 'ch-1', name: 'Support' } })

    const client = await new ChannelClient().login({ accountCookie: 'account-cookie', sessionCookie: 'session-cookie' })
    await client.getChannel('ch-1')

    expect(fetchCalls[0].url).toBe('https://desk-api.channel.io/desk/channels/ch-1')
  })

  test('listManagers uses the managers endpoint', async () => {
    mockResponse({ managers: [{ id: 'mgr-1', channelId: 'ch-1', accountId: 'acc-1', name: 'Alex' }] })

    const client = await new ChannelClient().login({ accountCookie: 'account-cookie', sessionCookie: 'session-cookie' })
    const managers = await client.listManagers('ch-1', { limit: 200 })

    expect(managers[0]?.id).toBe('mgr-1')
    expect(fetchCalls[0].url).toBe('https://desk-api.channel.io/desk/channels/ch-1/managers?limit=200')
  })

  test('getManagerRole unwraps the role response', async () => {
    mockResponse({ role: { permissions: ['read'] } })

    const client = await new ChannelClient().login({ accountCookie: 'account-cookie', sessionCookie: 'session-cookie' })
    const role = await client.getManagerRole('ch-1')

    expect(role).toEqual({ permissions: ['read'] })
    expect(fetchCalls[0].url).toBe('https://desk-api.channel.io/desk/channels/ch-1/managers/me/role')
  })

  test('group endpoints build the expected URLs', async () => {
    mockResponse({ groups: [{ id: 'grp-1', channelId: 'ch-1', name: 'ops' }] })
    mockResponse({ group: { id: 'grp-1', channelId: 'ch-1', name: 'ops' } })
    mockResponse({ messages: [{ id: 'msg-1' }] })

    const client = await new ChannelClient().login({ accountCookie: 'account-cookie', sessionCookie: 'session-cookie' })
    await client.listGroups('ch-1', { limit: 500 })
    await client.getGroup('ch-1', 'grp-1')
    await client.getGroupMessages('ch-1', 'grp-1', { sortOrder: 'desc', limit: 100, since: 'cursor-1' })

    expect(fetchCalls[0].url).toBe('https://desk-api.channel.io/desk/channels/ch-1/groups?limit=500')
    expect(fetchCalls[1].url).toBe('https://desk-api.channel.io/desk/channels/ch-1/groups/grp-1')

    const messagesUrl = new URL(fetchCalls[2].url)
    expect(messagesUrl.origin + messagesUrl.pathname).toBe('https://desk-api.channel.io/desk/channels/ch-1/groups/grp-1/messages')
    expect(messagesUrl.searchParams.get('sortOrder')).toBe('desc')
    expect(messagesUrl.searchParams.get('limit')).toBe('100')
    expect(messagesUrl.searchParams.get('since')).toBe('cursor-1')
  })

  test('sendGroupMessage includes requestId in the body', async () => {
    mockResponse({ message: { id: 'msg-1', requestId: 'req-123' } })

    const client = await new ChannelClient().login({ accountCookie: 'account-cookie', sessionCookie: 'session-cookie' })
    const blocks = ChannelClient.wrapTextInBlocks('hello group')
    await client.sendGroupMessage('ch-1', 'grp-1', blocks, 'req-123')

    expect(fetchCalls[0].url).toBe('https://desk-api.channel.io/desk/channels/ch-1/groups/grp-1/messages')
    expect(fetchCalls[0].options?.method).toBe('POST')
    expect(getJsonBody()).toEqual({ blocks, requestId: 'req-123' })
  })

  test('direct chat endpoints build the expected URLs', async () => {
    mockResponse({ directChats: [{ id: 'dm-1', channelId: 'ch-1' }] })
    mockResponse({ messages: [{ id: 'msg-1' }] })
    mockResponse({ message: { id: 'msg-2', requestId: 'req-234' } })

    const client = await new ChannelClient().login({ accountCookie: 'account-cookie', sessionCookie: 'session-cookie' })
    const blocks = ChannelClient.wrapTextInBlocks('hello dm')

    await client.listDirectChats('ch-1', { limit: 200 })
    await client.getDirectChatMessages('ch-1', 'dm-1', { sortOrder: 'asc', limit: 50 })
    await client.sendDirectChatMessage('ch-1', 'dm-1', blocks, 'req-234')

    expect(fetchCalls[0].url).toBe('https://desk-api.channel.io/desk/channels/ch-1/direct-chats?limit=200')
    expect(fetchCalls[1].url).toBe('https://desk-api.channel.io/desk/channels/ch-1/direct-chats/dm-1/messages?sortOrder=asc&limit=50')
    expect(fetchCalls[2].url).toBe('https://desk-api.channel.io/desk/channels/ch-1/direct-chats/dm-1/messages')
    expect(getJsonBody(2)).toEqual({ blocks, requestId: 'req-234' })
  })

  test('user chat endpoints build the expected URLs', async () => {
    mockResponse({ userChats: [{ id: 'uc-1', channelId: 'ch-1', state: 'opened' }] })
    mockResponse({ userChat: { id: 'uc-1', channelId: 'ch-1', state: 'opened' } })
    mockResponse({ messages: [{ id: 'msg-1' }] })
    mockResponse({ message: { id: 'msg-2', requestId: 'req-345' } })

    const client = await new ChannelClient().login({ accountCookie: 'account-cookie', sessionCookie: 'session-cookie' })
    const blocks = ChannelClient.wrapTextInBlocks('hello user')

    await client.listUserChats('ch-1', { state: 'opened', limit: 25 })
    await client.getUserChat('ch-1', 'uc-1')
    await client.getUserChatMessages('ch-1', 'uc-1', { sortOrder: 'desc', limit: 25 })
    await client.sendUserChatMessage('ch-1', 'uc-1', blocks, 'req-345')

    expect(fetchCalls[0].url).toBe('https://desk-api.channel.io/desk/channels/ch-1/user-chats/assigned/me?state=opened&limit=25')
    expect(fetchCalls[1].url).toBe('https://desk-api.channel.io/desk/channels/ch-1/user-chats/uc-1')
    expect(fetchCalls[2].url).toBe('https://desk-api.channel.io/desk/channels/ch-1/user-chats/uc-1/messages?sortOrder=desc&limit=25')
    expect(fetchCalls[3].url).toBe('https://desk-api.channel.io/desk/channels/ch-1/user-chats/uc-1/messages')
    expect(getJsonBody(3)).toEqual({ blocks, requestId: 'req-345' })
  })

  test('listBots uses the bots endpoint', async () => {
    mockResponse({ bots: [{ id: 'bot-1', channelId: 'ch-1', name: 'DeskBot' }] })

    const client = await new ChannelClient().login({ accountCookie: 'account-cookie', sessionCookie: 'session-cookie' })
    const bots = await client.listBots('ch-1', { limit: 1000 })

    expect(bots[0]?.id).toBe('bot-1')
    expect(fetchCalls[0].url).toBe('https://desk-api.channel.io/desk/channels/ch-1/bots?limit=1000')
  })

  test('5xx on POST does not retry', async () => {
    mockResponse({ type: 'server_error', errors: [{ message: 'Server error' }] }, 500)

    const client = await new ChannelClient().login({ accountCookie: 'account-cookie', sessionCookie: 'session-cookie' })
    await expect(client.sendGroupMessage('ch-1', 'grp-1', ChannelClient.wrapTextInBlocks('hello'), 'req-123')).rejects.toThrow(ChannelError)
    expect(fetchCalls).toHaveLength(1)
  })

  test('error responses use desk API error fields', async () => {
    mockResponse({ type: 'not_found', status: 404, errors: [{ message: 'Missing resource' }], language: 'en' }, 404)

    const client = await new ChannelClient().login({ accountCookie: 'account-cookie', sessionCookie: 'session-cookie' })

    try {
      await client.getChannel('missing')
      expect.unreachable('Expected desk api error')
    } catch (error) {
      expect(error).toBeInstanceOf(ChannelError)
      expect((error as ChannelError).message).toBe('Missing resource')
      expect((error as ChannelError).code).toBe('not_found')
    }
  })

  test('rate limit headers delay the next request when remaining is zero', async () => {
    mockResponse({ account: { id: 'acc-1', name: 'Desk Owner', email: 'owner@example.com', emailVerified: true, language: 'en', country: 'KR', createdAt: 1 } }, 200, {
      'x-ratelimit-remaining': '0',
      'x-ratelimit-reset': String(Date.now() + 50),
    })
    mockResponse({ account: { id: 'acc-2', name: 'Desk Owner', email: 'owner@example.com', emailVerified: true, language: 'en', country: 'KR', createdAt: 2 } })

    const client = await new ChannelClient().login({ accountCookie: 'account-cookie', sessionCookie: 'session-cookie' })
    await client.getAccount()

    const start = Date.now()
    await client.getAccount()
    const elapsed = Date.now() - start

    expect(elapsed).toBeGreaterThanOrEqual(40)
    expect(fetchCalls).toHaveLength(2)
  })

  test('generated requests still include the cookie header on post endpoints', async () => {
    mockResponse({ message: { id: 'msg-1' } })

    const client = await new ChannelClient().login({ accountCookie: 'account-cookie', sessionCookie: 'session-cookie' })
    await client.sendDirectChatMessage('ch-1', 'dm-1', ChannelClient.wrapTextInBlocks('hello'), 'req-999')

    expect(getHeaders().Cookie).toBe('x-account=account-cookie; ch-session-1=session-cookie')
  })

  test('searchTeamChatMessages builds correct URL with query and limit', async () => {
    const searchResponse = {
      hits: [{ index: 'messages-2026-03', score: 'NaN', source: { id: 'msg-1' }, highlight: {}, searchAfter: [1000, 'msg-1'] }],
      bots: [],
      sessions: [],
      groups: [],
    }
    mockResponse(searchResponse)

    const client = await new ChannelClient().login({ accountCookie: 'account-cookie', sessionCookie: 'session-cookie' })
    const result = await client.searchTeamChatMessages('ch-1', 'hello world', { limit: 10 })

    const url = new URL(fetchCalls[0].url)
    expect(url.origin + url.pathname).toBe('https://desk-api.channel.io/desk/channels/ch-1/team-chat/message/search')
    expect(url.searchParams.get('query')).toBe('hello world')
    expect(url.searchParams.get('limit')).toBe('10')
    expect(result.hits).toHaveLength(1)
  })

  test('searchUserChatMessages builds correct URL with query', async () => {
    const searchResponse = {
      hits: [],
      bots: [],
      sessions: [],
      userChats: [],
    }
    mockResponse(searchResponse)

    const client = await new ChannelClient().login({ accountCookie: 'account-cookie', sessionCookie: 'session-cookie' })
    const result = await client.searchUserChatMessages('ch-1', 'test query')

    const url = new URL(fetchCalls[0].url)
    expect(url.origin + url.pathname).toBe('https://desk-api.channel.io/desk/channels/ch-1/user-chat/message/search')
    expect(url.searchParams.get('query')).toBe('test query')
    expect(result.hits).toHaveLength(0)
  })

  test('searchTeamChatMessages works without limit parameter', async () => {
    mockResponse({ hits: [], bots: [], sessions: [] })

    const client = await new ChannelClient().login({ accountCookie: 'account-cookie', sessionCookie: 'session-cookie' })
    await client.searchTeamChatMessages('ch-1', 'test')

    const url = new URL(fetchCalls[0].url)
    expect(url.searchParams.get('query')).toBe('test')
    expect(url.searchParams.has('limit')).toBe(false)
  })
})
