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

    test('accepts deviceUrl and tokenType', async () => {
      const client = await new WebexClient().login({
        token: 'test-token',
        deviceUrl: 'https://wdm-r.wbx2.com/wdm/api/v1/devices/dev-1',
        tokenType: 'extracted',
      })
      expect(client).toBeInstanceOf(WebexClient)
      expect((client as any).deviceUrl).toBe('https://wdm-r.wbx2.com/wdm/api/v1/devices/dev-1')
      expect((client as any).tokenType).toBe('extracted')
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

    test('falls back to internal API when public API fails for extracted tokens', async () => {
      // given - public API rejects, internal API succeeds
      mockResponse({ message: 'Unauthorized' }, 401)
      fetchResponses.push(
        new Response(JSON.stringify({ id: 'conv-1', activities: { items: [] } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )

      const client = await new WebexClient().login({
        token: 'extracted-token',
        deviceUrl: 'https://wdm-r.wbx2.com/wdm/api/v1/devices/dev-1',
        tokenType: 'extracted',
      })

      // when
      const person = await client.testAuth()

      // then - succeeds via internal API
      expect(fetchCalls.length).toBe(2)
      expect(fetchCalls[0].url).toBe('https://webexapis.com/v1/people/me')
      expect(fetchCalls[1].url).toContain('conv-r.wbx2.com/conversation/api/v1/conversations')
      expect(person).toBeTruthy()
    })

    test('throws when both public and internal APIs fail for extracted tokens', async () => {
      // given - both APIs reject
      mockResponse({ message: 'Unauthorized' }, 401)
      fetchResponses.push(
        new Response(JSON.stringify({ message: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      )

      const client = await new WebexClient().login({
        token: 'bad-extracted-token',
        deviceUrl: 'https://wdm-r.wbx2.com/wdm/api/v1/devices/dev-1',
        tokenType: 'extracted',
      })

      await expect(client.testAuth()).rejects.toThrow(WebexError)
    })

    test('does not use internal API fallback for non-extracted tokens', async () => {
      mockResponse({ message: 'Unauthorized' }, 401)

      const client = await new WebexClient().login({ token: 'bad-token' })
      await expect(client.testAuth()).rejects.toThrow(WebexError)
      expect(fetchCalls.length).toBe(1)
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

      expect(fetchCalls[0].options?.body).toBe(JSON.stringify({ roomId: 'room1', markdown: '**bold**' }))
    })
  })

  describe('sendDirectMessage', () => {
    test('posts message with toPersonEmail', async () => {
      mockResponse({ id: 'msg1', toPersonEmail: 'user@example.com', text: 'Hello' })

      const client = await new WebexClient().login({ token: 'test-token' })
      await client.sendDirectMessage('user@example.com', 'Hello')

      expect(fetchCalls[0].options?.body).toBe(JSON.stringify({ toPersonEmail: 'user@example.com', text: 'Hello' }))
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
      expect(fetchCalls[0].options?.body).toBe(JSON.stringify({ roomId: 'room1', text: 'Edited text' }))
    })

    test('sends markdown when option set', async () => {
      mockResponse({ id: 'msg1', roomId: 'room1', markdown: '**edited**' })

      const client = await new WebexClient().login({ token: 'test-token' })
      await client.editMessage('msg1', 'room1', '**edited**', { markdown: true })

      expect(fetchCalls[0].options?.body).toBe(JSON.stringify({ roomId: 'room1', markdown: '**edited**' }))
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

  describe('internal conversation API', () => {
    const TEST_DEVICE_URL = 'https://wdm-r.wbx2.com/wdm/api/v1/devices/test-device-id'
    const CONV_BASE = 'https://conv-r.wbx2.com/conversation/api/v1'
    const TEST_ROOM_ID = Buffer.from('ciscospark://urn:TEAM:us-west-2_r/ROOM/abc123-def456').toString('base64')
    const TEST_CONV_UUID = 'abc123-def456'

    const mockActivity = (text: string, overrides?: Partial<Record<string, unknown>>) => ({
      id: 'activity-123',
      verb: 'post',
      actor: { displayName: 'Test User', emailAddress: 'test@example.com', entryUUID: 'user-uuid' },
      object: { objectType: 'comment', content: text, displayName: text },
      target: { id: TEST_CONV_UUID },
      published: '2026-01-01T00:00:00.000Z',
      ...overrides,
    })

    const mockConversation = (activities: ReturnType<typeof mockActivity>[]) => ({
      id: TEST_CONV_UUID,
      activities: { items: activities },
    })

    const createExtractedClient = async () => {
      return new WebexClient().login({
        token: 'extracted-token',
        deviceUrl: TEST_DEVICE_URL,
        tokenType: 'extracted',
      })
    }

    describe('sendMessage', () => {
      test('posts activity to /activities with POST method', async () => {
        mockResponse(mockActivity('Hello world'))

        const client = await createExtractedClient()
        await client.sendMessage(TEST_ROOM_ID, 'Hello world')

        expect(fetchCalls[0].url).toBe(`${CONV_BASE}/activities`)
        expect(fetchCalls[0].options?.method).toBe('POST')
      })

      test('body has verb, object type, displayName, and content', async () => {
        mockResponse(mockActivity('Hello world'))

        const client = await createExtractedClient()
        await client.sendMessage(TEST_ROOM_ID, 'Hello world')

        const body = JSON.parse(fetchCalls[0].options?.body as string)
        expect(body.verb).toBe('post')
        expect(body.object.objectType).toBe('comment')
        expect(body.object.displayName).toBe('Hello world')
        expect(body.object.content).toBe('Hello world')
      })

      test('body has target with decoded conv UUID and conversation type', async () => {
        mockResponse(mockActivity('Hello world'))

        const client = await createExtractedClient()
        await client.sendMessage(TEST_ROOM_ID, 'Hello world')

        const body = JSON.parse(fetchCalls[0].options?.body as string)
        expect(body.target.id).toBe(TEST_CONV_UUID)
        expect(body.target.objectType).toBe('conversation')
      })

      test('body has clientTempId starting with tmp-', async () => {
        mockResponse(mockActivity('Hello world'))

        const client = await createExtractedClient()
        await client.sendMessage(TEST_ROOM_ID, 'Hello world')

        const body = JSON.parse(fetchCalls[0].options?.body as string)
        expect(body.clientTempId).toStartWith('tmp-')
      })

      test('includes cisco-device-url header', async () => {
        mockResponse(mockActivity('Hello world'))

        const client = await createExtractedClient()
        await client.sendMessage(TEST_ROOM_ID, 'Hello world')

        expect(fetchCalls[0].options?.headers).toMatchObject({
          'cisco-device-url': TEST_DEVICE_URL,
        })
      })

      test('returns WebexMessage mapped from activity response', async () => {
        mockResponse(mockActivity('Hello world'))

        const client = await createExtractedClient()
        const message = await client.sendMessage(TEST_ROOM_ID, 'Hello world')

        expect(message.id).toBe('activity-123')
        expect(message.text).toBe('Hello world')
        expect(message.personEmail).toBe('test@example.com')
        expect(message.created).toBe('2026-01-01T00:00:00.000Z')
      })

      test('markdown option converts content to HTML and strips displayName', async () => {
        mockResponse(mockActivity('bold text'))

        const client = await createExtractedClient()
        await client.sendMessage(TEST_ROOM_ID, '**bold text**', { markdown: true })

        const body = JSON.parse(fetchCalls[0].options?.body as string)
        expect(body.object.displayName).toBe('bold text')
        expect(body.object.content).toBe('<strong>bold text</strong>')
        expect(body.object.markdown).toBeUndefined()
      })

      test('markdown option does not affect plain text messages', async () => {
        mockResponse(mockActivity('Hello world'))

        const client = await createExtractedClient()
        await client.sendMessage(TEST_ROOM_ID, 'Hello world')

        const body = JSON.parse(fetchCalls[0].options?.body as string)
        expect(body.object.displayName).toBe('Hello world')
        expect(body.object.content).toBe('Hello world')
      })
    })

    describe('listMessages', () => {
      test('calls GET on conversations endpoint with activitiesLimit and participantsLimit', async () => {
        mockResponse(mockConversation([mockActivity('Hello')]))

        const client = await createExtractedClient()
        await client.listMessages(TEST_ROOM_ID)

        expect(fetchCalls[0].url).toBe(
          `${CONV_BASE}/conversations/${TEST_CONV_UUID}?activitiesLimit=50&participantsLimit=0`,
        )
      })

      test('filters activities to only those with verb post', async () => {
        mockResponse(
          mockConversation([
            mockActivity('Hello'),
            { ...mockActivity('Deleted'), verb: 'delete' },
            mockActivity('World'),
          ]),
        )

        const client = await createExtractedClient()
        const messages = await client.listMessages(TEST_ROOM_ID)

        expect(messages).toHaveLength(2)
        expect(messages[0].text).toBe('Hello')
        expect(messages[1].text).toBe('World')
      })

      test('maps each activity to WebexMessage format', async () => {
        mockResponse(mockConversation([mockActivity('Hello')]))

        const client = await createExtractedClient()
        const messages = await client.listMessages(TEST_ROOM_ID)

        expect(messages[0].id).toBe('activity-123')
        expect(messages[0].text).toBe('Hello')
        expect(messages[0].personEmail).toBe('test@example.com')
        expect(messages[0].created).toBe('2026-01-01T00:00:00.000Z')
      })

      test('passes custom max to activitiesLimit', async () => {
        mockResponse(mockConversation([]))

        const client = await createExtractedClient()
        await client.listMessages(TEST_ROOM_ID, { max: 25 })

        expect(fetchCalls[0].url).toContain('activitiesLimit=25')
      })

      test('includes cisco-device-url header', async () => {
        mockResponse(mockConversation([]))

        const client = await createExtractedClient()
        await client.listMessages(TEST_ROOM_ID)

        expect(fetchCalls[0].options?.headers).toMatchObject({
          'cisco-device-url': TEST_DEVICE_URL,
        })
      })
    })

    describe('getMessage', () => {
      test('calls GET on activities endpoint', async () => {
        mockResponse(mockActivity('Hello'))

        const client = await createExtractedClient()
        await client.getMessage('activity-123')

        expect(fetchCalls[0].url).toBe(`${CONV_BASE}/activities/activity-123`)
      })

      test('maps activity to WebexMessage format', async () => {
        mockResponse(mockActivity('Hello'))

        const client = await createExtractedClient()
        const message = await client.getMessage('activity-123')

        expect(message.id).toBe('activity-123')
        expect(message.text).toBe('Hello')
        expect(message.personEmail).toBe('test@example.com')
      })
    })

    describe('deleteMessage', () => {
      test('first GETs the activity then POSTs a delete activity', async () => {
        mockResponse(mockActivity('Hello'))
        mockResponse({})

        const client = await createExtractedClient()
        await client.deleteMessage('activity-123')

        expect(fetchCalls[0].url).toBe(`${CONV_BASE}/activities/activity-123`)
        expect(fetchCalls[1].url).toBe(`${CONV_BASE}/activities`)
        expect(fetchCalls[1].options?.method).toBe('POST')
      })

      test('delete activity body has correct verb, object, and target', async () => {
        mockResponse(mockActivity('Hello'))
        mockResponse({})

        const client = await createExtractedClient()
        await client.deleteMessage('activity-123')

        const body = JSON.parse(fetchCalls[1].options?.body as string)
        expect(body.verb).toBe('delete')
        expect(body.object.id).toBe('activity-123')
        expect(body.object.objectType).toBe('activity')
        expect(body.target.id).toBe(TEST_CONV_UUID)
      })

      test('throws WebexError when activity has no target', async () => {
        mockResponse({ ...mockActivity('Hello'), target: undefined })

        const client = await createExtractedClient()
        await expect(client.deleteMessage('activity-123')).rejects.toThrow(WebexError)
      })
    })

    describe('editMessage', () => {
      test('posts activity with verb post and parent edit reference', async () => {
        mockResponse(mockActivity('Edited text'))

        const client = await createExtractedClient()
        await client.editMessage('activity-123', TEST_ROOM_ID, 'Edited text')

        const body = JSON.parse(fetchCalls[0].options?.body as string)
        expect(body.verb).toBe('post')
        expect(body.parent).toEqual({ id: 'activity-123', type: 'edit' })
      })

      test('body has object with comment type and new text', async () => {
        mockResponse(mockActivity('Edited text'))

        const client = await createExtractedClient()
        await client.editMessage('activity-123', TEST_ROOM_ID, 'Edited text')

        const body = JSON.parse(fetchCalls[0].options?.body as string)
        expect(body.object.objectType).toBe('comment')
        expect(body.object.displayName).toBe('Edited text')
        expect(body.object.content).toBe('Edited text')
      })

      test('target has decoded conv UUID', async () => {
        mockResponse(mockActivity('Edited text'))

        const client = await createExtractedClient()
        await client.editMessage('activity-123', TEST_ROOM_ID, 'Edited text')

        const body = JSON.parse(fetchCalls[0].options?.body as string)
        expect(body.target.id).toBe(TEST_CONV_UUID)
      })

      test('markdown option converts content to HTML and strips displayName', async () => {
        mockResponse(mockActivity('italic text'))

        const client = await createExtractedClient()
        await client.editMessage('activity-123', TEST_ROOM_ID, '_italic text_', { markdown: true })

        const body = JSON.parse(fetchCalls[0].options?.body as string)
        expect(body.object.displayName).toBe('italic text')
        expect(body.object.content).toBe('<em>italic text</em>')
        expect(body.object.markdown).toBeUndefined()
      })
    })

    describe('sendDirectMessage', () => {
      test('calls public rooms and memberships API to find room, then sends via internal API', async () => {
        mockResponse({ items: [{ id: TEST_ROOM_ID, title: 'DM', type: 'direct' }] })
        mockResponse({
          items: [{ id: 'm1', roomId: TEST_ROOM_ID, personEmail: 'target@example.com', isModerator: false }],
        })
        mockResponse(mockActivity('Hello'))

        const client = await createExtractedClient()
        const message = await client.sendDirectMessage('target@example.com', 'Hello')

        expect(fetchCalls[0].url).toContain('/rooms?type=direct&max=100')
        expect(fetchCalls[1].url).toContain('/memberships?roomId=')
        expect(fetchCalls[2].url).toBe(`${CONV_BASE}/activities`)
        expect(message.id).toBe('activity-123')
      })

      test('throws WebexError when no existing direct conversation found', async () => {
        mockResponse({ items: [{ id: 'room-x', title: 'DM', type: 'direct' }] })
        mockResponse({
          items: [{ id: 'm1', roomId: 'room-x', personEmail: 'other@example.com', isModerator: false }],
        })

        const client = await createExtractedClient()
        await expect(client.sendDirectMessage('target@example.com', 'Hello')).rejects.toThrow(WebexError)
      })
    })

    describe('error handling', () => {
      test('throws WebexError when internal API returns non-OK response', async () => {
        fetchResponses.push(
          new Response(JSON.stringify({ message: 'Activity not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          }),
        )

        const client = await createExtractedClient()
        await expect(client.getMessage('bad-activity')).rejects.toThrow(WebexError)
      })

      test('error message extracted from internal API response body', async () => {
        fetchResponses.push(
          new Response(JSON.stringify({ message: 'Activity not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          }),
        )

        const client = await createExtractedClient()
        let error: WebexError | null = null
        try {
          await client.getMessage('bad-activity')
        } catch (err) {
          error = err as WebexError
        }

        expect(error).toBeInstanceOf(WebexError)
        expect(error?.message).toBe('Activity not found')
      })
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
