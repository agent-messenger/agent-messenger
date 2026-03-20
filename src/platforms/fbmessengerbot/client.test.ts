import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { FBMessengerBotClient } from './client'
import { FBMessengerBotError } from './types'

describe('FBMessengerBotClient', () => {
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
    mockResponse({ id: 'page-1', name: 'My Page' })

    const client = new FBMessengerBotClient('page-1', 'token-1')
    const page = await client.getPageInfo()

    expect(page.id).toBe('page-1')
    expect(fetchCalls[0].url).toBe('https://graph.facebook.com/v23.0/page-1?fields=name,id')
  })

  test('auth headers are set on every request', async () => {
    mockResponse({ id: 'page-1', name: 'My Page' })
    mockResponse({ recipient_id: 'user-1', message_id: 'mid.1' })

    const client = new FBMessengerBotClient('page-1', 'page-token')
    await client.getPageInfo()
    await client.sendMessage('user-1', 'Hello there')

    expect(fetchCalls).toHaveLength(2)
    for (const call of fetchCalls) {
      const headers = call.options?.headers as Record<string, string>
      expect(headers.Authorization).toBe('Bearer page-token')
      expect(headers['Content-Type']).toBe('application/json')
    }
  })

  test('sendMessage posts Messenger payload with messaging type', async () => {
    mockResponse({ recipient_id: 'user-1', message_id: 'mid.1' })

    const client = new FBMessengerBotClient('page-1', 'token-1')
    const response = await client.sendMessage('user-1', 'Hello!', 'UPDATE')

    expect(response.recipient_id).toBe('user-1')
    expect(fetchCalls[0].url).toBe('https://graph.facebook.com/v23.0/page-1/messages')
    expect(fetchCalls[0].options?.method).toBe('POST')
    expect(JSON.parse(fetchCalls[0].options?.body as string)).toEqual({
      recipient: { id: 'user-1' },
      message: { text: 'Hello!' },
      messaging_type: 'UPDATE',
    })
  })

  test('429 response triggers retry with Retry-After wait', async () => {
    mockResponse({ error: { message: 'Rate limited', code: 4 } }, 429, { 'Retry-After': '0.05' })
    mockResponse({ id: 'page-1', name: 'My Page' })

    const client = new FBMessengerBotClient('page-1', 'token-1')
    const start = Date.now()
    const page = await client.getPageInfo()
    const elapsed = Date.now() - start

    expect(page.id).toBe('page-1')
    expect(fetchCalls).toHaveLength(2)
    expect(elapsed).toBeGreaterThanOrEqual(40)
  })

  test('500 response triggers retry with exponential backoff for GET', async () => {
    mockResponse({ error: { message: 'Server error', code: 1 } }, 500)
    mockResponse({ error: { message: 'Server error', code: 1 } }, 500)
    mockResponse({ id: 'page-1', name: 'My Page' })

    const client = new FBMessengerBotClient('page-1', 'token-1')
    const start = Date.now()
    const page = await client.getPageInfo()
    const elapsed = Date.now() - start

    expect(page.id).toBe('page-1')
    expect(fetchCalls).toHaveLength(3)
    expect(elapsed).toBeGreaterThanOrEqual(280)
  })

  test('500 response on POST throws immediately without retry', async () => {
    mockResponse({ error: { message: 'Server error', code: 1 } }, 500)

    const client = new FBMessengerBotClient('page-1', 'token-1')
    await expect(client.sendMessage('user-1', 'Hello!')).rejects.toThrow(FBMessengerBotError)
    expect(fetchCalls).toHaveLength(1)
  })

  test('4xx non-429 throws Meta API error', async () => {
    mockResponse({ error: { message: 'Unsupported get request', code: 100 } }, 400)

    const client = new FBMessengerBotClient('page-1', 'token-1')

    try {
      await client.getPageInfo()
      expect.unreachable('Expected API error')
    } catch (error) {
      expect(error).toBeInstanceOf(FBMessengerBotError)
      expect((error as FBMessengerBotError).message).toBe('Unsupported get request')
      expect((error as FBMessengerBotError).code).toBe('100')
    }
  })

  test('network error retries then throws FBMessengerBotError with code network_error', async () => {
    ;(globalThis as Record<string, unknown>).fetch = async (
      url: string | URL | Request,
      options?: RequestInit,
    ): Promise<Response> => {
      fetchCalls.push({ url: url.toString(), options })
      throw new Error('socket hang up')
    }

    const client = new FBMessengerBotClient('page-1', 'token-1')

    try {
      await client.getPageInfo()
      expect.unreachable('Expected network error')
    } catch (error) {
      expect(error).toBeInstanceOf(FBMessengerBotError)
      expect((error as FBMessengerBotError).code).toBe('network_error')
      expect(fetchCalls).toHaveLength(4)
    }
  })
})
