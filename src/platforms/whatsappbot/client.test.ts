import { afterEach, beforeEach, describe, expect, it } from 'bun:test'

import { WhatsAppBotClient } from '@/platforms/whatsappbot/client'
import { WhatsAppBotError } from '@/platforms/whatsappbot/types'

describe('WhatsAppBotClient', () => {
  const originalFetch = globalThis.fetch
  let fetchCalls: Array<{ url: string; options?: RequestInit }> = []
  let fetchResponses: Response[] = []
  let fetchIndex = 0

  beforeEach(() => {
    fetchCalls = []
    fetchResponses = []
    fetchIndex = 0
    Object.defineProperty(globalThis, 'fetch', {
      value: async (url: string | URL | Request, options?: RequestInit): Promise<Response> => {
        fetchCalls.push({ url: url.toString(), options })
        const response = fetchResponses[fetchIndex]
        fetchIndex++
        if (!response) {
          throw new Error('No mock response configured')
        }
        return response
      },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    Object.defineProperty(globalThis, 'fetch', {
      value: originalFetch,
      writable: true,
      configurable: true,
    })
  })

  const mockResponse = (body: unknown, status = 200, headers: Record<string, string> = {}) => {
    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    }
    fetchResponses.push(
      new Response(body === null ? null : JSON.stringify(body), {
        status,
        headers: defaultHeaders,
      }),
    )
  }

  describe('login', () => {
    it('throws on empty phoneNumberId', async () => {
      await expect(new WhatsAppBotClient().login({ phoneNumberId: '', accessToken: 'access-token' })).rejects.toThrow(
        WhatsAppBotError,
      )
      await expect(new WhatsAppBotClient().login({ phoneNumberId: '', accessToken: 'access-token' })).rejects.toThrow(
        'Phone number ID is required',
      )
    })

    it('throws on empty accessToken', async () => {
      await expect(new WhatsAppBotClient().login({ phoneNumberId: 'phone-123', accessToken: '' })).rejects.toThrow(
        WhatsAppBotError,
      )
      await expect(new WhatsAppBotClient().login({ phoneNumberId: 'phone-123', accessToken: '' })).rejects.toThrow(
        'Access token is required',
      )
    })

    it('accepts valid phoneNumberId and accessToken', async () => {
      const client = await new WhatsAppBotClient().login({ phoneNumberId: 'phone-123', accessToken: 'access-token' })
      expect(client).toBeInstanceOf(WhatsAppBotClient)
    })
  })

  describe('verifyToken', () => {
    it('sends GET request with correct URL and auth header', async () => {
      mockResponse({ verified_name: 'Test Business' })

      const client = await new WhatsAppBotClient().login({ phoneNumberId: 'phone-123', accessToken: 'my-token' })
      const result = await client.verifyToken()

      expect(result.verified_name).toBe('Test Business')
      expect(fetchCalls.length).toBe(1)
      expect(fetchCalls[0].url).toBe('https://graph.facebook.com/v23.0/phone-123?fields=verified_name')
      expect(fetchCalls[0].options?.headers).toMatchObject({
        Authorization: 'Bearer my-token',
      })
    })

    it('throws WhatsAppBotError on API error', async () => {
      mockResponse({ error: { message: 'Invalid token', code: 190 } }, 401)

      const client = await new WhatsAppBotClient().login({ phoneNumberId: 'phone-123', accessToken: 'bad-token' })
      await expect(client.verifyToken()).rejects.toThrow(WhatsAppBotError)
    })
  })

  describe('sendTextMessage', () => {
    it('sends POST request with correct body shape', async () => {
      mockResponse({
        messaging_product: 'whatsapp',
        contacts: [{ input: '+15551234567', wa_id: '15551234567' }],
        messages: [{ id: 'wamid.abc123' }],
      })

      const client = await new WhatsAppBotClient().login({ phoneNumberId: 'phone-123', accessToken: 'my-token' })
      const result = await client.sendTextMessage('+15551234567', 'Hello world')

      expect(result.messages[0].id).toBe('wamid.abc123')
      expect(fetchCalls[0].url).toBe('https://graph.facebook.com/v23.0/phone-123/messages')
      expect(fetchCalls[0].options?.method).toBe('POST')

      const body = JSON.parse(fetchCalls[0].options?.body as string)
      expect(body).toMatchObject({
        messaging_product: 'whatsapp',
        to: '+15551234567',
        type: 'text',
        text: { body: 'Hello world', preview_url: false },
      })
    })

    it('sends correct Authorization header', async () => {
      mockResponse({
        messaging_product: 'whatsapp',
        contacts: [],
        messages: [{ id: 'wamid.test' }],
      })

      const client = await new WhatsAppBotClient().login({ phoneNumberId: 'phone-123', accessToken: 'secret-token' })
      await client.sendTextMessage('+15551234567', 'Hello')

      expect(fetchCalls[0].options?.headers).toMatchObject({
        Authorization: 'Bearer secret-token',
      })
    })

    it('returns WhatsAppBotMessageResponse', async () => {
      mockResponse({
        messaging_product: 'whatsapp',
        contacts: [{ input: '+15551234567', wa_id: '15551234567' }],
        messages: [{ id: 'wamid.abc123' }],
      })

      const client = await new WhatsAppBotClient().login({ phoneNumberId: 'phone-123', accessToken: 'my-token' })
      const result = await client.sendTextMessage('+15551234567', 'Hello')

      expect(result.messaging_product).toBe('whatsapp')
      expect(result.contacts).toHaveLength(1)
      expect(result.messages).toHaveLength(1)
    })
  })

  describe('sendTemplateMessage', () => {
    it('sends POST with template payload', async () => {
      mockResponse({
        messaging_product: 'whatsapp',
        contacts: [{ input: '+15551234567', wa_id: '15551234567' }],
        messages: [{ id: 'wamid.template1' }],
      })

      const client = await new WhatsAppBotClient().login({ phoneNumberId: 'phone-123', accessToken: 'my-token' })
      await client.sendTemplateMessage('+15551234567', 'hello_world', 'en_US')

      const body = JSON.parse(fetchCalls[0].options?.body as string)
      expect(body).toMatchObject({
        messaging_product: 'whatsapp',
        to: '+15551234567',
        type: 'template',
        template: { name: 'hello_world', language: { code: 'en_US' } },
      })
    })

    it('includes components when provided', async () => {
      mockResponse({
        messaging_product: 'whatsapp',
        contacts: [],
        messages: [{ id: 'wamid.template2' }],
      })

      const components = [{ type: 'body', parameters: [{ type: 'text', text: 'World' }] }]
      const client = await new WhatsAppBotClient().login({ phoneNumberId: 'phone-123', accessToken: 'my-token' })
      await client.sendTemplateMessage('+15551234567', 'greeting', 'en_US', components)

      const body = JSON.parse(fetchCalls[0].options?.body as string)
      expect(body.template.components).toEqual(components)
    })
  })

  describe('sendReaction', () => {
    it('sends POST with reaction payload', async () => {
      mockResponse({
        messaging_product: 'whatsapp',
        contacts: [],
        messages: [{ id: 'wamid.reaction1' }],
      })

      const client = await new WhatsAppBotClient().login({ phoneNumberId: 'phone-123', accessToken: 'my-token' })
      await client.sendReaction('+15551234567', 'wamid.orig123', '👍')

      const body = JSON.parse(fetchCalls[0].options?.body as string)
      expect(body).toMatchObject({
        messaging_product: 'whatsapp',
        to: '+15551234567',
        type: 'reaction',
        reaction: { message_id: 'wamid.orig123', emoji: '👍' },
      })
    })
  })

  describe('sendImageMessage', () => {
    it('sends POST with image payload', async () => {
      mockResponse({
        messaging_product: 'whatsapp',
        contacts: [],
        messages: [{ id: 'wamid.image1' }],
      })

      const client = await new WhatsAppBotClient().login({ phoneNumberId: 'phone-123', accessToken: 'my-token' })
      await client.sendImageMessage('+15551234567', 'https://example.com/photo.jpg', 'My photo')

      const body = JSON.parse(fetchCalls[0].options?.body as string)
      expect(body).toMatchObject({
        messaging_product: 'whatsapp',
        to: '+15551234567',
        type: 'image',
        image: { link: 'https://example.com/photo.jpg', caption: 'My photo' },
      })
    })
  })

  describe('sendDocumentMessage', () => {
    it('sends POST with document payload', async () => {
      mockResponse({
        messaging_product: 'whatsapp',
        contacts: [],
        messages: [{ id: 'wamid.doc1' }],
      })

      const client = await new WhatsAppBotClient().login({ phoneNumberId: 'phone-123', accessToken: 'my-token' })
      await client.sendDocumentMessage('+15551234567', 'https://example.com/report.pdf', 'report.pdf', 'Q4 Report')

      const body = JSON.parse(fetchCalls[0].options?.body as string)
      expect(body).toMatchObject({
        messaging_product: 'whatsapp',
        to: '+15551234567',
        type: 'document',
        document: { link: 'https://example.com/report.pdf', filename: 'report.pdf', caption: 'Q4 Report' },
      })
    })
  })

  describe('listTemplates', () => {
    it('sends GET and unwraps data key from response', async () => {
      mockResponse({
        data: [
          { name: 'hello_world', status: 'APPROVED', category: 'UTILITY', language: 'en_US', components: [] },
          { name: 'order_update', status: 'APPROVED', category: 'UTILITY', language: 'en_US', components: [] },
        ],
      })

      const client = await new WhatsAppBotClient().login({ phoneNumberId: 'phone-123', accessToken: 'my-token' })
      const templates = await client.listTemplates()

      expect(templates).toHaveLength(2)
      expect(templates[0].name).toBe('hello_world')
      expect(templates[1].name).toBe('order_update')
      expect(fetchCalls[0].url).toContain('/phone-123/message_templates')
      expect(fetchCalls[0].options?.method).toBe('GET')
    })

    it('passes limit parameter in URL', async () => {
      mockResponse({ data: [] })

      const client = await new WhatsAppBotClient().login({ phoneNumberId: 'phone-123', accessToken: 'my-token' })
      await client.listTemplates({ limit: 10 })

      expect(fetchCalls[0].url).toContain('limit=10')
    })
  })

  describe('getTemplate', () => {
    it('sends GET with name filter and returns first match', async () => {
      mockResponse({
        data: [{ name: 'hello_world', status: 'APPROVED', category: 'UTILITY', language: 'en_US', components: [] }],
      })

      const client = await new WhatsAppBotClient().login({ phoneNumberId: 'phone-123', accessToken: 'my-token' })
      const template = await client.getTemplate('hello_world')

      expect(template.name).toBe('hello_world')
      expect(fetchCalls[0].url).toContain('name=hello_world')
    })

    it('throws WhatsAppBotError with not_found code when template not found', async () => {
      mockResponse({ data: [] })

      const client = await new WhatsAppBotClient().login({ phoneNumberId: 'phone-123', accessToken: 'my-token' })

      try {
        await client.getTemplate('nonexistent')
        expect.unreachable('should have thrown')
      } catch (err) {
        expect(err).toBeInstanceOf(WhatsAppBotError)
        expect((err as WhatsAppBotError).code).toBe('not_found')
      }
    })
  })

  describe('rate limiting', () => {
    it('waits when x-business-use-case-usage indicates throttle', async () => {
      const usageHeader = JSON.stringify({
        '123456789': [
          {
            call_count: 100,
            total_cputime: 50,
            total_time: 100,
            type: 'UPLOAD_MEDIA',
            estimated_time_to_regain_access: 0.1,
          },
        ],
      })

      mockResponse({ verified_name: 'Test Business' }, 200, { 'x-business-use-case-usage': usageHeader })
      mockResponse({ verified_name: 'Test Business' })

      const client = await new WhatsAppBotClient().login({ phoneNumberId: 'phone-123', accessToken: 'my-token' })
      await client.verifyToken()

      const startTime = Date.now()
      await client.verifyToken()
      const elapsed = Date.now() - startTime

      expect(elapsed).toBeGreaterThanOrEqual(80)
      expect(fetchCalls.length).toBe(2)
    })

    it('retries on 429 with Retry-After header', async () => {
      mockResponse({ error: { message: 'Rate limited', code: 613 } }, 429, { 'Retry-After': '0.1' })
      mockResponse({ verified_name: 'Test Business' })

      const client = await new WhatsAppBotClient().login({ phoneNumberId: 'phone-123', accessToken: 'my-token' })
      const result = await client.verifyToken()

      expect(result.verified_name).toBe('Test Business')
      expect(fetchCalls.length).toBe(2)
    })

    it('throws after max retries exceeded', async () => {
      for (let i = 0; i <= 3; i++) {
        mockResponse({ error: { message: 'Rate limited', code: 613 } }, 429, { 'Retry-After': '0.01' })
      }

      const client = await new WhatsAppBotClient().login({ phoneNumberId: 'phone-123', accessToken: 'my-token' })
      await expect(client.verifyToken()).rejects.toThrow(WhatsAppBotError)
      expect(fetchCalls.length).toBe(4)
    })
  })

  describe('retry logic', () => {
    it('retries on 500 server error for GET requests', async () => {
      mockResponse({ error: { message: 'Internal Server Error' } }, 500)
      mockResponse({ verified_name: 'Test Business' })

      const client = await new WhatsAppBotClient().login({ phoneNumberId: 'phone-123', accessToken: 'my-token' })
      const result = await client.verifyToken()

      expect(result.verified_name).toBe('Test Business')
      expect(fetchCalls.length).toBe(2)
    })

    it('does not retry on 500 for POST requests', async () => {
      mockResponse({ error: { message: 'Internal Server Error' } }, 500)

      const client = await new WhatsAppBotClient().login({ phoneNumberId: 'phone-123', accessToken: 'my-token' })
      await expect(client.sendTextMessage('+15551234567', 'Hello')).rejects.toThrow(WhatsAppBotError)
      expect(fetchCalls.length).toBe(1)
    })

    it('does not retry on 4xx client errors (except 429)', async () => {
      mockResponse({ error: { message: 'Not Found', code: 100 } }, 404)

      const client = await new WhatsAppBotClient().login({ phoneNumberId: 'phone-123', accessToken: 'my-token' })
      await expect(client.verifyToken()).rejects.toThrow(WhatsAppBotError)
      expect(fetchCalls.length).toBe(1)
    })

    it('does not retry on 403 forbidden', async () => {
      mockResponse({ error: { message: 'Forbidden', code: 200 } }, 403)

      const client = await new WhatsAppBotClient().login({ phoneNumberId: 'phone-123', accessToken: 'my-token' })
      await expect(client.verifyToken()).rejects.toThrow(WhatsAppBotError)
      expect(fetchCalls.length).toBe(1)
    })
  })

  describe('request URL construction', () => {
    it('all requests go to https://graph.facebook.com/v23.0/...', async () => {
      mockResponse({ verified_name: 'Test' })
      const client = await new WhatsAppBotClient().login({ phoneNumberId: 'my-phone', accessToken: 'my-token' })
      await client.verifyToken()

      expect(fetchCalls[0].url.startsWith('https://graph.facebook.com/v23.0/')).toBe(true)
    })

    it('Authorization header is Bearer <token>', async () => {
      mockResponse({ verified_name: 'Test' })
      const client = await new WhatsAppBotClient().login({ phoneNumberId: 'phone-123', accessToken: 'my-secret-token' })
      await client.verifyToken()

      expect(fetchCalls[0].options?.headers).toMatchObject({
        Authorization: 'Bearer my-secret-token',
      })
    })
  })
})
