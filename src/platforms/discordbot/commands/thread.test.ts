import { afterEach, beforeEach, describe, expect, mock, it } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const mockCreateThread = mock((_channelId: string, name: string, _options?: { auto_archive_duration?: number }) =>
  Promise.resolve({
    id: 'thread-789',
    name,
    type: 11,
    parent_id: 'channel-456',
  }),
)

const mockArchiveThread = mock((_threadId: string, _archived?: boolean) =>
  Promise.resolve({
    id: 'thread-789',
    name: 'test-thread',
    archived: true,
  }),
)

const mockListThreads = mock((_guildId: string, _options?: { parentId?: string; archived?: boolean }) =>
  Promise.resolve({
    threads: [
      {
        id: 'thread-789',
        name: 'test-thread',
        type: 11,
        parent_id: 'channel-456',
        thread_metadata: { archived: false },
      },
    ],
    has_more: true,
  }),
)

const mockResolveChannel = mock((_guildId: string, channel: string) => {
  if (/^\d+$/.test(channel)) return Promise.resolve(channel)
  if (channel === 'general') return Promise.resolve('channel-456')
  return Promise.reject(new Error(`Channel not found: "${channel}"`))
})

mock.module('../client', () => ({
  DiscordBotClient: class MockDiscordBotClient {
    async login(_credentials?: any) {
      return this
    }
    createThread = mockCreateThread
    archiveThread = mockArchiveThread
    resolveChannel = mockResolveChannel
    listThreads = mockListThreads
  },
}))

import { DiscordBotCredentialManager } from '../credential-manager'
import { archiveAction, createAction, listAction } from './thread'

describe('thread commands', () => {
  let tempDir: string
  let manager: DiscordBotCredentialManager
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(async () => {
    tempDir = join(tmpdir(), `discordbot-thread-test-${Date.now()}`)
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

    mockCreateThread.mockClear()
    mockArchiveThread.mockClear()
    mockResolveChannel.mockClear()
    mockListThreads.mockClear()
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true })
    }
    process.env = originalEnv
  })

  describe('listAction', () => {
    it('lists active threads guild-wide', async () => {
      const result = await listAction(undefined, { _credManager: manager })

      expect(result.threads).toEqual([
        { id: 'thread-789', name: 'test-thread', type: 11, parent_id: 'channel-456', archived: false },
      ])
      expect(result.has_more).toBe(true)
      expect(mockListThreads).toHaveBeenCalledWith('guild1', { parentId: undefined, archived: undefined })
    })

    it('lists active threads filtered by channel', async () => {
      await listAction('general', { _credManager: manager })

      expect(mockResolveChannel).toHaveBeenCalledWith('guild1', 'general')
      expect(mockListThreads).toHaveBeenCalledWith('guild1', { parentId: 'channel-456', archived: undefined })
    })

    it('requires a channel for archived threads', async () => {
      const result = await listAction(undefined, { _credManager: manager, archived: true })

      expect(result.error).toContain('requires a channel')
      expect(mockListThreads).not.toHaveBeenCalled()
    })

    it('lists archived threads for a channel', async () => {
      await listAction('general', { _credManager: manager, archived: true })

      expect(mockListThreads).toHaveBeenCalledWith('guild1', { parentId: 'channel-456', archived: true })
    })

    it('returns client errors', async () => {
      mockListThreads.mockImplementationOnce(() => Promise.reject(new Error('API Error')))

      const result = await listAction(undefined, { _credManager: manager })

      expect(result.error).toContain('API Error')
    })
  })

  describe('createAction', () => {
    it('creates thread successfully', async () => {
      const result = await createAction('general', 'test-thread', { _credManager: manager })

      expect(result.success).toBe(true)
      expect(result.thread).toBeDefined()
      if (result.thread) {
        expect(result.thread.id).toBe('thread-789')
        expect(result.thread.name).toBe('test-thread')
        expect(result.thread.type).toBe(11)
      }
    })

    it('includes auto_archive_duration when provided', async () => {
      const result = await createAction('general', 'test-thread', {
        _credManager: manager,
        autoArchiveDuration: '60',
      })

      expect(result.success).toBe(true)
      expect(result.thread).toBeDefined()
      expect(mockCreateThread).toHaveBeenCalledWith('channel-456', 'test-thread', { auto_archive_duration: 60 })
    })

    it('resolves channel name', async () => {
      await createAction('general', 'test-thread', { _credManager: manager })

      expect(mockResolveChannel).toHaveBeenCalledWith('guild1', 'general')
    })

    it('returns error when channel resolution fails', async () => {
      const result = await createAction('nonexistent', 'test-thread', { _credManager: manager })

      expect(result.error).toContain('Channel not found')
    })

    it('returns error when thread creation fails', async () => {
      mockCreateThread.mockImplementationOnce(() => Promise.reject(new Error('API Error')))

      const result = await createAction('general', 'test-thread', { _credManager: manager })

      expect(result.error).toContain('API Error')
    })
  })

  describe('archiveAction', () => {
    it('archives thread successfully', async () => {
      const result = await archiveAction('thread-789', { _credManager: manager })

      expect(result.success).toBe(true)
      expect(result.threadId).toBe('thread-789')
      expect(mockArchiveThread).toHaveBeenCalledWith('thread-789')
    })

    it('returns error when archive fails', async () => {
      mockArchiveThread.mockImplementationOnce(() => Promise.reject(new Error('Forbidden')))

      const result = await archiveAction('thread-789', { _credManager: manager })

      expect(result.error).toContain('Forbidden')
    })
  })

  describe('action result structure', () => {
    it('createAction returns success result with thread info', async () => {
      const result = await createAction('general', 'test-thread', { _credManager: manager })

      if (!result.error) {
        expect(result.success).toBe(true)
        expect(result.thread).toBeDefined()
        if (result.thread) {
          expect(result.thread.id).toBeDefined()
          expect(result.thread.name).toBeDefined()
          expect(result.thread.type).toBeDefined()
        }
      }
    })

    it('archiveAction returns success result with threadId', async () => {
      const result = await archiveAction('thread-789', { _credManager: manager })

      if (!result.error) {
        expect(result.success).toBe(true)
        expect(result.threadId).toBeDefined()
      }
    })
  })
})
