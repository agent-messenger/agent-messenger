import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { WebexClient } from './client'
import { WebexError } from './types'

describe('WebexClient', () => {
  const originalFetch = globalThis.fetch
  let fetchCalls: Array<{ url: string; options?: RequestInit }> = []
  let fetchResponses: Response[] = []
  let fetchIndex = 0

  beforeEach(() => {
    fetchCalls = []
    fetchResponses = []
    fetchIndex = 0
    ;(globalThis as { fetch: unknown }).fetch = async (
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
    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-RateLimit-Remaining': '10',
      'X-RateLimit-Reset': String(Date.now() / 1000 + 60),
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
    test('accepts valid token', async () => {
      const client = await new WebexClient().login({ token: 'test-token' })
      expect(client).toBeInstanceOf(WebexClient)
    })

    test('throws on empty token', async () => {
      await expect(new WebexClient().login({ token: '' })).rejects.toThrow(WebexError)
      await expect(new WebexClient().login({ token: '' })).rejects.toThrow('Token is required')
    })
  })

  describe('testAuth', () => {
    test('calls GET /people/me and returns person', async () => {
      mockResponse({
        id: 'user-123',
        displayName: 'Test User',
        emails: ['test@example.com'],
      })

      const client = await new WebexClient().login({ token: 'test-token' })
      const person = await client.testAuth()

      expect(person.id).toBe('user-123')
      expect(person.displayName).toBe('Test User')
      expect(fetchCalls.length).toBe(1)
      expect(fetchCalls[0].url).toBe('https://webexapis.com/v1/people/me')
      expect(fetchCalls[0].options?.headers).toMatchObject({
        Authorization: 'Bearer test-token',
      })
    })

    test('throws WebexError on API error', async () => {
      mockResponse({ message: 'Unauthorized' }, 401)

      const client = await new WebexClient().login({ token: 'bad-token' })
      await expect(client.testAuth()).rejects.toThrow(WebexError)
    })
  })

  describe('listSpaces', () => {
    test('returns unwrapped items array', async () => {
      mockResponse({
        items: [
          { id: 'room1', title: 'Room One', type: 'group' },
          { id: 'room2', title: 'Room Two', type: 'direct' },
        ],
      })

      const client = await new WebexClient().login({ token: 'test-token' })
      const spaces = await client.listSpaces()

      expect(spaces).toHaveLength(2)
      expect(spaces[0].id).toBe('room1')
      expect(spaces[1].title).toBe('Room Two')
    })

    test('includes default max=50 query param', async () => {
      mockResponse({ items: [] })

      const client = await new WebexClient().login({ token: 'test-token' })
      await client.listSpaces()

      expect(fetchCalls[0].url).toContain('max=50')
    })

    test('passes type and max query params', async () => {
      mockResponse({ items: [] })

      const client = await new WebexClient().login({ token: 'test-token' })
      await client.listSpaces({ type: 'direct', max: 10 })

      expect(fetchCalls[0].url).toContain('type=direct')
      expect(fetchCalls[0].url).toContain('max=10')
      expect(fetchCalls[0].url).toContain('/rooms')
    })
  })

  describe('getSpace', () => {
    test('calls GET /rooms/{spaceId}', async () => {
      mockResponse({ id: 'room1', title: 'Test Room', type: 'group' })

      const client = await new WebexClient().login({ token: 'test-token' })
      const space = await client.getSpace('room1')

      expect(space.id).toBe('room1')
      expect(fetchCalls[0].url).toBe('https://webexapis.com/v1/rooms/room1')
    })
  })

  describe('sendMessage', () => {
    test('posts text message to room', async () => {
      mockResponse({ id: 'msg1', roomId: 'room1', text: 'Hello world' })

      const client = await new WebexClient().login({ token: 'test-token' })
      const message = await client.sendMessage('room1', 'Hello world')

      expect(message.id).toBe('msg1')
      expect(fetchCalls[0].url).toBe('https://webexapis.com/v1/messages')
      expect(fetchCalls[0].options?.method).toBe('POST')
      expect(fetchCalls[0].options?.body).toBe(JSON.stringify({ roomId: 'room1', text: 'Hello world' }))
    })

    test('sends markdown message when option set', async () => {
      mockResponse({ id: 'msg1', roomId: 'room1', markdown: '**bold**' })

      const client = await new WebexClient().login({ token: 'test-token' })
      await client.sendMessage('room1', '**bold**', { markdown: true })

      expect(fetchCalls[0].options?.body).toBe(
        JSON.stringify({ roomId: 'room1', markdown: '**bold**' }),
      )
    })
  })

  describe('sendDirectMessage', () => {
    test('posts message with toPersonEmail', async () => {
      mockResponse({ id: 'msg1', toPersonEmail: 'user@example.com', text: 'Hello' })

      const client = await new WebexClient().login({ token: 'test-token' })
      await client.sendDirectMessage('user@example.com', 'Hello')

      expect(fetchCalls[0].options?.body).toBe(
        JSON.stringify({ toPersonEmail: 'user@example.com', text: 'Hello' }),
      )
    })

    test('sends markdown direct message when option set', async () => {
      mockResponse({ id: 'msg1', toPersonEmail: 'user@example.com' })

      const client = await new WebexClient().login({ token: 'test-token' })
      await client.sendDirectMessage('user@example.com', '**bold**', { markdown: true })

      expect(fetchCalls[0].options?.body).toBe(
        JSON.stringify({ toPersonEmail: 'user@example.com', markdown: '**bold**' }),
      )
    })
  })

  describe('listMessages', () => {
    test('includes roomId query param and unwraps items', async () => {
      mockResponse({
        items: [
          { id: 'msg1', roomId: 'room1', text: 'Message 1' },
          { id: 'msg2', roomId: 'room1', text: 'Message 2' },
        ],
      })

      const client = await new WebexClient().login({ token: 'test-token' })
      const messages = await client.listMessages('room1')

      expect(messages).toHaveLength(2)
      expect(messages[0].id).toBe('msg1')
      expect(fetchCalls[0].url).toContain('roomId=room1')
      expect(fetchCalls[0].url).toContain('max=50')
    })

    test('passes custom max', async () => {
      mockResponse({ items: [] })

      const client = await new WebexClient().login({ token: 'test-token' })
      await client.listMessages('room1', { max: 10 })

      expect(fetchCalls[0].url).toContain('max=10')
    })
  })

  describe('getMessage', () => {
    test('calls GET /messages/{messageId}', async () => {
      mockResponse({ id: 'msg1', roomId: 'room1', text: 'Hello' })

      const client = await new WebexClient().login({ token: 'test-token' })
      const message = await client.getMessage('msg1')

      expect(message.id).toBe('msg1')
      expect(fetchCalls[0].url).toBe('https://webexapis.com/v1/messages/msg1')
    })
  })

  describe('deleteMessage', () => {
    test('calls DELETE /messages/{messageId} and handles 204', async () => {
      mockResponse(null, 204)

      const client = await new WebexClient().login({ token: 'test-token' })
      await client.deleteMessage('msg1')

      expect(fetchCalls[0].url).toBe('https://webexapis.com/v1/messages/msg1')
      expect(fetchCalls[0].options?.method).toBe('DELETE')
    })
  })

  describe('editMessage', () => {
    test('calls PUT /messages/{messageId} with roomId and text', async () => {
      mockResponse({ id: 'msg1', roomId: 'room1', text: 'Edited text' })

      const client = await new WebexClient().login({ token: 'test-token' })
      await client.editMessage('msg1', 'room1', 'Edited text')

      expect(fetchCalls[0].url).toBe('https://webexapis.com/v1/messages/msg1')
      expect(fetchCalls[0].options?.method).toBe('PUT')
      expect(fetchCalls[0].options?.body).toBe(
        JSON.stringify({ roomId: 'room1', text: 'Edited text' }),
      )
    })

    test('sends markdown when option set', async () => {
      mockResponse({ id: 'msg1', roomId: 'room1', markdown: '**edited**' })

      const client = await new WebexClient().login({ token: 'test-token' })
      await client.editMessage('msg1', 'room1', '**edited**', { markdown: true })

      expect(fetchCalls[0].options?.body).toBe(
        JSON.stringify({ roomId: 'room1', markdown: '**edited**' }),
      )
    })
  })

  describe('listPeople', () => {
    test('returns unwrapped items', async () => {
      mockResponse({
        items: [
          { id: 'u1', displayName: 'User One', emails: ['user1@example.com'] },
          { id: 'u2', displayName: 'User Two', emails: ['user2@example.com'] },
        ],
      })

      const client = await new WebexClient().login({ token: 'test-token' })
      const people = await client.listPeople()

      expect(people).toHaveLength(2)
      expect(people[0].displayName).toBe('User One')
    })

    test('passes email, displayName, max query params', async () => {
      mockResponse({ items: [] })

      const client = await new WebexClient().login({ token: 'test-token' })
      await client.listPeople({ email: 'user@example.com', displayName: 'Test', max: 5 })

      expect(fetchCalls[0].url).toContain('email=user%40example.com')
      expect(fetchCalls[0].url).toContain('displayName=Test')
      expect(fetchCalls[0].url).toContain('max=5')
    })
  })

  describe('listMemberships', () => {
    test('includes roomId and returns unwrapped items', async () => {
      mockResponse({
        items: [
          { id: 'm1', roomId: 'room1', personEmail: 'user1@example.com', isModerator: false },
          { id: 'm2', roomId: 'room1', personEmail: 'user2@example.com', isModerator: true },
        ],
      })

      const client = await new WebexClient().login({ token: 'test-token' })
      const memberships = await client.listMemberships('room1')

      expect(memberships).toHaveLength(2)
      expect(memberships[0].id).toBe('m1')
      expect(fetchCalls[0].url).toContain('roomId=room1')
    })

    test('passes max query param', async () => {
      mockResponse({ items: [] })

      const client = await new WebexClient().login({ token: 'test-token' })
      await client.listMemberships('room1', { max: 20 })

      expect(fetchCalls[0].url).toContain('max=20')
    })
  })

  describe('rate limiting', () => {
    test('retries on 429 with Retry-After header', async () => {
      mockResponse({ message: 'Rate limited' }, 429, { 'Retry-After': '0.1' })
      mockResponse({
        id: 'user-123',
        displayName: 'Test User',
        emails: ['test@example.com'],
      })

      const client = await new WebexClient().login({ token: 'test-token' })
      const person = await client.testAuth()

      expect(person.id).toBe('user-123')
      expect(fetchCalls.length).toBe(2)
    })

    test('throws after max retries exceeded on 429', async () => {
      for (let i = 0; i <= MAX_RETRIES; i++) {
        mockResponse({ message: 'Rate limited' }, 429, { 'Retry-After': '0.01' })
      }

      const client = await new WebexClient().login({ token: 'test-token' })
      await expect(client.testAuth()).rejects.toThrow(WebexError)
      expect(fetchCalls.length).toBeLessThanOrEqual(4)
    })
  })

  describe('server errors', () => {
    test('retries on 500 with exponential backoff', async () => {
      mockResponse({ message: 'Internal Server Error' }, 500)
      mockResponse({
        id: 'user-123',
        displayName: 'Test User',
        emails: ['test@example.com'],
      })

      const client = await new WebexClient().login({ token: 'test-token' })
      const person = await client.testAuth()

      expect(person.id).toBe('user-123')
      expect(fetchCalls.length).toBe(2)
    })

    test('does not retry on 4xx errors except 429', async () => {
      mockResponse({ message: 'Not Found' }, 404)

      const client = await new WebexClient().login({ token: 'test-token' })
      await expect(client.testAuth()).rejects.toThrow(WebexError)
      expect(fetchCalls.length).toBe(1)
    })

    test('backoff increases with multiple retries', async () => {
      mockResponse({ message: 'Error' }, 500)
      mockResponse({ message: 'Error' }, 500)
      mockResponse({
        id: 'user-123',
        displayName: 'Test User',
        emails: ['test@example.com'],
      })

      const client = await new WebexClient().login({ token: 'test-token' })
      const startTime = Date.now()
      await client.testAuth()
      const elapsed = Date.now() - startTime

      expect(elapsed).toBeGreaterThanOrEqual(150)
      expect(fetchCalls.length).toBe(3)
    })
  })

  describe('error handling', () => {
    test('throws WebexError with parsed message from response body', async () => {
      mockResponse({ message: 'The requested resource could not be found.', trackingId: 'abc' }, 404)

      const client = await new WebexClient().login({ token: 'test-token' })
      let error: WebexError | null = null
      try {
        await client.testAuth()
      } catch (err) {
        error = err as WebexError
      }

      expect(error).toBeInstanceOf(WebexError)
      expect(error?.message).toBe('The requested resource could not be found.')
    })

    test('falls back to HTTP status message when no body', async () => {
      fetchResponses.push(
        new Response(null, {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }),
      )

      const client = await new WebexClient().login({ token: 'test-token' })
      let error: WebexError | null = null
      try {
        await client.testAuth()
      } catch (err) {
        error = err as WebexError
      }

      expect(error).toBeInstanceOf(WebexError)
      expect(error?.message).toBe('HTTP 403')
    })
  })
})

const MAX_RETRIES = 3
