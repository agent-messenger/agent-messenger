import { afterEach, beforeEach, describe, expect, mock, it } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const attachment = (id: string, filename: string, content_type?: string) => ({
  id,
  filename,
  size: 15,
  url: `https://cdn.example.com/attachments/ch1/${id}/${filename}`,
  ...(content_type ? { content_type } : {}),
})

const mockCreateMessage = mock((channelId: string, options?: { content?: string; reply_to?: string }) =>
  Promise.resolve({
    id: 'msg1',
    channel_id: channelId,
    content: options?.content ?? '',
    author: { id: 'bot1', username: 'testbot' },
    timestamp: '2025-01-01T00:00:00.000Z',
  }),
)

const mockGetMessages = mock((_channelId: string, _limit?: number) =>
  Promise.resolve([
    {
      id: 'msg1',
      channel_id: 'ch1',
      content: 'hello',
      author: { id: 'user1', username: 'alice' },
      timestamp: '2025-01-01T00:00:00.000Z',
    },
    {
      id: 'msg2',
      channel_id: 'ch1',
      content: 'world',
      author: { id: 'user2', username: 'bob' },
      timestamp: '2025-01-01T00:01:00.000Z',
      thread: { id: 'thread1', guild_id: 'guild1', name: 'thread one', type: 11 },
      attachments: [attachment('att1', 'report.pdf', 'application/pdf'), attachment('att2', 'notes.txt')],
    },
  ]),
)

const mockGetMessage = mock((_channelId: string, _messageId: string) =>
  Promise.resolve({
    id: 'msg1',
    channel_id: 'ch1',
    content: 'hello',
    author: { id: 'user1', username: 'alice' },
    timestamp: '2025-01-01T00:00:00.000Z',
    thread: { id: 'thread1', guild_id: 'guild1', name: 'thread one', type: 11 },
    attachments: [attachment('att1', 'report.pdf', 'application/pdf')],
  }),
)

const mockEditMessage = mock((_channelId: string, _messageId: string, content: string) =>
  Promise.resolve({
    id: 'msg1',
    channel_id: 'ch1',
    content,
    author: { id: 'bot1', username: 'testbot' },
    timestamp: '2025-01-01T00:00:00.000Z',
    edited_timestamp: '2025-01-01T00:05:00.000Z',
  }),
)

const mockDeleteMessage = mock((_channelId: string, _messageId: string) => Promise.resolve())

const mockResolveChannel = mock((_guildId: string, channel: string) => {
  if (/^\d+$/.test(channel)) return Promise.resolve(channel)
  if (channel === 'general') return Promise.resolve('ch1')
  return Promise.reject(new Error(`Channel not found: "${channel}"`))
})

