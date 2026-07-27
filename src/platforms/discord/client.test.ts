import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'

import { DiscordClient, DiscordError } from './client'
import type { DiscordReadState } from './types'

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
    it('requires token', async () => {
      await expect(new DiscordClient().login({ token: '' })).rejects.toThrow(DiscordError)
      await expect(new DiscordClient().login({ token: '' })).rejects.toThrow('Token is required')
    })

    it('accepts valid token', async () => {
      const client = await new DiscordClient().login({ token: 'test-token' })
      expect(client).toBeInstanceOf(DiscordClient)
    })
  })

  describe('testAuth', () => {
    it('returns current user info', async () => {
      mockResponse({
        id: '123456789',
        username: 'testuser',
        global_name: 'Test User',
        avatar: 'abc123',
      })

      const client = await new DiscordClient().login({ token: 'test-token' })
      const user = await client.testAuth()

      expect(user.id).toBe('123456789')
      expect(user.username).toBe('testuser')
      expect(fetchCalls.length).toBe(1)
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/users/@me')
      expect(fetchCalls[0].options?.headers).toMatchObject({
        Authorization: 'test-token',
      })
    })

    it('throws DiscordError on API error', async () => {
      mockResponse({ message: 'Unauthorized', code: 401 }, 401)

      const client = await new DiscordClient().login({ token: 'bad-token' })
      await expect(client.testAuth()).rejects.toThrow(DiscordError)
    })
  })

  describe('listServers', () => {
    it('returns list of servers', async () => {
      mockResponse([
        { id: '111', name: 'Server One' },
        { id: '222', name: 'Server Two' },
      ])

      const client = await new DiscordClient().login({ token: 'test-token' })
      const servers = await client.listServers()

      expect(servers).toHaveLength(2)
      expect(servers[0].name).toBe('Server One')
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/users/@me/guilds')
    })
  })

  describe('getServer', () => {
    it('returns server info', async () => {
      mockResponse({ id: '111', name: 'Test Server' })

      const client = await new DiscordClient().login({ token: 'test-token' })
      const server = await client.getServer('111')

      expect(server.id).toBe('111')
      expect(server.name).toBe('Test Server')
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/guilds/111')
    })
  })

  describe('listChannels', () => {
    it('returns list of channels for server', async () => {
      mockResponse([
        { id: 'ch1', guild_id: '111', name: 'general', type: 0 },
        { id: 'ch2', guild_id: '111', name: 'random', type: 0 },
      ])

      const client = await new DiscordClient().login({ token: 'test-token' })
      const channels = await client.listChannels('111')

      expect(channels).toHaveLength(2)
      expect(channels[0].name).toBe('general')
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/guilds/111/channels')
    })
  })

  describe('getChannel', () => {
    it('returns channel info', async () => {
      mockResponse({ id: 'ch1', guild_id: '111', name: 'general', type: 0 })

      const client = await new DiscordClient().login({ token: 'test-token' })
      const channel = await client.getChannel('ch1')

      expect(channel.id).toBe('ch1')
      expect(channel.name).toBe('general')
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/channels/ch1')
    })
  })

  describe('sendMessage', () => {
    it('sends message to channel', async () => {
      mockResponse({
        id: 'msg1',
        channel_id: 'ch1',
        author: { id: '123', username: 'bot' },
        content: 'Hello world',
        timestamp: '2024-01-01T00:00:00.000Z',
      })

      const client = await new DiscordClient().login({ token: 'test-token' })
      const message = await client.sendMessage('ch1', 'Hello world')

      expect(message.content).toBe('Hello world')
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/channels/ch1/messages')
      expect(fetchCalls[0].options?.method).toBe('POST')
      expect(fetchCalls[0].options?.body).toBe(JSON.stringify({ content: 'Hello world' }))
    })

    it('includes message_reference when reply_to is provided', async () => {
      mockResponse({
        id: 'msg1',
        channel_id: 'ch1',
        author: { id: '123', username: 'bot' },
        content: 'Reply text',
        timestamp: '2024-01-01T00:00:00.000Z',
      })

      const client = await new DiscordClient().login({ token: 'test-token' })
      await client.sendMessage('ch1', 'Reply text', { reply_to: 'parent123' })

      expect(fetchCalls[0].options?.body).toBe(
        JSON.stringify({ content: 'Reply text', message_reference: { message_id: 'parent123' } }),
      )
    })

    it('omits message_reference when reply_to is not provided', async () => {
      mockResponse({
        id: 'msg1',
        channel_id: 'ch1',
        author: { id: '123', username: 'bot' },
        content: 'Hello world',
        timestamp: '2024-01-01T00:00:00.000Z',
      })

      const client = await new DiscordClient().login({ token: 'test-token' })
      await client.sendMessage('ch1', 'Hello world')

      expect(fetchCalls[0].options?.body).toBe(JSON.stringify({ content: 'Hello world' }))
    })
  })

  describe('getMessages', () => {
    it('returns messages from channel', async () => {
      mockResponse([
        {
          id: 'msg1',
          channel_id: 'ch1',
          author: { id: '123', username: 'user1' },
          content: 'Message 1',
          timestamp: '2024-01-01T00:00:00.000Z',
        },
      ])

      const client = await new DiscordClient().login({ token: 'test-token' })
      const messages = await client.getMessages('ch1', 50)

      expect(messages).toHaveLength(1)
      expect(messages[0].content).toBe('Message 1')
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/channels/ch1/messages?limit=50')
    })

    it('uses default limit of 50', async () => {
      mockResponse([])

      const client = await new DiscordClient().login({ token: 'test-token' })
      await client.getMessages('ch1')

      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/channels/ch1/messages?limit=50')
    })

    it('gets messages around a specific message', async () => {
      mockResponse([])

      const client = await new DiscordClient().login({ token: 'test-token' })
      await client.getMessages('ch1', 1, { around: 'msg/1' })

      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/channels/ch1/messages?around=msg%2F1&limit=1')
    })
  })

  describe('getMessage', () => {
    it('returns single message', async () => {
      mockResponse([
        {
          id: 'msg1',
          channel_id: 'ch1',
          author: { id: '123', username: 'user1' },
          content: 'Message 1',
          timestamp: '2024-01-01T00:00:00.000Z',
        },
      ])

      const client = await new DiscordClient().login({ token: 'test-token' })
      const message = await client.getMessage('ch1', 'msg1')

      expect(message.id).toBe('msg1')
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/channels/ch1/messages?around=msg1&limit=1')
    })

    it('throws when the requested message is not returned', async () => {
      mockResponse([
        {
          id: 'neighbor',
          channel_id: 'ch1',
          author: { id: '123', username: 'user1' },
          content: 'Nearby message',
          timestamp: '2024-01-01T00:00:00.000Z',
        },
      ])

      const client = await new DiscordClient().login({ token: 'test-token' })

      await expect(client.getMessage('ch1', 'missing')).rejects.toEqual(new DiscordError('Message not found', '10008'))
    })
  })

  describe('editMessage', () => {
    it('edits message with PATCH', async () => {
      mockResponse({
        id: 'msg1',
        channel_id: 'ch1',
        author: { id: '123', username: 'bot' },
        content: 'Updated content',
        timestamp: '2024-01-01T00:00:00.000Z',
        edited_timestamp: '2024-01-01T00:05:00.000Z',
      })

      const client = await new DiscordClient().login({ token: 'test-token' })
      const message = await client.editMessage('ch1', 'msg1', 'Updated content')

      expect(message.content).toBe('Updated content')
      expect(message.edited_timestamp).toBe('2024-01-01T00:05:00.000Z')
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/channels/ch1/messages/msg1')
      expect(fetchCalls[0].options?.method).toBe('PATCH')
      expect(fetchCalls[0].options?.body).toBe(JSON.stringify({ content: 'Updated content' }))
    })
  })

  describe('deleteMessage', () => {
    it('deletes message', async () => {
      mockResponse(null, 204)

      const client = await new DiscordClient().login({ token: 'test-token' })
      await client.deleteMessage('ch1', 'msg1')

      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/channels/ch1/messages/msg1')
      expect(fetchCalls[0].options?.method).toBe('DELETE')
    })
  })

  describe('addReaction', () => {
    it('adds reaction to message', async () => {
      mockResponse(null, 204)

      const client = await new DiscordClient().login({ token: 'test-token' })
      await client.addReaction('ch1', 'msg1', '👍')

      expect(fetchCalls[0].url).toBe(
        'https://discord.com/api/v10/channels/ch1/messages/msg1/reactions/%F0%9F%91%8D/@me',
      )
      expect(fetchCalls[0].options?.method).toBe('PUT')
    })
  })

  describe('removeReaction', () => {
    it('removes reaction from message', async () => {
      mockResponse(null, 204)

      const client = await new DiscordClient().login({ token: 'test-token' })
      await client.removeReaction('ch1', 'msg1', '👍')

      expect(fetchCalls[0].url).toBe(
        'https://discord.com/api/v10/channels/ch1/messages/msg1/reactions/%F0%9F%91%8D/@me',
      )
      expect(fetchCalls[0].options?.method).toBe('DELETE')
    })
  })

  describe('listUsers', () => {
    it('returns list of server members', async () => {
      mockResponse([{ user: { id: 'u1', username: 'user1' } }, { user: { id: 'u2', username: 'user2' } }])

      const client = await new DiscordClient().login({ token: 'test-token' })
      const users = await client.listUsers('111')

      expect(users).toHaveLength(2)
      expect(users[0].username).toBe('user1')
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/guilds/111/members?limit=1000')
    })
  })

  describe('getUser', () => {
    it('returns user info', async () => {
      mockResponse({ id: 'u1', username: 'testuser' })

      const client = await new DiscordClient().login({ token: 'test-token' })
      const user = await client.getUser('u1')

      expect(user.id).toBe('u1')
      expect(user.username).toBe('testuser')
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/users/u1')
    })
  })

  describe('getMyGuildMember', () => {
    const member = {
      user: { id: 'user-1', username: 'alice' },
      roles: ['role-1'],
      joined_at: '2024-01-15T10:00:00Z',
      deaf: false,
      mute: false,
      flags: 0,
    }

    it('gets the current user guild member', async () => {
      mockResponse(member)

      const client = await new DiscordClient().login({ token: 'test-token' })
      const result = await client.getMyGuildMember('guild-1')

      expect(result).toEqual(member)
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/users/@me/guilds/guild-1/member')
    })

    it('falls back to the client-facing route on missing access', async () => {
      mockResponse({ message: 'Missing Access', code: 50001 }, 403)
      mockResponse(member)

      const client = await new DiscordClient().login({ token: 'test-token' })
      const result = await client.getMyGuildMember('guild-1')

      expect(result).toEqual(member)
      expect(fetchCalls).toHaveLength(2)
      expect(fetchCalls[1].url).toBe('https://discord.com/api/v10/guilds/guild-1/members/@me')
    })

    it('falls back when the missing scope is reported as 401', async () => {
      mockResponse({ message: '401: Unauthorized', code: 0 }, 401)
      mockResponse(member)

      const client = await new DiscordClient().login({ token: 'test-token' })
      const result = await client.getMyGuildMember('guild-1')

      expect(result).toEqual(member)
      expect(fetchCalls).toHaveLength(2)
      expect(fetchCalls[1].url).toBe('https://discord.com/api/v10/guilds/guild-1/members/@me')
    })

    it('surfaces the fallback error when both routes are unauthorized', async () => {
      mockResponse({ message: '401: Unauthorized', code: 0 }, 401)
      mockResponse({ message: '401: Unauthorized', code: 0 }, 401)

      const client = await new DiscordClient().login({ token: 'test-token' })

      await expect(client.getMyGuildMember('guild-1')).rejects.toEqual(new DiscordError('401: Unauthorized', '0'))
      expect(fetchCalls).toHaveLength(2)
    })

    it('propagates non-403 errors without falling back', async () => {
      mockResponse({ message: 'Unknown Guild', code: 10004 }, 404)

      const client = await new DiscordClient().login({ token: 'test-token' })

      await expect(client.getMyGuildMember('guild-1')).rejects.toEqual(new DiscordError('Unknown Guild', '10004'))
      expect(fetchCalls).toHaveLength(1)
    })
  })

  describe('listRoles', () => {
    it('lists guild role definitions', async () => {
      mockResponse([
        {
          id: 'role-1',
          name: 'Member',
          color: 0,
          hoist: false,
          position: 1,
          permissions: '1024',
          managed: false,
          mentionable: false,
        },
      ])

      const client = await new DiscordClient().login({ token: 'test-token' })
      const roles = await client.listRoles('guild-1')

      expect(roles).toHaveLength(1)
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/guilds/guild-1/roles')
    })
  })

  describe('uploadFile', () => {
    it('uploads file to channel', async () => {
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

      const client = await new DiscordClient().login({ token: 'test-token' })
      const file = await client.uploadFile('ch1', tempFile)

      expect(file.filename).toBe('test-upload.txt')
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/channels/ch1/messages')
      expect(fetchCalls[0].options?.method).toBe('POST')
    })

    it('includes payload_json with message_reference when reply_to is provided', async () => {
      const tempFile = '/tmp/test-upload-reply.txt'
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
            filename: 'test-upload-reply.txt',
            size: 12,
            url: 'https://cdn.discord.com/attachments/ch1/att1/test-upload-reply.txt',
          },
        ],
      })

      const client = await new DiscordClient().login({ token: 'test-token' })
      await client.uploadFile('ch1', tempFile, { reply_to: 'parent123' })

      const formData = fetchCalls[0].options?.body as FormData
      expect(formData.get('payload_json')).toBe(JSON.stringify({ message_reference: { message_id: 'parent123' } }))
    })

    it('omits payload_json when reply_to is not provided', async () => {
      const tempFile = '/tmp/test-upload-no-reply.txt'
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
            filename: 'test-upload-no-reply.txt',
            size: 12,
            url: 'https://cdn.discord.com/attachments/ch1/att1/test-upload-no-reply.txt',
          },
        ],
      })

      const client = await new DiscordClient().login({ token: 'test-token' })
      await client.uploadFile('ch1', tempFile)

      const formData = fetchCalls[0].options?.body as FormData
      expect(formData.get('payload_json')).toBeNull()
    })
  })

  describe('listFiles', () => {
    it('returns files from recent messages', async () => {
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

      const client = await new DiscordClient().login({ token: 'test-token' })
      const files = await client.listFiles('ch1')

      expect(files).toHaveLength(1)
      expect(files[0].filename).toBe('file1.txt')
    })
  })

  describe('searchMessages', () => {
    const searchResult = {
      id: 'msg1',
      channel_id: 'ch1',
      guild_id: 'guild1',
      author: { id: 'user1', username: 'user1' },
      content: 'matching message',
      timestamp: '2026-01-01T00:00:00.000Z',
      hit: true,
    }

    it('flattens grouped search results and keeps hits', async () => {
      mockResponse({
        doing_deep_historical_index: false,
        total_results: 1,
        messages: [[searchResult, { ...searchResult, id: 'context', hit: false }]],
      })

      const client = await new DiscordClient().login({ token: 'test-token' })
      const result = await client.searchMessages('guild1', 'matching', { limit: 25 })

      expect(result).toEqual({ results: [searchResult], total: 1 })
      expect(fetchCalls[0].url).toBe(
        'https://discord.com/api/v10/guilds/guild1/messages/search?content=matching&limit=25',
      )
    })

    it('retries when the search index is not ready', async () => {
      mockResponse(
        {
          message: 'Index not yet available. Try again later',
          code: 110000,
          documents_indexed: 0,
          retry_after: 0,
        },
        202,
      )
      mockResponse({
        doing_deep_historical_index: false,
        total_results: 1,
        messages: [[searchResult]],
      })

      const client = await new DiscordClient().login({ token: 'test-token' })
      const startTime = Date.now()
      const result = await client.searchMessages('guild1', 'matching')
      const elapsed = Date.now() - startTime

      expect(result).toEqual({ results: [searchResult], total: 1 })
      expect(elapsed).toBeGreaterThanOrEqual(50)
      expect(fetchCalls).toHaveLength(2)
    })

    it('throws a clear error when the search index remains unavailable', async () => {
      for (let attempt = 0; attempt < 4; attempt++) {
        mockResponse(
          {
            message: 'Index not yet available. Try again later',
            code: 110000,
            documents_indexed: 0,
            retry_after: 0.001,
          },
          202,
        )
      }

      const client = await new DiscordClient().login({ token: 'test-token' })

      await expect(client.searchMessages('guild1', 'matching')).rejects.toThrow(
        'Search index is not ready after retries',
      )
      expect(fetchCalls).toHaveLength(4)
    })

    it('rejects unexpected successful response payloads', async () => {
      mockResponse(
        {
          message: 'Unexpected response',
          code: 999999,
          retry_after: 0,
        },
        202,
      )

      const client = await new DiscordClient().login({ token: 'test-token' })

      try {
        await client.searchMessages('guild1', 'matching')
        throw new Error('Expected searchMessages to throw')
      } catch (error) {
        expect(error).toBeInstanceOf(DiscordError)
        if (!(error instanceof DiscordError)) throw error
        expect(error.code).toBe('invalid_search_response')
      }
      expect(fetchCalls).toHaveLength(1)
    })

    it('rejects malformed message and retry payloads', async () => {
      mockResponse({ total_results: 1, messages: null })
      mockResponse(
        {
          message: 'Index not yet available. Try again later',
          code: 110000,
          documents_indexed: 0,
          retry_after: -1,
        },
        202,
      )

      const client = await new DiscordClient().login({ token: 'test-token' })

      await expect(client.searchMessages('guild1', 'matching')).rejects.toThrow(
        'Discord returned an invalid search response',
      )
      await expect(client.searchMessages('guild1', 'matching')).rejects.toThrow(
        'Discord returned an invalid search response',
      )
      expect(fetchCalls).toHaveLength(2)
    })
  })

  describe('rate limiting', () => {
    it('waits when bucket is exhausted before making request', async () => {
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

      const client = await new DiscordClient().login({ token: 'test-token' })
      await client.testAuth()

      const startTime = Date.now()
      await client.testAuth()
      const elapsed = Date.now() - startTime

      expect(elapsed).toBeGreaterThanOrEqual(50)
      expect(fetchCalls.length).toBe(2)
    })

    it('retries on 429 with Retry-After header', async () => {
      mockResponse({ message: 'Rate limited', retry_after: 0.1 }, 429, { 'Retry-After': '0.1' })
      mockResponse({ id: '123', username: 'user' })

      const client = await new DiscordClient().login({ token: 'test-token' })
      const user = await client.testAuth()

      expect(user.id).toBe('123')
      expect(fetchCalls.length).toBe(2)
    })

    it('handles global rate limit', async () => {
      mockResponse({ message: 'Global rate limited', global: true }, 429, {
        'Retry-After': '0.1',
        'X-RateLimit-Global': 'true',
      })
      mockResponse({ id: '123', username: 'user' })

      const client = await new DiscordClient().login({ token: 'test-token' })
      const user = await client.testAuth()

      expect(user.id).toBe('123')
      expect(fetchCalls.length).toBe(2)
    })

    it('throws after max retries exceeded', async () => {
      for (let i = 0; i <= 3; i++) {
        mockResponse({ message: 'Rate limited' }, 429, { 'Retry-After': '0.01' })
      }

      const client = await new DiscordClient().login({ token: 'test-token' })
      await expect(client.testAuth()).rejects.toThrow(DiscordError)
      expect(fetchCalls.length).toBeLessThanOrEqual(4)
    })
  })

  describe('retry logic', () => {
    it('retries on 500 server error', async () => {
      mockResponse({ message: 'Internal Server Error' }, 500)
      mockResponse({ id: '123', username: 'user' })

      const client = await new DiscordClient().login({ token: 'test-token' })
      const user = await client.testAuth()

      expect(user.id).toBe('123')
      expect(fetchCalls.length).toBe(2)
    })

    it('does not retry on 4xx client errors (except 429)', async () => {
      mockResponse({ message: 'Not Found' }, 404)

      const client = await new DiscordClient().login({ token: 'test-token' })
      await expect(client.testAuth()).rejects.toThrow(DiscordError)
      expect(fetchCalls.length).toBe(1)
    })

    it('exponential backoff increases delay', async () => {
      mockResponse({ message: 'Error' }, 500)
      mockResponse({ message: 'Error' }, 500)
      mockResponse({ id: '123', username: 'user' })

      const client = await new DiscordClient().login({ token: 'test-token' })
      const startTime = Date.now()
      await client.testAuth()
      const elapsed = Date.now() - startTime

      expect(elapsed).toBeGreaterThanOrEqual(150)
      expect(fetchCalls.length).toBe(3)
    })
  })

  describe('bucket key normalization', () => {
    it('normalizes channel IDs in routes', async () => {
      mockResponse([])
      mockResponse([])

      const client = await new DiscordClient().login({ token: 'test-token' })
      await client.getMessages('123456789')
      await client.getMessages('987654321')

      expect(fetchCalls.length).toBe(2)
    })

    it('normalizes query strings for the same channel route', async () => {
      mockResponse([], 200, {
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Date.now() / 1000 + 0.1),
        'X-RateLimit-Bucket': 'messages-bucket',
      })
      mockResponse([])

      const client = await new DiscordClient().login({ token: 'test-token' })
      await client.getMessages('123456789', 1, { around: 'message-1' })

      const startTime = Date.now()
      await client.getMessages('123456789', 1, { around: 'message-2' })
      const elapsed = Date.now() - startTime

      expect(elapsed).toBeGreaterThanOrEqual(50)
      expect(fetchCalls.length).toBe(2)
    })
  })

  describe('getUnreadMentions', () => {
    const mention = (id: string, channelId: string, guildId?: string) => ({
      id,
      channel_id: channelId,
      author: { id: 'a1', username: 'alice' },
      content: `mention ${id}`,
      timestamp: '2024-01-29T10:00:00Z',
      mention_everyone: false,
      mentions: [{ id: 'me', username: 'me' }],
      ...(guildId ? { guild_id: guildId } : {}),
    })

    const stubReadState = (client: DiscordClient, readState: DiscordReadState[]) =>
      spyOn(client, 'fetchReadState').mockResolvedValue(readState)

    it('keeps mentions newer than the channel read marker', async () => {
      // given: one channel with an unread mention (200 > marker 100) and one already read (50 < 100)
      const client = await new DiscordClient().login({ token: 'test-token' })
      stubReadState(client, [{ channelId: 'c1', lastMessageId: '100', mentionCount: 1 }])
      mockResponse([mention('200', 'c1'), mention('50', 'c1')])

      const result = await client.getUnreadMentions()

      // then: only the newer message is unread
      expect(result.count).toBe(1)
      expect(result.mentions[0].id).toBe('200')
      expect(result.mentions[0].mention_count).toBe(1)
    })

    it('treats an equal snowflake as read', async () => {
      const client = await new DiscordClient().login({ token: 'test-token' })
      stubReadState(client, [{ channelId: 'c1', lastMessageId: '100', mentionCount: 1 }])
      mockResponse([mention('100', 'c1')])

      const result = await client.getUnreadMentions()

      expect(result.count).toBe(0)
    })

    it('omits mentions for channels with no read-state entry', async () => {
      const client = await new DiscordClient().login({ token: 'test-token' })
      stubReadState(client, [])
      mockResponse([mention('200', 'c1')])

      const result = await client.getUnreadMentions()

      expect(result.count).toBe(0)
    })

    it('omits channels whose mention_count is zero', async () => {
      const client = await new DiscordClient().login({ token: 'test-token' })
      stubReadState(client, [{ channelId: 'c1', lastMessageId: '100', mentionCount: 0 }])
      mockResponse([mention('200', 'c1')])

      const result = await client.getUnreadMentions()

      expect(result.count).toBe(0)
    })

    it('includes all mentions when the read marker is null', async () => {
      const client = await new DiscordClient().login({ token: 'test-token' })
      stubReadState(client, [{ channelId: 'c1', lastMessageId: null, mentionCount: 2 }])
      mockResponse([mention('200', 'c1'), mention('50', 'c1')])

      const result = await client.getUnreadMentions()

      expect(result.count).toBe(2)
    })

    it('reports badgeCount from summed read-state mention counts', async () => {
      const client = await new DiscordClient().login({ token: 'test-token' })
      stubReadState(client, [
        { channelId: 'c1', lastMessageId: '100', mentionCount: 2 },
        { channelId: 'c2', lastMessageId: '100', mentionCount: 3 },
      ])
      mockResponse([mention('200', 'c1')])

      const result = await client.getUnreadMentions()

      expect(result.badgeCount).toBe(5)
      expect(result.count).toBe(1)
    })

    it('paginates mention history with a before cursor', async () => {
      const client = await new DiscordClient().login({ token: 'test-token' })
      stubReadState(client, [{ channelId: 'c1', lastMessageId: '0', mentionCount: 200 }])

      const firstPage = Array.from({ length: 100 }, (_, i) => mention(String(1000 - i), 'c1'))
      const secondPage = [mention('900', 'c1')]
      mockResponse(firstPage)
      mockResponse(secondPage)

      const result = await client.getUnreadMentions()

      expect(fetchCalls.length).toBe(2)
      expect(fetchCalls[1].url).toContain('before=901')
      expect(result.count).toBe(101)
    })

    it('deduplicates mentions repeated across pages', async () => {
      const client = await new DiscordClient().login({ token: 'test-token' })
      stubReadState(client, [{ channelId: 'c1', lastMessageId: '0', mentionCount: 100 }])

      const page = Array.from({ length: 100 }, (_, i) => mention(String(1000 - i), 'c1'))
      const overlap = [mention('901', 'c1'), mention('800', 'c1')]
      mockResponse(page)
      mockResponse(overlap)

      const result = await client.getUnreadMentions()

      const ids = result.mentions.map((m) => m.id)
      expect(new Set(ids).size).toBe(ids.length)
    })

    it('caps the scan at limit 1 with a single bounded request', async () => {
      const client = await new DiscordClient().login({ token: 'test-token' })
      stubReadState(client, [{ channelId: 'c1', lastMessageId: '0', mentionCount: 5 }])
      mockResponse([mention('1000', 'c1')])

      const result = await client.getUnreadMentions({ limit: 1 })

      // then: exactly one page requested, capped to the limit, incomplete scan
      expect(fetchCalls.length).toBe(1)
      expect(fetchCalls[0].url).toContain('limit=1')
      expect(result.count).toBe(1)
      expect(result.complete).toBe(false)
    })

    it('caps the scan at a custom limit that spans multiple pages', async () => {
      const client = await new DiscordClient().login({ token: 'test-token' })
      stubReadState(client, [{ channelId: 'c1', lastMessageId: '0', mentionCount: 200 }])

      const firstPage = Array.from({ length: 100 }, (_, i) => mention(String(1000 - i), 'c1'))
      const secondPage = Array.from({ length: 50 }, (_, i) => mention(String(900 - i), 'c1'))
      mockResponse(firstPage)
      mockResponse(secondPage)

      const result = await client.getUnreadMentions({ limit: 150 })

      // then: second page bounded to remaining 50, scan stops at the cap and is incomplete
      expect(fetchCalls.length).toBe(2)
      expect(fetchCalls[1].url).toContain('limit=50')
      expect(result.count).toBe(150)
      expect(result.complete).toBe(false)
    })

    it('marks the scan complete when a short page ends history', async () => {
      const client = await new DiscordClient().login({ token: 'test-token' })
      stubReadState(client, [{ channelId: 'c1', lastMessageId: '0', mentionCount: 3 }])
      mockResponse([mention('1000', 'c1'), mention('999', 'c1')])

      const result = await client.getUnreadMentions()

      expect(result.complete).toBe(true)
      expect(result.count).toBe(2)
    })

    it('stops and reports incomplete when the cursor fails to advance', async () => {
      const client = await new DiscordClient().login({ token: 'test-token' })
      stubReadState(client, [{ channelId: 'c1', lastMessageId: '0', mentionCount: 200 }])

      const fullPage = Array.from({ length: 100 }, (_, i) => mention(String(1000 - i), 'c1'))
      const repeatedPage = Array.from({ length: 100 }, (_, i) => mention(String(1000 - i), 'c1'))
      mockResponse(fullPage)
      mockResponse(repeatedPage)

      const result = await client.getUnreadMentions()

      // then: the repeated page adds nothing new, so the guard stops the scan as incomplete
      expect(result.complete).toBe(false)
      expect(result.count).toBe(100)
    })
  })
})
