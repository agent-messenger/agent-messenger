import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const mockSendMessage = mock((_channelId: string, content: string, _options?: { thread_id?: string }) =>
  Promise.resolve({
    id: 'msg1',
    channel_id: 'ch1',
    content,
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
      thread_id: undefined,
    },
    {
      id: 'msg2',
      channel_id: 'ch1',
      content: 'world',
      author: { id: 'user2', username: 'bob' },
      timestamp: '2025-01-01T00:01:00.000Z',
      thread_id: 'thread1',
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
    edited_timestamp: undefined,
    thread_id: undefined,
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

mock.module('../client', () => ({
  DiscordBotClient: class MockDiscordBotClient {
    constructor(token: string) {
      if (!token) throw new Error('Token is required')
    }
    sendMessage = mockSendMessage
    getMessages = mockGetMessages
    getMessage = mockGetMessage
    editMessage = mockEditMessage
    deleteMessage = mockDeleteMessage
    resolveChannel = mockResolveChannel
  },
}))

import { DiscordBotCredentialManager } from '../credential-manager'
import { deleteAction, getAction, listAction, repliesAction, sendAction, updateAction } from './message'

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

    mockSendMessage.mockClear()
    mockGetMessages.mockClear()
    mockGetMessage.mockClear()
    mockEditMessage.mockClear()
    mockDeleteMessage.mockClear()
    mockResolveChannel.mockClear()
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true })
    }
    process.env = originalEnv
  })

  describe('sendAction', () => {
    test('sends message to channel by name', async () => {
      const result = await sendAction('general', 'hello world', { _credManager: manager })

      expect(result.id).toBe('msg1')
      expect(result.content).toBe('hello world')
      expect(result.author).toBe('testbot')
      expect(mockResolveChannel).toHaveBeenCalledWith('guild1', 'general')
      expect(mockSendMessage).toHaveBeenCalledWith('ch1', 'hello world', { thread_id: undefined })
    })

    test('sends message to channel by ID', async () => {
      const result = await sendAction('123456', 'hi', { _credManager: manager })

      expect(result.id).toBe('msg1')
      expect(mockResolveChannel).toHaveBeenCalledWith('guild1', '123456')
      expect(mockSendMessage).toHaveBeenCalledWith('123456', 'hi', { thread_id: undefined })
    })

    test('sends message to thread', async () => {
      const result = await sendAction('general', 'thread reply', {
        _credManager: manager,
        thread: 'thread123',
      })

      expect(result.id).toBe('msg1')
      expect(mockSendMessage).toHaveBeenCalledWith('ch1', 'thread reply', { thread_id: 'thread123' })
    })

    test('returns error on channel not found', async () => {
      const result = await sendAction('unknown', 'hi', { _credManager: manager })

      expect(result.error).toContain('Channel not found')
    })

    test('returns error on client failure', async () => {
      mockSendMessage.mockImplementationOnce(() => Promise.reject(new Error('API Error')))

      const result = await sendAction('general', 'hi', { _credManager: manager })

      expect(result.error).toContain('API Error')
    })
  })

  describe('listAction', () => {
    test('lists messages in channel', async () => {
      const result = await listAction('general', { _credManager: manager })

      expect(result.messages).toHaveLength(2)
      expect(result.messages?.[0].id).toBe('msg1')
      expect(result.messages?.[0].author).toBe('alice')
      expect(result.messages?.[1].thread_id).toBe('thread1')
      expect(mockGetMessages).toHaveBeenCalledWith('ch1', 50)
    })

    test('uses custom limit', async () => {
      await listAction('general', { _credManager: manager, limit: '10' })

      expect(mockGetMessages).toHaveBeenCalledWith('ch1', 10)
    })

    test('defaults to 50 messages', async () => {
      await listAction('general', { _credManager: manager })

      expect(mockGetMessages).toHaveBeenCalledWith('ch1', 50)
    })

    test('resolves channel name', async () => {
      await listAction('general', { _credManager: manager })

      expect(mockResolveChannel).toHaveBeenCalledWith('guild1', 'general')
    })

    test('returns error on failure', async () => {
      mockGetMessages.mockImplementationOnce(() => Promise.reject(new Error('Forbidden')))

      const result = await listAction('general', { _credManager: manager })

      expect(result.error).toContain('Forbidden')
    })
  })

  describe('getAction', () => {
    test('gets a single message', async () => {
      const result = await getAction('general', 'msg1', { _credManager: manager })

      expect(result.id).toBe('msg1')
      expect(result.content).toBe('hello')
      expect(result.author).toBe('alice')
      expect(mockGetMessage).toHaveBeenCalledWith('ch1', 'msg1')
    })

    test('resolves channel name', async () => {
      await getAction('general', 'msg1', { _credManager: manager })

      expect(mockResolveChannel).toHaveBeenCalledWith('guild1', 'general')
    })

    test('returns error on failure', async () => {
      mockGetMessage.mockImplementationOnce(() => Promise.reject(new Error('Not Found')))

      const result = await getAction('general', 'msg999', { _credManager: manager })

      expect(result.error).toContain('Not Found')
    })
  })

  describe('updateAction', () => {
    test('updates a message', async () => {
      const result = await updateAction('general', 'msg1', 'updated text', { _credManager: manager })

      expect(result.id).toBe('msg1')
      expect(result.content).toBe('updated text')
      expect(result.edited_timestamp).toBe('2025-01-01T00:05:00.000Z')
      expect(mockEditMessage).toHaveBeenCalledWith('ch1', 'msg1', 'updated text')
    })

    test('resolves channel name', async () => {
      await updateAction('general', 'msg1', 'new', { _credManager: manager })

      expect(mockResolveChannel).toHaveBeenCalledWith('guild1', 'general')
    })

    test('returns error on failure', async () => {
      mockEditMessage.mockImplementationOnce(() => Promise.reject(new Error('Cannot edit')))

      const result = await updateAction('general', 'msg1', 'new', { _credManager: manager })

      expect(result.error).toContain('Cannot edit')
    })
  })

  describe('deleteAction', () => {
    test('deletes message with --force', async () => {
      const result = await deleteAction('general', 'msg1', { _credManager: manager, force: true })

      expect(result.deleted).toBe('msg1')
      expect(mockDeleteMessage).toHaveBeenCalledWith('ch1', 'msg1')
    })

    test('returns error without --force', async () => {
      const result = await deleteAction('general', 'msg1', { _credManager: manager })

      expect(result.error).toBe('Use --force to confirm deletion')
      expect(mockDeleteMessage).not.toHaveBeenCalled()
    })

    test('returns error with force=false', async () => {
      const result = await deleteAction('general', 'msg1', { _credManager: manager, force: false })

      expect(result.error).toBe('Use --force to confirm deletion')
      expect(mockDeleteMessage).not.toHaveBeenCalled()
    })

    test('resolves channel name', async () => {
      await deleteAction('general', 'msg1', { _credManager: manager, force: true })

      expect(mockResolveChannel).toHaveBeenCalledWith('guild1', 'general')
    })

    test('returns error on failure', async () => {
      mockDeleteMessage.mockImplementationOnce(() => Promise.reject(new Error('Forbidden')))

      const result = await deleteAction('general', 'msg1', { _credManager: manager, force: true })

      expect(result.error).toContain('Forbidden')
    })
  })

  describe('repliesAction', () => {
    test('fetches thread messages', async () => {
      const result = await repliesAction('general', 'thread1', { _credManager: manager })

      expect(result.messages).toHaveLength(2)
      expect(mockGetMessages).toHaveBeenCalledWith('thread1', 50)
    })

    test('uses custom limit', async () => {
      await repliesAction('general', 'thread1', { _credManager: manager, limit: '25' })

      expect(mockGetMessages).toHaveBeenCalledWith('thread1', 25)
    })

    test('returns error on failure', async () => {
      mockGetMessages.mockImplementationOnce(() => Promise.reject(new Error('Thread not found')))

      const result = await repliesAction('general', 'thread999', { _credManager: manager })

      expect(result.error).toContain('Thread not found')
    })
  })
})