const mockResolveThread = mock((_guildId: string, _parentChannelId: string, thread: string) => {
  const name = thread.replace(/^#/, '')
  if (name === 'dev-talk') return Promise.resolve('thread456')
  return Promise.reject(
    new Error(
      `Thread not found: "${name}". Run "thread list <channel>" (add --archived for archived threads) or use the thread ID. If <channel> is itself a thread, send to it directly without --thread.`,
    ),
  )
})

mock.module('../client', () => ({
  DiscordBotClient: class MockDiscordBotClient {
    async login(_credentials?: any) {
      return this
    }
    createMessage = mockCreateMessage
    getMessages = mockGetMessages
    getMessage = mockGetMessage
    editMessage = mockEditMessage
    deleteMessage = mockDeleteMessage
    resolveChannel = mockResolveChannel
    resolveThread = mockResolveThread
  },
}))

import { DiscordBotCredentialManager } from '../credential-manager'
import { deleteAction, editAction, getAction, listAction, repliesAction, sendAction } from './message'

describe('message commands', () => {
  let tempDir: string
  let manager: DiscordBotCredentialManager
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(async () => {
    tempDir = join(tmpdir(), `discordbot-message-test-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })
    originalEnv = { ...process.env }
    delete process.env.E2E_DISCORDBOT_TOKEN
    delete process.env.E2E_DISCORDBOT_SERVER_ID
    delete process.env.E2E_DISCORDBOT_SERVER_NAME

    manager = new DiscordBotCredentialManager(tempDir)
    await manager.setCredentials({
      token: 'token123',
      bot_id: 'bot1',
      bot_name: 'Bot 1',
    })
    await manager.setCurrentServer('guild1', 'Test Guild')

    mockCreateMessage.mockClear()
    mockGetMessages.mockClear()
    mockGetMessage.mockClear()
    mockEditMessage.mockClear()
    mockDeleteMessage.mockClear()
    mockResolveChannel.mockClear()
    mockResolveThread.mockClear()
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true })
    }
    process.env = originalEnv
  })

  describe('sendAction', () => {
    it('sends message to channel by name', async () => {
      const result = await sendAction('general', 'hello world', { _credManager: manager })

      expect(result.error).toBeUndefined()
      expect(result.id).toBe('msg1')
      expect(result.content).toBe('hello world')
      expect(result.author).toBe('testbot')
      expect(result.channel_id).toBe('ch1')
      expect(mockResolveChannel).toHaveBeenCalledWith('guild1', 'general')
      expect(mockCreateMessage).toHaveBeenCalledWith('ch1', { content: 'hello world', reply_to: undefined })
      expect(mockResolveThread).not.toHaveBeenCalled()
    })

    it('sends message to channel by ID', async () => {
      const result = await sendAction('123456', 'hi', { _credManager: manager })

      expect(result.error).toBeUndefined()
      expect(result.channel_id).toBe('123456')
      expect(mockResolveChannel).toHaveBeenCalledWith('guild1', '123456')
      expect(mockCreateMessage).toHaveBeenCalledWith('123456', { content: 'hi', reply_to: undefined })
    })

    it('sends message to thread', async () => {
      const result = await sendAction('general', 'thread reply', {
        _credManager: manager,
        thread: '123456789',
      })

      expect(result.error).toBeUndefined()
      expect(result.channel_id).toBe('123456789')
      expect(result.id).toBe('msg1')
      expect(mockCreateMessage).toHaveBeenCalledWith('123456789', { content: 'thread reply', reply_to: undefined })
      expect(mockResolveThread).not.toHaveBeenCalled()
    })

    it('sends message to thread by name', async () => {
      const result = await sendAction('general', 'named thread reply', {
        _credManager: manager,
        thread: 'dev-talk',
      })

      expect(result.error).toBeUndefined()
      expect(result.channel_id).toBe('thread456')
      expect(mockResolveThread).toHaveBeenCalledWith('guild1', 'ch1', 'dev-talk')
      expect(mockCreateMessage).toHaveBeenCalledWith('thread456', {
        content: 'named thread reply',
        reply_to: undefined,
      })
    })

    it('replies to a message', async () => {
      const result = await sendAction('general', 'reply text', {
        _credManager: manager,
        reply: 'parent123',
      })

      expect(result.error).toBeUndefined()
      expect(result.id).toBe('msg1')
      expect(mockCreateMessage).toHaveBeenCalledWith('ch1', { content: 'reply text', reply_to: 'parent123' })
    })

    it('reports an empty attachments array when the API returns none', async () => {
      const result = await sendAction('general', 'hello world', { _credManager: manager })

      expect(result.error).toBeUndefined()
      expect(result.attachments).toEqual([])
    })

    it('reports attachments on send', async () => {
      mockCreateMessage.mockImplementationOnce((channelId: string) =>
        Promise.resolve({
          id: 'msg2',
          channel_id: channelId,
          content: 'see attached',
          author: { id: 'bot1', username: 'testbot' },
          timestamp: '2025-01-01T00:00:00.000Z',
          attachments: [attachment('att1', 'report.pdf', 'application/pdf'), attachment('att2', 'notes.txt')],
        }),
      )

      const result = await sendAction('general', 'see attached', { _credManager: manager })

      expect(result.error).toBeUndefined()
      expect(result.attachments).toEqual([
        {
          id: 'att1',
          filename: 'report.pdf',
          size: 15,
          url: 'https://cdn.example.com/attachments/ch1/att1/report.pdf',
          content_type: 'application/pdf',
        },
        {
          id: 'att2',
          filename: 'notes.txt',
          size: 15,
          url: 'https://cdn.example.com/attachments/ch1/att2/notes.txt',
          content_type: null,
        },
      ])
    })

    it('returns error on channel not found', async () => {
      const result = await sendAction('unknown', 'hi', { _credManager: manager })

      expect(result.error).toContain('Channel not found')
      expect(result.id).toBeUndefined()
      expect(mockCreateMessage).not.toHaveBeenCalled()
    })

    it('returns error when thread resolution fails without sending', async () => {
      const result = await sendAction('general', 'hi', {
        _credManager: manager,
        thread: 'no-such-thread',
      })

      expect(result.error).toContain('Thread not found: "no-such-thread"')
      expect(result.error).toContain('thread list')
      expect(result.id).toBeUndefined()
      expect(result.channel_id).toBeUndefined()
      expect(mockCreateMessage).not.toHaveBeenCalled()
    })

    it('propagates malformed thread names to the resolver', async () => {
      const result = await sendAction('general', 'hi', {
        _credManager: manager,
        thread: '#no "such" thread?',
      })

      expect(mockResolveThread).toHaveBeenCalledWith('guild1', 'ch1', '#no "such" thread?')
      expect(result.error).toContain('Thread not found: "no "such" thread?"')
      expect(mockCreateMessage).not.toHaveBeenCalled()
    })

    it('returns error on client failure', async () => {
      mockCreateMessage.mockImplementationOnce(() => Promise.reject(new Error('API Error')))

      const result = await sendAction('general', 'hi', { _credManager: manager })

      expect(result.error).toContain('API Error')
    })
  })

  describe('listAction', () => {
    it('lists messages in channel', async () => {
      const result = await listAction('general', { _credManager: manager })

      expect(result.error).toBeUndefined()
      expect(result.messages).toHaveLength(2)
      expect(result.messages?.[0].id).toBe('msg1')
      expect(result.messages?.[0].author).toBe('alice')
      expect(result.messages?.[0].thread_id).toBeNull()
      expect(result.messages?.[0].attachments).toEqual([])
      expect(result.messages?.[1].thread_id).toBe('thread1')
      expect(result.messages?.[1].attachments).toEqual([
        {
          id: 'att1',
          filename: 'report.pdf',
          size: 15,
          url: 'https://cdn.example.com/attachments/ch1/att1/report.pdf',
          content_type: 'application/pdf',
        },
        {
          id: 'att2',
          filename: 'notes.txt',
          size: 15,
          url: 'https://cdn.example.com/attachments/ch1/att2/notes.txt',
          content_type: null,
        },
      ])
      expect(mockGetMessages).toHaveBeenCalledWith('ch1', 50)
    })

    it('uses custom limit', async () => {
      await listAction('general', { _credManager: manager, limit: '10' })

      expect(mockGetMessages).toHaveBeenCalledWith('ch1', 10)
    })

    it('defaults to 50 messages', async () => {
      await listAction('general', { _credManager: manager })

      expect(mockGetMessages).toHaveBeenCalledWith('ch1', 50)
    })

    it('resolves channel name', async () => {
      await listAction('general', { _credManager: manager })

      expect(mockResolveChannel).toHaveBeenCalledWith('guild1', 'general')
    })

    it('returns error on failure', async () => {
      mockGetMessages.mockImplementationOnce(() => Promise.reject(new Error('Forbidden')))

      const result = await listAction('general', { _credManager: manager })

      expect(result.error).toContain('Forbidden')
    })
  })

  describe('getAction', () => {
    it('gets a single message', async () => {
      const result = await getAction('general', 'msg1', { _credManager: manager })

      expect(result.error).toBeUndefined()
      expect(result.id).toBe('msg1')
      expect(result.content).toBe('hello')
      expect(result.author).toBe('alice')
      expect(result.thread_id).toBe('thread1')
      expect(result.attachments).toEqual([
        {
          id: 'att1',
          filename: 'report.pdf',
          size: 15,
          url: 'https://cdn.example.com/attachments/ch1/att1/report.pdf',
          content_type: 'application/pdf',
        },
      ])
      expect(mockGetMessage).toHaveBeenCalledWith('ch1', 'msg1')
    })

    it('reports null thread id and empty attachments when the API omits them', async () => {
      mockGetMessage.mockImplementationOnce(() =>
        Promise.resolve({
          id: 'msg3',
          channel_id: 'ch1',
          content: 'bare',
          author: { id: 'user1', username: 'alice' },
          timestamp: '2025-01-01T00:02:00.000Z',
        }),
      )

      const result = await getAction('general', 'msg3', { _credManager: manager })

      expect(result.error).toBeUndefined()
      expect(result.thread_id).toBeNull()
      expect(result.attachments).toEqual([])
    })

    it('resolves channel name', async () => {
      await getAction('general', 'msg1', { _credManager: manager })

      expect(mockResolveChannel).toHaveBeenCalledWith('guild1', 'general')
    })

    it('returns error on failure', async () => {
      mockGetMessage.mockImplementationOnce(() => Promise.reject(new Error('Not Found')))

      const result = await getAction('general', 'msg999', { _credManager: manager })

      expect(result.error).toContain('Not Found')
    })
  })

  describe('editAction', () => {
    it('edits a message', async () => {
      const result = await editAction('general', 'msg1', 'updated text', { _credManager: manager })

      expect(result.error).toBeUndefined()
      expect(result.id).toBe('msg1')
      expect(result.content).toBe('updated text')
      expect(result.edited_timestamp).toBe('2025-01-01T00:05:00.000Z')
      expect(result.thread_id).toBeNull()
      expect(result.attachments).toEqual([])
      expect(mockEditMessage).toHaveBeenCalledWith('ch1', 'msg1', 'updated text')
    })

    it('resolves channel name', async () => {
      await editAction('general', 'msg1', 'new', { _credManager: manager })

      expect(mockResolveChannel).toHaveBeenCalledWith('guild1', 'general')
    })

    it('returns error on failure', async () => {
      mockEditMessage.mockImplementationOnce(() => Promise.reject(new Error('Cannot edit')))

      const result = await editAction('general', 'msg1', 'new', { _credManager: manager })

      expect(result.error).toContain('Cannot edit')
    })
  })

  describe('deleteAction', () => {
    it('deletes message with --force', async () => {
      const result = await deleteAction('general', 'msg1', { _credManager: manager, force: true })

      expect(result.deleted).toBe('msg1')
      expect(mockDeleteMessage).toHaveBeenCalledWith('ch1', 'msg1')
    })

    it('returns error without --force', async () => {
      const result = await deleteAction('general', 'msg1', { _credManager: manager })

      expect(result.error).toBe('Use --force to confirm deletion')
      expect(mockDeleteMessage).not.toHaveBeenCalled()
    })

    it('returns error with force=false', async () => {
      const result = await deleteAction('general', 'msg1', { _credManager: manager, force: false })

      expect(result.error).toBe('Use --force to confirm deletion')
      expect(mockDeleteMessage).not.toHaveBeenCalled()
    })

    it('resolves channel name', async () => {
      await deleteAction('general', 'msg1', { _credManager: manager, force: true })

      expect(mockResolveChannel).toHaveBeenCalledWith('guild1', 'general')
    })

    it('returns error on failure', async () => {
      mockDeleteMessage.mockImplementationOnce(() => Promise.reject(new Error('Forbidden')))

      const result = await deleteAction('general', 'msg1', { _credManager: manager, force: true })

      expect(result.error).toContain('Forbidden')
    })
  })

  describe('repliesAction', () => {
    it('fetches thread messages', async () => {
      const result = await repliesAction('general', 'thread1', { _credManager: manager })

      expect(result.error).toBeUndefined()
      expect(result.messages).toHaveLength(2)
      expect(result.messages?.[0].thread_id).toBeNull()
      expect(result.messages?.[1].thread_id).toBe('thread1')
      expect(result.messages?.[1].attachments?.[0].filename).toBe('report.pdf')
      expect(mockGetMessages).toHaveBeenCalledWith('thread1', 50)
    })

    it('uses custom limit', async () => {
      await repliesAction('general', 'thread1', { _credManager: manager, limit: '25' })

      expect(mockGetMessages).toHaveBeenCalledWith('thread1', 25)
    })

    it('returns error on failure', async () => {
      mockGetMessages.mockImplementationOnce(() => Promise.reject(new Error('Thread not found')))

      const result = await repliesAction('general', 'thread999', { _credManager: manager })

      expect(result.error).toContain('Thread not found')
    })
  })
})
