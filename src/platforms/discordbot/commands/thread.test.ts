import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
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

const mockResolveChannel = mock((_guildId: string, channel: string) => {
  if (/^\d+$/.test(channel)) return Promise.resolve(channel)
  if (channel === 'general') return Promise.resolve('channel-456')
  return Promise.reject(new Error(`Channel not found: "${channel}"`))
})

mock.module('../client', () => ({
  DiscordBotClient: class MockDiscordBotClient {
    constructor(token: string) {
      if (!token) throw new Error('Token is required')
    }
    createThread = mockCreateThread
    archiveThread = mockArchiveThread
    resolveChannel = mockResolveChannel
  },
}))

import { DiscordBotCredentialManager } from '../credential-manager'
import { archiveAction, createAction } from './thread'

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
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true })
    }
    process.env = originalEnv
  })

  describe('createAction', () => {
    test('creates thread successfully', async () => {
      const result = await createAction('general', 'test-thread', { _credManager: manager })

      expect(result.success).toBe(true)
      expect(result.thread).toBeDefined()
      if (result.thread) {
        expect(result.thread.id).toBe('thread-789')
        expect(result.thread.name).toBe('test-thread')
        expect(result.thread.type).toBe(11)
      }
    })

    test('includes auto_archive_duration when provided', async () => {
      const result = await createAction('general', 'test-thread', {
        _credManager: manager,
        autoArchiveDuration: '60',
      })

      expect(result.success).toBe(true)
      expect(result.thread).toBeDefined()
      expect(mockCreateThread).toHaveBeenCalledWith('channel-456', 'test-thread', { auto_archive_duration: 60 })
    })

    test('resolves channel name', async () => {
      await createAction('general', 'test-thread', { _credManager: manager })

      expect(mockResolveChannel).toHaveBeenCalledWith('guild1', 'general')
    })

    test('returns error when channel resolution fails', async () => {
      const result = await createAction('nonexistent', 'test-thread', { _credManager: manager })

      expect(result.error).toContain('Channel not found')
    })

    test('returns error when thread creation fails', async () => {
      mockCreateThread.mockImplementationOnce(() => Promise.reject(new Error('API Error')))

      const result = await createAction('general', 'test-thread', { _credManager: manager })

      expect(result.error).toContain('API Error')
    })
  })

  describe('archiveAction', () => {
    test('archives thread successfully', async () => {
      const result = await archiveAction('thread-789', { _credManager: manager })

      expect(result.success).toBe(true)
      expect(result.threadId).toBe('thread-789')
      expect(mockArchiveThread).toHaveBeenCalledWith('thread-789')
    })

    test('returns error when archive fails', async () => {
      mockArchiveThread.mockImplementationOnce(() => Promise.reject(new Error('Forbidden')))

      const result = await archiveAction('thread-789', { _credManager: manager })

      expect(result.error).toContain('Forbidden')
    })
  })

  describe('action result structure', () => {
    test('createAction returns success result with thread info', async () => {
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

    test('archiveAction returns success result with threadId', async () => {
      const result = await archiveAction('thread-789', { _credManager: manager })

      if (!result.error) {
        expect(result.success).toBe(true)
        expect(result.threadId).toBeDefined()
      }
    })
  })
})
