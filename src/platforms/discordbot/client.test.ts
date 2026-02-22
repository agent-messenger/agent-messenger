import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { DiscordBotClient } from './client'
import { DiscordBotError } from './types'

describe('DiscordBotClient', () => {
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
      expect(() => new DiscordBotClient('')).toThrow(DiscordBotError)
      expect(() => new DiscordBotClient('')).toThrow('Token is required')
    })

    test('accepts valid token', () => {
      const client = new DiscordBotClient('bot-test-token')
      expect(client).toBeInstanceOf(DiscordBotClient)
    })
  })

  describe('testAuth', () => {
    test('returns current user and uses Bot auth header', async () => {
      mockResponse({
        id: '123456789',
        username: 'testbot',
        global_name: 'Test Bot',
        avatar: 'abc123',
      })

      const client = new DiscordBotClient('my-bot-token')
      const user = await client.testAuth()

      expect(user.id).toBe('123456789')
      expect(user.username).toBe('testbot')
      expect(fetchCalls.length).toBe(1)
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/users/@me')

      const headers = fetchCalls[0].options?.headers as Record<string, string>
      expect(headers.Authorization).toBe('Bot my-bot-token')
      expect(headers['User-Agent']).toContain('DiscordBot')
    })

    test('throws DiscordBotError on API error', async () => {
      mockResponse({ message: 'Unauthorized', code: 401 }, 401)

      const client = new DiscordBotClient('bad-token')
      await expect(client.testAuth()).rejects.toThrow(DiscordBotError)
    })
  })

  describe('listGuilds', () => {
    test('returns list of guilds', async () => {
      mockResponse([
        { id: '111', name: 'Guild One' },
        { id: '222', name: 'Guild Two' },
      ])

      const client = new DiscordBotClient('bot-token')
      const guilds = await client.listGuilds()

      expect(guilds).toHaveLength(2)
      expect(guilds[0].name).toBe('Guild One')
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/users/@me/guilds')
    })
  })

  describe('getGuild', () => {
    test('returns guild info', async () => {
      mockResponse({ id: '111', name: 'Test Guild' })

      const client = new DiscordBotClient('bot-token')
      const guild = await client.getGuild('111')

      expect(guild.id).toBe('111')
      expect(guild.name).toBe('Test Guild')
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/guilds/111')
    })
  })

  describe('listChannels', () => {
    test('returns channels for guild', async () => {
      mockResponse([
        { id: 'ch1', guild_id: '111', name: 'general', type: 0 },
        { id: 'ch2', guild_id: '111', name: 'random', type: 0 },
      ])

      const client = new DiscordBotClient('bot-token')
      const channels = await client.listChannels('111')

      expect(channels).toHaveLength(2)
      expect(channels[0].name).toBe('general')
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/guilds/111/channels')
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

      const client = new DiscordBotClient('bot-token')
      const message = await client.sendMessage('ch1', 'Hello world')

      expect(message.content).toBe('Hello world')
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/channels/ch1/messages')
      expect(fetchCalls[0].options?.method).toBe('POST')
      expect(fetchCalls[0].options?.body).toBe(JSON.stringify({ content: 'Hello world' }))
    })

    test('includes thread_id when provided', async () => {
      mockResponse({
        id: 'msg1',
        channel_id: 'ch1',
        author: { id: '123', username: 'bot' },
        content: 'Thread reply',
        timestamp: '2024-01-01T00:00:00.000Z',
      })

      const client = new DiscordBotClient('bot-token')
      await client.sendMessage('ch1', 'Thread reply', { thread_id: 'thread123' })

      expect(fetchCalls[0].options?.body).toBe(JSON.stringify({ content: 'Thread reply', thread_id: 'thread123' }))
    })
  })

  describe('editMessage', () => {
    test('edits message with PATCH', async () => {
      mockResponse({
        id: 'msg1',
        channel_id: 'ch1',
        author: { id: '123', username: 'bot' },
        content: 'Updated content',
        timestamp: '2024-01-01T00:00:00.000Z',
        edited_timestamp: '2024-01-01T00:01:00.000Z',
      })

      const client = new DiscordBotClient('bot-token')
      const message = await client.editMessage('ch1', 'msg1', 'Updated content')

      expect(message.content).toBe('Updated content')
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/channels/ch1/messages/msg1')
      expect(fetchCalls[0].options?.method).toBe('PATCH')
      expect(fetchCalls[0].options?.body).toBe(JSON.stringify({ content: 'Updated content' }))
    })
  })

  describe('deleteMessage', () => {
    test('deletes message and returns void', async () => {
      mockResponse(null, 204)

      const client = new DiscordBotClient('bot-token')
      const result = await client.deleteMessage('ch1', 'msg1')

      expect(result).toBeUndefined()
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/channels/ch1/messages/msg1')
      expect(fetchCalls[0].options?.method).toBe('DELETE')
    })
  })

  describe('addReaction', () => {
    test('adds reaction with encoded emoji', async () => {
      mockResponse(null, 204)

      const client = new DiscordBotClient('bot-token')
      await client.addReaction('ch1', 'msg1', '👍')

      expect(fetchCalls[0].url).toBe(
        'https://discord.com/api/v10/channels/ch1/messages/msg1/reactions/%F0%9F%91%8D/@me',
      )
      expect(fetchCalls[0].options?.method).toBe('PUT')
    })
  })

  describe('removeReaction', () => {
    test('removes reaction with DELETE', async () => {
      mockResponse(null, 204)

      const client = new DiscordBotClient('bot-token')
      await client.removeReaction('ch1', 'msg1', '👍')

      expect(fetchCalls[0].url).toBe(
        'https://discord.com/api/v10/channels/ch1/messages/msg1/reactions/%F0%9F%91%8D/@me',
      )
      expect(fetchCalls[0].options?.method).toBe('DELETE')
    })
  })

  describe('listUsers', () => {
    test('maps guild members to users', async () => {
      mockResponse([{ user: { id: 'u1', username: 'user1' } }, { user: { id: 'u2', username: 'user2' } }])

      const client = new DiscordBotClient('bot-token')
      const users = await client.listUsers('111')

      expect(users).toHaveLength(2)
      expect(users[0].username).toBe('user1')
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/guilds/111/members?limit=1000')
    })
  })

  describe('getUser', () => {
    test('returns user info', async () => {
      mockResponse({ id: 'u1', username: 'testuser' })

      const client = new DiscordBotClient('bot-token')
      const user = await client.getUser('u1')

      expect(user.id).toBe('u1')
      expect(user.username).toBe('testuser')
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/users/u1')
    })
  })

  describe('uploadFile', () => {
    test('uploads file to channel', async () => {
      const { tmpdir } = await import('node:os')
      const { join } = await import('node:path')
      const tempFile = join(tmpdir(), 'test-discordbot-upload.txt')
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
            filename: 'test-discordbot-upload.txt',
            size: 12,
            url: 'https://cdn.discord.com/attachments/ch1/att1/test-discordbot-upload.txt',
          },
        ],
      })

      const client = new DiscordBotClient('bot-token')
      const file = await client.uploadFile('ch1', tempFile)

      expect(file.filename).toBe('test-discordbot-upload.txt')
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/channels/ch1/messages')
      expect(fetchCalls[0].options?.method).toBe('POST')

      const headers = fetchCalls[0].options?.headers as Record<string, string>
      expect(headers.Authorization).toBe('Bot bot-token')
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

      const client = new DiscordBotClient('bot-token')
      const files = await client.listFiles('ch1')

      expect(files).toHaveLength(1)
      expect(files[0].filename).toBe('file1.txt')
    })
  })

  describe('createThread', () => {
    test('creates thread in channel', async () => {
      mockResponse({
        id: 'thread1',
        guild_id: '111',
        name: 'My Thread',
        type: 11,
      })

      const client = new DiscordBotClient('bot-token')
      const thread = await client.createThread('ch1', 'My Thread', { auto_archive_duration: 1440 })

      expect(thread.id).toBe('thread1')
      expect(thread.name).toBe('My Thread')
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/channels/ch1/threads')
      expect(fetchCalls[0].options?.method).toBe('POST')
      expect(fetchCalls[0].options?.body).toBe(JSON.stringify({ name: 'My Thread', auto_archive_duration: 1440 }))
    })
  })

  describe('archiveThread', () => {
    test('archives thread with PATCH', async () => {
      mockResponse({
        id: 'thread1',
        guild_id: '111',
        name: 'My Thread',
        type: 11,
        thread_metadata: { archived: true },
      })

      const client = new DiscordBotClient('bot-token')
      await client.archiveThread('thread1')

      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/channels/thread1')
      expect(fetchCalls[0].options?.method).toBe('PATCH')
      expect(fetchCalls[0].options?.body).toBe(JSON.stringify({ archived: true }))
    })
  })

  describe('resolveChannel', () => {
    test('returns channel ID directly if all digits', async () => {
      const client = new DiscordBotClient('bot-token')
      const id = await client.resolveChannel('111', '123456789')

      expect(id).toBe('123456789')
      expect(fetchCalls.length).toBe(0)
    })

    test('looks up channel by name', async () => {
      mockResponse([
        { id: 'ch1', guild_id: '111', name: 'general', type: 0 },
        { id: 'ch2', guild_id: '111', name: 'random', type: 0 },
      ])

      const client = new DiscordBotClient('bot-token')
      const id = await client.resolveChannel('111', 'random')

      expect(id).toBe('ch2')
    })

    test('strips # prefix when looking up by name', async () => {
      mockResponse([{ id: 'ch1', guild_id: '111', name: 'general', type: 0 }])

      const client = new DiscordBotClient('bot-token')
      const id = await client.resolveChannel('111', '#general')

      expect(id).toBe('ch1')
    })

    test('throws when channel name not found', async () => {
      mockResponse([{ id: 'ch1', guild_id: '111', name: 'general', type: 0 }])

      const client = new DiscordBotClient('bot-token')
      try {
        await client.resolveChannel('111', 'nonexistent')
        expect.unreachable('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(DiscordBotError)
        expect((error as DiscordBotError).message).toContain('Channel not found')
        expect((error as DiscordBotError).code).toBe('channel_not_found')
      }
    })
  })

  describe('rate limiting', () => {
    test('waits when bucket is exhausted', async () => {
      mockResponse({ id: '1', username: 'bot' }, 200, {
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Date.now() / 1000 + 0.1),
        'X-RateLimit-Bucket': 'user-bucket',
      })
      mockResponse({ id: '2', username: 'bot2' }, 200, {
        'X-RateLimit-Remaining': '10',
        'X-RateLimit-Reset': String(Date.now() / 1000 + 60),
        'X-RateLimit-Bucket': 'user-bucket',
      })

      const client = new DiscordBotClient('bot-token')
      await client.testAuth()

      const startTime = Date.now()
      await client.testAuth()
      const elapsed = Date.now() - startTime

      expect(elapsed).toBeGreaterThanOrEqual(50)
      expect(fetchCalls.length).toBe(2)
    })

    test('retries on 429 with Retry-After header', async () => {
      mockResponse({ message: 'Rate limited', retry_after: 0.1 }, 429, { 'Retry-After': '0.1' })
      mockResponse({ id: '123', username: 'bot' })

      const client = new DiscordBotClient('bot-token')
      const user = await client.testAuth()

      expect(user.id).toBe('123')
      expect(fetchCalls.length).toBe(2)
    })

    test('handles global rate limit', async () => {
      mockResponse({ message: 'Global rate limited', global: true }, 429, {
        'Retry-After': '0.1',
        'X-RateLimit-Global': 'true',
      })
      mockResponse({ id: '123', username: 'bot' })

      const client = new DiscordBotClient('bot-token')
      const user = await client.testAuth()

      expect(user.id).toBe('123')
      expect(fetchCalls.length).toBe(2)
    })

    test('throws after max retries exceeded', async () => {
      for (let i = 0; i <= 3; i++) {
        mockResponse({ message: 'Rate limited' }, 429, { 'Retry-After': '0.01' })
      }

      const client = new DiscordBotClient('bot-token')
      await expect(client.testAuth()).rejects.toThrow(DiscordBotError)
      expect(fetchCalls.length).toBeLessThanOrEqual(4)
    })
  })

  describe('retry logic', () => {
    test('retries on 500 server error', async () => {
      mockResponse({ message: 'Internal Server Error' }, 500)
      mockResponse({ id: '123', username: 'bot' })

      const client = new DiscordBotClient('bot-token')
      const user = await client.testAuth()

      expect(user.id).toBe('123')
      expect(fetchCalls.length).toBe(2)
    })

    test('does not retry on 4xx client errors (except 429)', async () => {
      mockResponse({ message: 'Not Found' }, 404)

      const client = new DiscordBotClient('bot-token')
      await expect(client.testAuth()).rejects.toThrow(DiscordBotError)
      expect(fetchCalls.length).toBe(1)
    })

    test('exponential backoff increases delay', async () => {
      mockResponse({ message: 'Error' }, 500)
      mockResponse({ message: 'Error' }, 500)
      mockResponse({ id: '123', username: 'bot' })

      const client = new DiscordBotClient('bot-token')
      const startTime = Date.now()
      await client.testAuth()
      const elapsed = Date.now() - startTime

      expect(elapsed).toBeGreaterThanOrEqual(150)
      expect(fetchCalls.length).toBe(3)
    })
  })
})
