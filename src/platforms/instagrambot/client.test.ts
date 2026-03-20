import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { InstagramBotClient } from './client'
import { InstagramBotError } from './types'

describe('InstagramBotClient', () => {
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
          ...headers,
        },
      }),
    )
  }

  test('successful GET request returns page info', async () => {
    mockResponse({ id: 'page-1', name: 'My Page', instagram_business_account: { id: 'ig-1' } })

    const client = new InstagramBotClient('page-1', 'token-1')
    const page = await client.getPageInfo()

    expect(page.id).toBe('page-1')
    expect(fetchCalls[0].url).toBe('https://graph.facebook.com/v23.0/page-1?fields=instagram_business_account,name')
  })

  test('auth headers are set on every request', async () => {
    mockResponse({ id: 'page-1', name: 'My Page', instagram_business_account: { id: 'ig-1' } })
    mockResponse({ recipient_id: 'user-1', message_id: 'mid-1' })

    const client = new InstagramBotClient('page-1', 'my-token')
    await client.getPageInfo()
    await client.sendMessage('user-1', 'hello')

    expect(fetchCalls).toHaveLength(2)
    for (const call of fetchCalls) {
      const headers = call.options?.headers as Record<string, string>
      expect(headers.Authorization).toBe('Bearer my-token')
      expect(headers['Content-Type']).toBe('application/json')
    }
  })

  test('429 response triggers retry with Retry-After wait', async () => {
    mockResponse({ error: { message: 'Rate limited', code: 4 } }, 429, { 'Retry-After': '0.05' })
    mockResponse({ id: 'page-1', name: 'My Page', instagram_business_account: { id: 'ig-1' } })

    const client = new InstagramBotClient('page-1', 'token-1')
    const start = Date.now()
    const page = await client.getPageInfo()
    const elapsed = Date.now() - start

    expect(page.id).toBe('page-1')
    expect(fetchCalls).toHaveLength(2)
    expect(elapsed).toBeGreaterThanOrEqual(40)
  })

  test('500 response triggers retry with exponential backoff', async () => {
    mockResponse({ error: { message: 'Server error', code: 1 } }, 500)
    mockResponse({ error: { message: 'Server error', code: 1 } }, 500)
    mockResponse({ id: 'page-1', name: 'My Page', instagram_business_account: { id: 'ig-1' } })

    const client = new InstagramBotClient('page-1', 'token-1')
    const start = Date.now()
    const page = await client.getPageInfo()
    const elapsed = Date.now() - start

    expect(page.id).toBe('page-1')
    expect(fetchCalls).toHaveLength(3)
    expect(elapsed).toBeGreaterThanOrEqual(280)
  })

  test('4xx non-429 throws immediately without retry', async () => {
    mockResponse({ error: { message: 'Forbidden', code: 10 } }, 403)

    const client = new InstagramBotClient('page-1', 'token-1')
    await expect(client.getPageInfo()).rejects.toThrow(InstagramBotError)
    expect(fetchCalls).toHaveLength(1)
  })

  test('network error retries then throws InstagramBotError with code network_error', async () => {
    ;(globalThis as Record<string, unknown>).fetch = async (
      url: string | URL | Request,
      options?: RequestInit,
    ): Promise<Response> => {
      fetchCalls.push({ url: url.toString(), options })
      throw new Error('socket hang up')
    }

    const client = new InstagramBotClient('page-1', 'token-1')

    try {
      await client.getPageInfo()
      expect.unreachable('Expected network error')
    } catch (error) {
      expect(error).toBeInstanceOf(InstagramBotError)
      expect((error as InstagramBotError).code).toBe('network_error')
      expect(fetchCalls).toHaveLength(4)
    }
  })

  test('sendMessage posts recipient and text', async () => {
    mockResponse({ recipient_id: 'user-1', message_id: 'mid-1' })

    const client = new InstagramBotClient('page-1', 'token-1')
    const result = await client.sendMessage('user-1', 'Hello!')

    expect(result.recipient_id).toBe('user-1')
    expect(fetchCalls[0].url).toBe('https://graph.facebook.com/v23.0/page-1/messages')
    expect(fetchCalls[0].options?.method).toBe('POST')
    expect(fetchCalls[0].options?.body).toBe(JSON.stringify({
      recipient: { id: 'user-1' },
      message: { text: 'Hello!' },
    }))
  })
})
