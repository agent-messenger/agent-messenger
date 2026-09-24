import { afterEach, beforeEach, describe, expect, it } from 'bun:test'

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

  const messagePage = (startIndex: number, count: number) =>
    Array.from({ length: count }, (_, offset) => {
      const index = startIndex + offset
      return {
        id: `msg${index}`,
        channel_id: 'ch1',
        author: { id: '123', username: 'user1' },
        content: '',
        timestamp: '2024-01-01T00:00:00.000Z',
        attachments: [
          { id: `att${index}`, filename: `file${index}.txt`, size: 10, url: `https://example.com/file${index}.txt` },
        ],
      }
    })

  describe('constructor', () => {
    it('requires token', async () => {
      await expect(new DiscordBotClient().login({ token: '' })).rejects.toThrow(DiscordBotError)
      await expect(new DiscordBotClient().login({ token: '' })).rejects.toThrow('Token is required')
    })

    it('accepts valid token', async () => {
      const client = await new DiscordBotClient().login({ token: 'bot-test-token' })
      expect(client).toBeInstanceOf(DiscordBotClient)
    })
  })

  describe('testAuth', () => {
    it('returns current user and uses Bot auth header', async () => {
      mockResponse({
        id: '123456789',
        username: 'testbot',
        global_name: 'Test Bot',
        avatar: 'abc123',
      })

      const client = await new DiscordBotClient().login({ token: 'my-bot-token' })
      const user = await client.testAuth()

      expect(user.id).toBe('123456789')
      expect(user.username).toBe('testbot')
      expect(fetchCalls.length).toBe(1)
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/users/@me')

      const headers = fetchCalls[0].options?.headers as Record<string, string>
      expect(headers.Authorization).toBe('Bot my-bot-token')
      expect(headers['User-Agent']).toContain('DiscordBot')
    })

    it('throws DiscordBotError on API error', async () => {
      mockResponse({ message: 'Unauthorized', code: 401 }, 401)

      const client = await new DiscordBotClient().login({ token: 'bad-token' })
      await expect(client.testAuth()).rejects.toThrow(DiscordBotError)
    })
  })

  describe('oversized upload errors', () => {
    it('maps HTTP 413 with an empty response body', async () => {
      fetchResponses.push(new Response(null, { status: 413 }))

      const client = await new DiscordBotClient().login({ token: 'bot-token' })
      await expect(client.testAuth()).rejects.toMatchObject({
        code: 'http_413',
        message: 'File(s) too large for this server upload limit (Discord error 40005)',
      })
    })

    it('maps Discord error 40005 to the actionable upload message', async () => {
      mockResponse({ code: 40005, message: 'Request entity too large' }, 400)

      const client = await new DiscordBotClient().login({ token: 'bot-token' })
      await expect(client.testAuth()).rejects.toMatchObject({
        code: '40005',
        message: 'File(s) too large for this server upload limit (Discord error 40005)',
      })
    })

    it('preserves unrelated permission errors', async () => {
      mockResponse({ code: 50013, message: 'Missing Permissions' }, 403)

      const client = await new DiscordBotClient().login({ token: 'bot-token' })
      await expect(client.testAuth()).rejects.toMatchObject({ code: '50013', message: 'Missing Permissions' })
    })
  })

  describe('listGuilds', () => {
    it('returns list of guilds', async () => {
      mockResponse([
        { id: '111', name: 'Guild One' },
        { id: '222', name: 'Guild Two' },
      ])

      const client = await new DiscordBotClient().login({ token: 'bot-token' })
      const guilds = await client.listGuilds()

      expect(guilds).toHaveLength(2)
      expect(guilds[0].name).toBe('Guild One')
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/users/@me/guilds')
    })
  })

  describe('getGuild', () => {
    it('returns guild info', async () => {
      mockResponse({ id: '111', name: 'Test Guild' })

      const client = await new DiscordBotClient().login({ token: 'bot-token' })
      const guild = await client.getGuild('111')

      expect(guild.id).toBe('111')
      expect(guild.name).toBe('Test Guild')
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/guilds/111')
    })
  })

  describe('listChannels', () => {
    it('returns channels for guild', async () => {
      mockResponse([
        { id: 'ch1', guild_id: '111', name: 'general', type: 0 },
        { id: 'ch2', guild_id: '111', name: 'random', type: 0 },
      ])

      const client = await new DiscordBotClient().login({ token: 'bot-token' })
      const channels = await client.listChannels('111')

      expect(channels).toHaveLength(2)
      expect(channels[0].name).toBe('general')
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/guilds/111/channels')
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

      const client = await new DiscordBotClient().login({ token: 'bot-token' })
      const message = await client.sendMessage('ch1', 'Hello world')

      expect(message.content).toBe('Hello world')
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/channels/ch1/messages')
      expect(fetchCalls[0].options?.method).toBe('POST')
      expect(fetchCalls[0].options?.body).toBe(JSON.stringify({ content: 'Hello world' }))
    })

    it('includes thread_id when provided', async () => {
      mockResponse({
        id: 'msg1',
        channel_id: 'ch1',
        author: { id: '123', username: 'bot' },
        content: 'Thread reply',
        timestamp: '2024-01-01T00:00:00.000Z',
      })

      const client = await new DiscordBotClient().login({ token: 'bot-token' })
      await client.sendMessage('ch1', 'Thread reply', { thread_id: 'thread123' })

      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/channels/thread123/messages')
      expect(fetchCalls[0].options?.body).toBe(JSON.stringify({ content: 'Thread reply' }))
    })

    it('includes message_reference when reply_to is provided', async () => {
      mockResponse({
        id: 'msg1',
        channel_id: 'ch1',
        author: { id: '123', username: 'bot' },
        content: 'Reply text',
        timestamp: '2024-01-01T00:00:00.000Z',
      })

      const client = await new DiscordBotClient().login({ token: 'bot-token' })
      await client.sendMessage('ch1', 'Reply text', { reply_to: 'parent123' })

      expect(fetchCalls[0].options?.body).toBe(
        JSON.stringify({ content: 'Reply text', message_reference: { message_id: 'parent123' } }),
      )
    })
  })

  describe('createMessage', () => {
    it('sends files with text as multipart form data', async () => {
      const { tmpdir } = await import('node:os')
      const { join } = await import('node:path')
      const tempFile = join(tmpdir(), 'report.pdf')
      await Bun.write(tempFile, 'report contents')

      mockResponse({
        id: 'msg1',
        channel_id: 'ch1',
        author: { id: '123', username: 'bot' },
        content: 'see attached',
        timestamp: '2024-01-01T00:00:00.000Z',
        attachments: [{ id: 'att1', filename: 'report.pdf', size: 15, url: 'https://example.com/report.pdf' }],
      })

      const client = await new DiscordBotClient().login({ token: 'bot-token' })
      await client.createMessage('ch1', { content: 'see attached', files: [{ path: tempFile }] })

      const body = fetchCalls[0].options?.body
      expect(body).toBeInstanceOf(FormData)
      const formData = body as FormData
      expect(JSON.parse(formData.get('payload_json') as string)).toEqual({
        content: 'see attached',
        attachments: [{ id: 0, filename: 'report.pdf' }],
      })
      expect((formData.get('files[0]') as File).name).toBe('report.pdf')
      const headers = fetchCalls[0].options?.headers as Record<string, string> | undefined
      expect(headers?.['Content-Type']).toBeUndefined()
    })

    it('preserves indexed multipart wire format for multiple files', async () => {
      const { tmpdir } = await import('node:os')
      const { join } = await import('node:path')
      const firstPath = join(tmpdir(), 'a.txt')
      const secondPath = join(tmpdir(), 'b.txt')
      await Bun.write(firstPath, 'alpha')
      await Bun.write(secondPath, 'bravo!')
      mockResponse({ attachments: [] })

      const client = await new DiscordBotClient().login({ token: 'bot-token' })
      await client.createMessage('ch1', {
        content: 'two files',
        files: [{ path: firstPath }, { path: secondPath }],
      })

      const body = fetchCalls[0].options?.body
      expect(body).toBeInstanceOf(FormData)
      const formData = body as FormData
      expect(JSON.parse(formData.get('payload_json') as string)).toEqual({
        content: 'two files',
        attachments: [
          { id: 0, filename: 'a.txt' },
          { id: 1, filename: 'b.txt' },
        ],
      })
      expect((formData.get('files[0]') as File).name).toBe('a.txt')
      expect((formData.get('files[0]') as File).size).toBe(5)
      expect((formData.get('files[1]') as File).name).toBe('b.txt')
      expect((formData.get('files[1]') as File).size).toBe(6)
      const headers = fetchCalls[0].options?.headers as Record<string, string> | undefined
      expect(headers?.['Content-Type']).toBeUndefined()
    })

    it('normalizes Windows-style implicit filenames', async () => {
      const { tmpdir } = await import('node:os')
      const { join } = await import('node:path')
      const tempFile = join(tmpdir(), 'C:\\dir\\x.txt')
      await Bun.write(tempFile, 'content')
      mockResponse({ attachments: [{ id: 'att1', filename: 'x.txt', size: 7, url: 'https://example.com' }] })

      const client = await new DiscordBotClient().login({ token: 'bot-token' })
      await client.createMessage('ch1', { files: [{ path: tempFile }] })

      const formData = fetchCalls[0].options?.body as FormData
      expect(JSON.parse(formData.get('payload_json') as string).attachments[0].filename).toBe('x.txt')
      expect((formData.get('files[0]') as File).name).toBe('x.txt')
    })

    it('uses a filename override for multipart parts', async () => {
      const { tmpdir } = await import('node:os')
      const { join } = await import('node:path')
      const tempFile = join(tmpdir(), 'test-discordbot-create-message-original.txt')
      await Bun.write(tempFile, 'content')
      mockResponse({ attachments: [{ id: 'att1', filename: 'renamed.txt', size: 7, url: 'https://example.com' }] })

      const client = await new DiscordBotClient().login({ token: 'bot-token' })
      await client.createMessage('ch1', { files: [{ path: tempFile, filename: 'renamed.txt' }] })

      const formData = fetchCalls[0].options?.body as FormData
      expect(JSON.parse(formData.get('payload_json') as string).attachments[0].filename).toBe('renamed.txt')
      expect((formData.get('files[0]') as File).name).toBe('renamed.txt')
    })

    it('rejects invalid filenames before fetching', async () => {
      const invalidFilenames = ['../evil', 'a/b', 'a\\b', '.', '..', '']
      const client = await new DiscordBotClient().login({ token: 'bot-token' })

      for (const filename of invalidFilenames) {
        await expect(
          client.createMessage('ch1', { content: 'x', files: [{ path: '/tmp/file', filename }] }),
        ).rejects.toMatchObject({ code: 'invalid_filename', message: 'Invalid filename' })
      }
      expect(fetchCalls).toHaveLength(0)
    })

    it('rejects more than 10 files before fetching', async () => {
      const client = await new DiscordBotClient().login({ token: 'bot-token' })
      const files = Array.from({ length: 11 }, (_, index) => ({ path: `/tmp/file-${index}` }))

      await expect(client.createMessage('ch1', { files })).rejects.toMatchObject({
        code: 'too_many_files',
        message: 'Discord allows at most 10 files per message',
      })
      expect(fetchCalls).toHaveLength(0)
    })

    it('rejects an empty message before fetching', async () => {
      const client = await new DiscordBotClient().login({ token: 'bot-token' })

      await expect(client.createMessage('ch1', { content: '  ' })).rejects.toMatchObject({
        code: 'empty_message',
        message: 'Message must have content or at least one file',
      })
      expect(fetchCalls).toHaveLength(0)
    })

    it('propagates missing file errors', async () => {
      const client = await new DiscordBotClient().login({ token: 'bot-token' })

      await expect(
        client.createMessage('ch1', { content: 'x', files: [{ path: '/tmp/does-not-exist-ulw' }] }),
      ).rejects.toThrow(/ENOENT/)
      expect(fetchCalls).toHaveLength(0)
    })

    it('posts file messages into the requested thread', async () => {
      const { tmpdir } = await import('node:os')
      const { join } = await import('node:path')
      const tempFile = join(tmpdir(), 'test-discordbot-thread-file.txt')
      await Bun.write(tempFile, 'content')
      mockResponse({
        attachments: [{ id: 'att1', filename: 'test-discordbot-thread-file.txt', size: 7, url: 'https://example.com' }],
      })

      const client = await new DiscordBotClient().login({ token: 'bot-token' })
      await client.createMessage('parent', { content: 'x', thread_id: 'thread123', files: [{ path: tempFile }] })

      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/channels/thread123/messages')
    })

    it('sends replies and files together', async () => {
      const { tmpdir } = await import('node:os')
      const { join } = await import('node:path')
      const tempFile = join(tmpdir(), 'test-discordbot-reply-file.txt')
      await Bun.write(tempFile, 'content')
      mockResponse({
        attachments: [{ id: 'att1', filename: 'test-discordbot-reply-file.txt', size: 7, url: 'https://example.com' }],
      })

      const client = await new DiscordBotClient().login({ token: 'bot-token' })
      await client.createMessage('ch1', { content: 'reply', reply_to: 'parent123', files: [{ path: tempFile }] })

      const formData = fetchCalls[0].options?.body as FormData
      expect(JSON.parse(formData.get('payload_json') as string)).toEqual({
        content: 'reply',
        message_reference: { message_id: 'parent123' },
        attachments: [{ id: 0, filename: 'test-discordbot-reply-file.txt' }],
      })
      expect(formData.get('files[0]')).toBeTruthy()
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
        edited_timestamp: '2024-01-01T00:01:00.000Z',
      })

      const client = await new DiscordBotClient().login({ token: 'bot-token' })
      const message = await client.editMessage('ch1', 'msg1', 'Updated content')

      expect(message.content).toBe('Updated content')
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/channels/ch1/messages/msg1')
      expect(fetchCalls[0].options?.method).toBe('PATCH')
      expect(fetchCalls[0].options?.body).toBe(JSON.stringify({ content: 'Updated content' }))
    })
  })

  describe('deleteMessage', () => {
    it('deletes message and returns void', async () => {
      mockResponse(null, 204)

      const client = await new DiscordBotClient().login({ token: 'bot-token' })
      const result = await client.deleteMessage('ch1', 'msg1')

      expect(result).toBeUndefined()
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/channels/ch1/messages/msg1')
      expect(fetchCalls[0].options?.method).toBe('DELETE')
    })
  })

  describe('addReaction', () => {
    it('adds reaction with encoded emoji', async () => {
      mockResponse(null, 204)

      const client = await new DiscordBotClient().login({ token: 'bot-token' })
      await client.addReaction('ch1', 'msg1', '👍')

      expect(fetchCalls[0].url).toBe(
        'https://discord.com/api/v10/channels/ch1/messages/msg1/reactions/%F0%9F%91%8D/@me',
      )
      expect(fetchCalls[0].options?.method).toBe('PUT')
    })
  })

  describe('removeReaction', () => {
    it('removes reaction with DELETE', async () => {
      mockResponse(null, 204)

      const client = await new DiscordBotClient().login({ token: 'bot-token' })
      await client.removeReaction('ch1', 'msg1', '👍')

      expect(fetchCalls[0].url).toBe(
        'https://discord.com/api/v10/channels/ch1/messages/msg1/reactions/%F0%9F%91%8D/@me',
      )
      expect(fetchCalls[0].options?.method).toBe('DELETE')
    })
  })

  describe('listUsers', () => {
    it('maps guild members to users', async () => {
      mockResponse([{ user: { id: 'u1', username: 'user1' } }, { user: { id: 'u2', username: 'user2' } }])

      const client = await new DiscordBotClient().login({ token: 'bot-token' })
      const users = await client.listUsers('111')

      expect(users).toHaveLength(2)
      expect(users[0].username).toBe('user1')
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/guilds/111/members?limit=1000')
    })
  })

  describe('getUser', () => {
    it('returns user info', async () => {
      mockResponse({ id: 'u1', username: 'testuser' })

      const client = await new DiscordBotClient().login({ token: 'bot-token' })
      const user = await client.getUser('u1')

      expect(user.id).toBe('u1')
      expect(user.username).toBe('testuser')
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/users/u1')
    })
  })

  describe('uploadFile', () => {
    it('uploads file to channel', async () => {
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

      const client = await new DiscordBotClient().login({ token: 'bot-token' })
      const file = await client.uploadFile('ch1', tempFile)

      expect(file.filename).toBe('test-discordbot-upload.txt')
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/channels/ch1/messages')
      expect(fetchCalls[0].options?.method).toBe('POST')

      const headers = fetchCalls[0].options?.headers as Record<string, string>
      expect(headers.Authorization).toBe('Bot bot-token')
    })

    it('throws when response has no attachments', async () => {
      const { tmpdir } = await import('node:os')
      const { join } = await import('node:path')
      const tempFile = join(tmpdir(), 'test-discordbot-upload-empty.txt')
      await Bun.write(tempFile, 'test content')

      mockResponse({
        id: 'msg1',
        channel_id: 'ch1',
        author: { id: '123', username: 'bot' },
        content: '',
        timestamp: '2024-01-01T00:00:00.000Z',
        attachments: [],
      })

      const client = await new DiscordBotClient().login({ token: 'bot-token' })
      await expect(client.uploadFile('ch1', tempFile)).rejects.toThrow('Upload succeeded but no attachments returned')
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

      const client = await new DiscordBotClient().login({ token: 'bot-token' })
      const files = await client.listFiles('ch1')

      expect(files).toHaveLength(1)
      expect(files[0].filename).toBe('file1.txt')
    })

    it('requests a single page even when the page is full', async () => {
      mockResponse(messagePage(0, 100))

      const client = await new DiscordBotClient().login({ token: 'bot-token' })
      const files = await client.listFiles('ch1')

      expect(files).toHaveLength(100)
      expect(fetchCalls).toHaveLength(1)
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/channels/ch1/messages?limit=100')
    })
  })

  describe('findFile', () => {
    it('stops after the first page when the file is in the newest messages', async () => {
      mockResponse(messagePage(0, 100))

      const client = await new DiscordBotClient().login({ token: 'bot-token' })
      const file = await client.findFile('ch1', 'att0')

      expect(file?.filename).toBe('file0.txt')
      expect(fetchCalls).toHaveLength(1)
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/channels/ch1/messages?limit=100')
    })

    it('follows the before cursor to reach an older page', async () => {
      mockResponse(messagePage(0, 100))
      mockResponse(messagePage(100, 40))

      const client = await new DiscordBotClient().login({ token: 'bot-token' })
      const file = await client.findFile('ch1', 'att120')

      expect(file?.filename).toBe('file120.txt')
      expect(fetchCalls).toHaveLength(2)
      expect(fetchCalls[1].url).toBe('https://discord.com/api/v10/channels/ch1/messages?limit=100&before=msg99')
    })

    it('stops at the end of the channel history when the file is missing', async () => {
      mockResponse(messagePage(0, 100))
      mockResponse(messagePage(100, 3))

      const client = await new DiscordBotClient().login({ token: 'bot-token' })
      const file = await client.findFile('ch1', 'missing')

      expect(file).toBeUndefined()
      expect(fetchCalls).toHaveLength(2)
    })

    it('gives up after the bounded page budget', async () => {
      for (let page = 0; page < 12; page += 1) mockResponse(messagePage(page * 100, 100))

      const client = await new DiscordBotClient().login({ token: 'bot-token' })
      const file = await client.findFile('ch1', 'missing')

      expect(file).toBeUndefined()
      expect(fetchCalls).toHaveLength(10)
      expect(fetchCalls[9].url).toBe('https://discord.com/api/v10/channels/ch1/messages?limit=100&before=msg899')
    })
  })

  describe('createThread', () => {
    it('creates thread in channel', async () => {
      mockResponse({
        id: 'thread1',
        guild_id: '111',
        name: 'My Thread',
        type: 11,
      })

      const client = await new DiscordBotClient().login({ token: 'bot-token' })
      const thread = await client.createThread('ch1', 'My Thread', { auto_archive_duration: 1440 })

      expect(thread.id).toBe('thread1')
      expect(thread.name).toBe('My Thread')
      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/channels/ch1/threads')
      expect(fetchCalls[0].options?.method).toBe('POST')
      expect(fetchCalls[0].options?.body).toBe(JSON.stringify({ name: 'My Thread', auto_archive_duration: 1440 }))
    })
  })

  describe('archiveThread', () => {
    it('archives thread with PATCH', async () => {
      mockResponse({
        id: 'thread1',
        guild_id: '111',
        name: 'My Thread',
        type: 11,
        thread_metadata: { archived: true },
      })

      const client = await new DiscordBotClient().login({ token: 'bot-token' })
      await client.archiveThread('thread1')

      expect(fetchCalls[0].url).toBe('https://discord.com/api/v10/channels/thread1')
      expect(fetchCalls[0].options?.method).toBe('PATCH')
      expect(fetchCalls[0].options?.body).toBe(JSON.stringify({ archived: true }))
    })
  })

  describe('resolveChannel', () => {
    it('returns channel ID directly if all digits', async () => {
      const client = await new DiscordBotClient().login({ token: 'bot-token' })
      const id = await client.resolveChannel('111', '123456789')

      expect(id).toBe('123456789')
      expect(fetchCalls.length).toBe(0)
    })

    it('looks up channel by name', async () => {
      mockResponse([
        { id: 'ch1', guild_id: '111', name: 'general', type: 0 },
        { id: 'ch2', guild_id: '111', name: 'random', type: 0 },
      ])

      const client = await new DiscordBotClient().login({ token: 'bot-token' })
      const id = await client.resolveChannel('111', 'random')

      expect(id).toBe('ch2')
    })

    it('strips # prefix when looking up by name', async () => {
      mockResponse([{ id: 'ch1', guild_id: '111', name: 'general', type: 0 }])

      const client = await new DiscordBotClient().login({ token: 'bot-token' })
      const id = await client.resolveChannel('111', '#general')

      expect(id).toBe('ch1')
    })

    it('throws when channel name not found', async () => {
      mockResponse([{ id: 'ch1', guild_id: '111', name: 'general', type: 0 }])

      const client = await new DiscordBotClient().login({ token: 'bot-token' })
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
    it('waits when bucket is exhausted', async () => {
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

      const client = await new DiscordBotClient().login({ token: 'bot-token' })
      await client.testAuth()

      const startTime = Date.now()
      await client.testAuth()
      const elapsed = Date.now() - startTime

      expect(elapsed).toBeGreaterThanOrEqual(50)
      expect(fetchCalls.length).toBe(2)
    })

    it('retries on 429 with Retry-After header', async () => {
      mockResponse({ message: 'Rate limited', retry_after: 0.1 }, 429, { 'Retry-After': '0.1' })
      mockResponse({ id: '123', username: 'bot' })

      const client = await new DiscordBotClient().login({ token: 'bot-token' })
      const user = await client.testAuth()

      expect(user.id).toBe('123')
      expect(fetchCalls.length).toBe(2)
    })

    it('handles global rate limit', async () => {
      mockResponse({ message: 'Global rate limited', global: true }, 429, {
        'Retry-After': '0.1',
        'X-RateLimit-Global': 'true',
      })
      mockResponse({ id: '123', username: 'bot' })

      const client = await new DiscordBotClient().login({ token: 'bot-token' })
      const user = await client.testAuth()

      expect(user.id).toBe('123')
      expect(fetchCalls.length).toBe(2)
    })

    it('throws after max retries exceeded', async () => {
      for (let i = 0; i <= 3; i++) {
        mockResponse({ message: 'Rate limited' }, 429, { 'Retry-After': '0.01' })
      }

      const client = await new DiscordBotClient().login({ token: 'bot-token' })
      await expect(client.testAuth()).rejects.toThrow(DiscordBotError)
      expect(fetchCalls.length).toBeLessThanOrEqual(4)
    })
  })

  describe('retry logic', () => {
    it('retries on 500 server error', async () => {
      mockResponse({ message: 'Internal Server Error' }, 500)
      mockResponse({ id: '123', username: 'bot' })

      const client = await new DiscordBotClient().login({ token: 'bot-token' })
      const user = await client.testAuth()

      expect(user.id).toBe('123')
      expect(fetchCalls.length).toBe(2)
    })

    it('does not retry on 4xx client errors (except 429)', async () => {
      mockResponse({ message: 'Not Found' }, 404)

      const client = await new DiscordBotClient().login({ token: 'bot-token' })
      await expect(client.testAuth()).rejects.toThrow(DiscordBotError)
      expect(fetchCalls.length).toBe(1)
    })

    it('exponential backoff increases delay', async () => {
      mockResponse({ message: 'Error' }, 500)
      mockResponse({ message: 'Error' }, 500)
      mockResponse({ id: '123', username: 'bot' })

      const client = await new DiscordBotClient().login({ token: 'bot-token' })
      const startTime = Date.now()
      await client.testAuth()
      const elapsed = Date.now() - startTime

      expect(elapsed).toBeGreaterThanOrEqual(150)
      expect(fetchCalls.length).toBe(3)
    })
  })
})
