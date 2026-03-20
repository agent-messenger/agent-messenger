import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { WhatsAppBotClient } from './client'
import { WhatsAppBotError } from './types'

describe('WhatsAppBotClient', () => {
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

  test('successful GET request returns business profile data', async () => {
    mockResponse({ data: [{ about: 'Support Inbox', description: 'Primary number' }] })

    const client = new WhatsAppBotClient('1234567890', 'token-1')
    const profile = await client.getBusinessProfile()

    expect(profile.about).toBe('Support Inbox')
    expect(fetchCalls[0].url).toBe('https://graph.facebook.com/v23.0/1234567890/whatsapp_business_profile')
  })

  test('auth headers are set on every request', async () => {
    mockResponse({ data: [{ about: 'Support Inbox' }] })
    mockResponse({ messaging_product: 'whatsapp', contacts: [{ input: '+15551234567', wa_id: '15551234567' }], messages: [{ id: 'wamid.1' }] })

    const client = new WhatsAppBotClient('1234567890', 'my-access-token')
    await client.getBusinessProfile()
    await client.sendTextMessage('+15551234567', 'Hello there')

    expect(fetchCalls).toHaveLength(2)
    for (const call of fetchCalls) {
      const headers = call.options?.headers as Record<string, string>
      expect(headers.Authorization).toBe('Bearer my-access-token')
      expect(headers['Content-Type']).toBe('application/json')
    }
  })

  test('sendTextMessage posts expected payload', async () => {
    mockResponse({ messaging_product: 'whatsapp', messages: [{ id: 'wamid.1' }] })

    const client = new WhatsAppBotClient('1234567890', 'token-1')
    await client.sendTextMessage('+15551234567', 'Hello!')

    expect(fetchCalls[0].url).toBe('https://graph.facebook.com/v23.0/1234567890/messages')
    expect(fetchCalls[0].options?.method).toBe('POST')
    expect(fetchCalls[0].options?.body).toBe(
      JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: '+15551234567',
        type: 'text',
        text: { body: 'Hello!' },
      }),
    )
  })

  test('sendTemplateMessage posts expected payload', async () => {
    mockResponse({ messaging_product: 'whatsapp', messages: [{ id: 'wamid.1' }] })

    const client = new WhatsAppBotClient('1234567890', 'token-1')
    await client.sendTemplateMessage('+15551234567', 'hello_world', 'en_US')

    expect(fetchCalls[0].options?.body).toBe(
      JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: '+15551234567',
        type: 'template',
        template: {
          name: 'hello_world',
          language: { code: 'en_US' },
        },
      }),
    )
  })

  test('429 response triggers retry with Retry-After wait', async () => {
    mockResponse({ error: { message: 'Rate limited', code: 4 } }, 429, { 'Retry-After': '0.05' })
    mockResponse({ data: [{ about: 'Support Inbox' }] })

    const client = new WhatsAppBotClient('1234567890', 'token-1')
    const start = Date.now()
    const profile = await client.getBusinessProfile()
    const elapsed = Date.now() - start

    expect(profile.about).toBe('Support Inbox')
    expect(fetchCalls).toHaveLength(2)
    expect(elapsed).toBeGreaterThanOrEqual(40)
  })

  test('throttling error code retries even when status is 400', async () => {
    mockResponse({ error: { message: 'Application request limit reached', code: 4, error_subcode: 130429 } }, 400, { 'Retry-After': '0.05' })
    mockResponse({ data: [{ about: 'Support Inbox' }] })

    const client = new WhatsAppBotClient('1234567890', 'token-1')
    const profile = await client.getBusinessProfile()

    expect(profile.about).toBe('Support Inbox')
    expect(fetchCalls).toHaveLength(2)
  })

  test('500 response triggers retry with exponential backoff', async () => {
    mockResponse({ error: { message: 'Server error' } }, 500)
    mockResponse({ error: { message: 'Server error' } }, 500)
    mockResponse({ data: [{ about: 'Support Inbox' }] })

    const client = new WhatsAppBotClient('1234567890', 'token-1')
    const start = Date.now()
    const profile = await client.getBusinessProfile()
    const elapsed = Date.now() - start

    expect(profile.about).toBe('Support Inbox')
    expect(fetchCalls).toHaveLength(3)
    expect(elapsed).toBeGreaterThanOrEqual(280)
  })

  test('4xx non-throttling throws immediately without retry', async () => {
    mockResponse({ error: { message: 'Forbidden', code: 100 } }, 403)

    const client = new WhatsAppBotClient('1234567890', 'token-1')
    await expect(client.getBusinessProfile()).rejects.toThrow(WhatsAppBotError)
    expect(fetchCalls).toHaveLength(1)
  })

  test('network error retries then throws WhatsAppBotError with code network_error', async () => {
    ;(globalThis as Record<string, unknown>).fetch = async (
      url: string | URL | Request,
      options?: RequestInit,
    ): Promise<Response> => {
      fetchCalls.push({ url: url.toString(), options })
      throw new Error('socket hang up')
    }

    const client = new WhatsAppBotClient('1234567890', 'token-1')

    try {
      await client.getBusinessProfile()
      expect.unreachable('Expected network error')
    } catch (error) {
      expect(error).toBeInstanceOf(WhatsAppBotError)
      expect((error as WhatsAppBotError).code).toBe('network_error')
      expect(fetchCalls).toHaveLength(4)
    }
  })
})
