import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { DiscordClient, DiscordError } from './client'

describe('DiscordClient', () => {
  const originalFetch = globalThis.fetch
  let fetchCalls: Array<{ url: string; options?: RequestInit }> = []
  let fetchResponses: Response[] = []
  let fetchIndex = 0

  beforeEach(() => {
    fetchCalls = []
    fetchResponses = []
    fetchIndex = 0
    ;(globalThis as any).fetch = async (url: string | URL | Request, options?: RequestInit): Promise<Response> => {
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

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  const mockResponse = (body: unknown, status = 200, headers: Record<string, string> = {}) => {
    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-RateLimit-Remaining': '10',
      'X-RateLimit-Reset': String(Date.now() / 1000 + 60),
      'X-RateLimit-Bucket': 'test-bucket',
      ...headers,
    }
    fetchResponses.push(
      new Response(body === null ? null : JSON.stringify(body), {
        status,
        headers: defaultHeaders,
      }),
    )
  }

  describe('constructor', () => {
    test('requires token', () => {
      expect(() => new DiscordClient('')).toThrow(DiscordError)
      expect(() => new DiscordClient('')).toThrow('Token is required')
    })

    test('accepts valid token', () => {
      const client = new DiscordClient('test-token')
      expect(client).toBeInstanceOf(DiscordClient)
    })
  })

  describe('testAuth', () => {
    test('returns current user info', async () => {
      mockResponse({
        id: '123456789',
        username: 'testuser',
        global_name: 'Test User',
        avatar: 'abc123',
      })

      const client = new DiscordClient('test-token')
      const user = await client.testAuth()

      expect(user.id).toBe('123456789')
      expect(user.username).toBe('testuser')
      expect(fetchCalls.length).toBe(1)
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/users/@me')
      expect(fetchCalls[0].options?.headers).toMatchObject({
        Authorization: 'test-token',
      })
    })

    test('throws DiscordError on API error', async () => {
      mockResponse({ message: 'Unauthorized', code: 401 }, 401)

      const client = new DiscordClient('bad-token')
      await expect(client.testAuth()).rejects.toThrow(DiscordError)
    })
  })

  describe('listServers', () => {
    test('returns list of servers', async () => {
      mockResponse([
        { id: '111', name: 'Server One' },
        { id: '222', name: 'Server Two' },
      ])

      const client = new DiscordClient('test-token')
      const servers = await client.listServers()

      expect(servers).toHaveLength(2)
      expect(servers[0].name).toBe('Server One')
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/users/@me/guilds')
    })
  })

  describe('getServer', () => {
    test('returns server info', async () => {
      mockResponse({ id: '111', name: 'Test Server' })

      const client = new DiscordClient('test-token')
      const server = await client.getServer('111')

      expect(server.id).toBe('111')
      expect(server.name).toBe('Test Server')
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/guilds/111')
    })
  })

  describe('listChannels', () => {
    test('returns list of channels for server', async () => {
      mockResponse([
        { id: 'ch1', guild_id: '111', name: 'general', type: 0 },
        { id: 'ch2', guild_id: '111', name: 'random', type: 0 },
      ])

      const client = new DiscordClient('test-token')
      const channels = await client.listChannels('111')

      expect(channels).toHaveLength(2)
      expect(channels[0].name).toBe('general')
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/guilds/111/channels')
    })
  })

  describe('getChannel', () => {
    test('returns channel info', async () => {
      mockResponse({ id: 'ch1', guild_id: '111', name: 'general', type: 0 })

      const client = new DiscordClient('test-token')
      const channel = await client.getChannel('ch1')

      expect(channel.id).toBe('ch1')
      expect(channel.name).toBe('general')
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/channels/ch1')
    })
  })

  describe('sendMessage', () => {
    test('sends message to channel', async () => {
      mockResponse({
        id: 'msg1',
        channel_id: 'ch1',
        author: { id: '123', username: 'bot' },
        content: 'Hello world',
        timestamp: '2024-01-01T00:00:00.000Z',
      })

      const client = new DiscordClient('test-token')
      const message = await client.sendMessage('ch1', 'Hello world')

      expect(message.content).toBe('Hello world')
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/channels/ch1/messages')
      expect(fetchCalls[0].options?.method).toBe('POST')
      expect(fetchCalls[0].options?.body).toBe(JSON.stringify({ content: 'Hello world' }))
    })
  })

  describe('getMessages', () => {
    test('returns messages from channel', async () => {
      mockResponse([
        {
          id: 'msg1',
          channel_id: 'ch1',
          author: { id: '123', username: 'user1' },
          content: 'Message 1',
          timestamp: '2024-01-01T00:00:00.000Z',
        },
      ])

      const client = new DiscordClient('test-token')
      const messages = await client.getMessages('ch1', 50)

      expect(messages).toHaveLength(1)
      expect(messages[0].content).toBe('Message 1')
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/channels/ch1/messages?limit=50')
    })

    test('uses default limit of 50', async () => {
      mockResponse([])

      const client = new DiscordClient('test-token')
      await client.getMessages('ch1')

      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/channels/ch1/messages?limit=50')
    })
  })

  describe('getMessage', () => {
    test('returns single message', async () => {
      mockResponse({
        id: 'msg1',
        channel_id: 'ch1',
        author: { id: '123', username: 'user1' },
        content: 'Message 1',
        timestamp: '2024-01-01T00:00:00.000Z',
      })

      const client = new DiscordClient('test-token')
      const message = await client.getMessage('ch1', 'msg1')

      expect(message.id).toBe('msg1')
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/channels/ch1/messages/msg1')
    })
  })

  describe('deleteMessage', () => {
    test('deletes message', async () => {
      mockResponse(null, 204)

      const client = new DiscordClient('test-token')
      await client.deleteMessage('ch1', 'msg1')

      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/channels/ch1/messages/msg1')
      expect(fetchCalls[0].options?.method).toBe('DELETE')
    })
  })

  describe('addReaction', () => {
    test('adds reaction to message', async () => {
      mockResponse(null, 204)

      const client = new DiscordClient('test-token')
      await client.addReaction('ch1', 'msg1', '👍')

      expect(fetchCalls[0].url).toBe(
        'https://discord.com/api/v10/channels/ch1/messages/msg1/reactions/%F0%9F%91%8D/@me',
      )
      expect(fetchCalls[0].options?.method).toBe('PUT')
    })
  })

  describe('removeReaction', () => {
    test('removes reaction from message', async () => {
      mockResponse(null, 204)

      const client = new DiscordClient('test-token')
      await client.removeReaction('ch1', 'msg1', '👍')

      expect(fetchCalls[0].url).toBe(
        'https://discord.com/api/v10/channels/ch1/messages/msg1/reactions/%F0%9F%91%8D/@me',
      )
      expect(fetchCalls[0].options?.method).toBe('DELETE')
    })
  })

  describe('listUsers', () => {
    test('returns list of server members', async () => {
      mockResponse([{ user: { id: 'u1', username: 'user1' } }, { user: { id: 'u2', username: 'user2' } }])

      const client = new DiscordClient('test-token')
      const users = await client.listUsers('111')

      expect(users).toHaveLength(2)
      expect(users[0].username).toBe('user1')
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/guilds/111/members?limit=1000')
    })
  })

  describe('getUser', () => {
    test('returns user info', async () => {
      mockResponse({ id: 'u1', username: 'testuser' })

      const client = new DiscordClient('test-token')
      const user = await client.getUser('u1')

      expect(user.id).toBe('u1')
      expect(user.username).toBe('testuser')
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/users/u1')
    })
  })

  describe('uploadFile', () => {
    test('uploads file to channel', async () => {
      const tempFile = '/tmp/test-upload.txt'
      await Bun.write(tempFile, 'test content')

      mockResponse({
        id: 'msg1',
        channel_id: 'ch1',
        author: { id: '123', username: 'bot' },
        content: '',
        timestamp: '2024-01-01T00:00:00.000Z',
        attachments: [
          {
            id: 'att1',
            filename: 'test-upload.txt',
            size: 12,
            url: 'https://cdn.discord.com/attachments/ch1/att1/test-upload.txt',
          },
        ],
      })

      const client = new DiscordClient('test-token')
      const file = await client.uploadFile('ch1', tempFile)

      expect(file.filename).toBe('test-upload.txt')
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/channels/ch1/messages')
      expect(fetchCalls[0].options?.method).toBe('POST')
    })
  })

  describe('listFiles', () => {
    test('returns files from recent messages', async () => {
      mockResponse([
        {
          id: 'msg1',
          channel_id: 'ch1',
          author: { id: '123', username: 'user1' },
          content: '',
          timestamp: '2024-01-01T00:00:00.000Z',
          attachments: [{ id: 'att1', filename: 'file1.txt', size: 100, url: 'https://example.com/file1.txt' }],
        },
        {
          id: 'msg2',
          channel_id: 'ch1',
          author: { id: '456', username: 'user2' },
          content: 'No attachments',
          timestamp: '2024-01-01T00:00:01.000Z',
          attachments: [],
        },
      ])

      const client = new DiscordClient('test-token')
      const files = await client.listFiles('ch1')

      expect(files).toHaveLength(1)
      expect(files[0].filename).toBe('file1.txt')
    })
  })

  describe('rate limiting', () => {
    test('waits when bucket is exhausted before making request', async () => {
      mockResponse({ id: '1', username: 'user1' }, 200, {
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Date.now() / 1000 + 0.1),
        'X-RateLimit-Bucket': 'user-bucket',
      })
      mockResponse({ id: '2', username: 'user2' }, 200, {
        'X-RateLimit-Remaining': '10',
        'X-RateLimit-Reset': String(Date.now() / 1000 + 60),
        'X-RateLimit-Bucket': 'user-bucket',
      })

      const client = new DiscordClient('test-token')
      await client.testAuth()

      const startTime = Date.now()
      await client.testAuth()
      const elapsed = Date.now() - startTime

      expect(elapsed).toBeGreaterThanOrEqual(50)
      expect(fetchCalls.length).toBe(2)
    })

    test('retries on 429 with Retry-After header', async () => {
      mockResponse({ message: 'Rate limited', retry_after: 0.1 }, 429, { 'Retry-After': '0.1' })
      mockResponse({ id: '123', username: 'user' })

      const client = new DiscordClient('test-token')
      const user = await client.testAuth()

      expect(user.id).toBe('123')
      expect(fetchCalls.length).toBe(2)
    })

    test('handles global rate limit', async () => {
      mockResponse({ message: 'Global rate limited', global: true }, 429, {
        'Retry-After': '0.1',
        'X-RateLimit-Global': 'true',
      })
      mockResponse({ id: '123', username: 'user' })

      const client = new DiscordClient('test-token')
      const user = await client.testAuth()

      expect(user.id).toBe('123')
      expect(fetchCalls.length).toBe(2)
    })

    test('throws after max retries exceeded', async () => {
      for (let i = 0; i <= 3; i++) {
        mockResponse({ message: 'Rate limited' }, 429, { 'Retry-After': '0.01' })
      }

      const client = new DiscordClient('test-token')
      await expect(client.testAuth()).rejects.toThrow(DiscordError)
      expect(fetchCalls.length).toBeLessThanOrEqual(4)
    })
  })

  describe('retry logic', () => {
    test('retries on 500 server error', async () => {
      mockResponse({ message: 'Internal Server Error' }, 500)
      mockResponse({ id: '123', username: 'user' })

      const client = new DiscordClient('test-token')
      const user = await client.testAuth()

      expect(user.id).toBe('123')
      expect(fetchCalls.length).toBe(2)
    })

    test('does not retry on 4xx client errors (except 429)', async () => {
      mockResponse({ message: 'Not Found' }, 404)

      const client = new DiscordClient('test-token')
      await expect(client.testAuth()).rejects.toThrow(DiscordError)
      expect(fetchCalls.length).toBe(1)
    })

    test('exponential backoff increases delay', async () => {
      mockResponse({ message: 'Error' }, 500)
      mockResponse({ message: 'Error' }, 500)
      mockResponse({ id: '123', username: 'user' })

      const client = new DiscordClient('test-token')
      const startTime = Date.now()
      await client.testAuth()
      const elapsed = Date.now() - startTime

      expect(elapsed).toBeGreaterThanOrEqual(150)
      expect(fetchCalls.length).toBe(3)
    })
  })

  describe('bucket key normalization', () => {
    test('normalizes channel IDs in routes', async () => {
      mockResponse([])
      mockResponse([])

      const client = new DiscordClient('test-token')
      await client.getMessages('123456789')
      await client.getMessages('987654321')

      expect(fetchCalls.length).toBe(2)
    })
  })
})
