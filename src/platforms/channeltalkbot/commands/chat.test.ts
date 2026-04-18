import { afterEach, beforeEach, describe, expect, mock, it } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const mockListUserChats = mock(() =>
  Promise.resolve([
    {
      id: 'chat1',
      channelId: 'ch1',
      name: 'Customer Chat',
      state: 'opened' as const,
      managerId: 'mgr1',
      userId: 'user1',
      createdAt: 1234567890,
      updatedAt: 1234567900,
    },
  ]),
)

const mockGetUserChat = mock(() =>
  Promise.resolve({
    id: 'chat1',
    channelId: 'ch1',
    name: 'Customer Chat',
    state: 'opened' as const,
    managerId: 'mgr1',
    userId: 'user1',
    createdAt: 1234567890,
    updatedAt: 1234567900,
  }),
)

const mockCloseUserChat = mock(() =>
  Promise.resolve({
    id: 'chat1',
    channelId: 'ch1',
    state: 'closed' as const,
    createdAt: 1234567890,
    updatedAt: 1234567900,
  }),
)

const mockDeleteUserChat = mock(() => Promise.resolve(undefined))

let capturedListArgs: unknown[] = []
let capturedCloseArgs: unknown[] = []

mock.module('../client', () => ({
  ChannelBotClient: class MockChannelBotClient {
    listUserChats = (...args: unknown[]) => {
      capturedListArgs = args
      return mockListUserChats()
    }
    getUserChat = mockGetUserChat
    closeUserChat = (...args: unknown[]) => {
      capturedCloseArgs = args
      return mockCloseUserChat()
    }
    deleteUserChat = mockDeleteUserChat
  },
}))

mock.module('./shared', () => ({
  getClient: async () => new (await import('../client')).ChannelBotClient('key', 'secret'),
  getDefaultBotName: async (opts: { bot?: string }) => opts.bot || undefined,
  getCurrentWorkspace: async () => 'ws1',
}))

import { ChannelBotCredentialManager } from '../credential-manager'
import { closeAction, deleteAction, getAction, listAction } from './chat'

describe('chat commands', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = join(tmpdir(), `channelbot-chat-test-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })
    capturedListArgs = []
    capturedCloseArgs = []
    mockListUserChats.mockClear()
    mockGetUserChat.mockClear()
    mockCloseUserChat.mockClear()
    mockDeleteUserChat.mockClear()
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true })
    }
  })

  describe('listAction', () => {
    it('lists opened chats by default', async () => {
      const manager = new ChannelBotCredentialManager(tempDir)
      const result = await listAction({ _credManager: manager })

      expect(result.error).toBeUndefined()
      expect(result.chats).toHaveLength(1)
      expect(result.chats?.[0].id).toBe('chat1')
      expect(capturedListArgs[0]).toMatchObject({ state: 'opened' })
    })

    it('passes state filter to API', async () => {
      const manager = new ChannelBotCredentialManager(tempDir)
      await listAction({ state: 'closed', _credManager: manager })

      expect(capturedListArgs[0]).toMatchObject({ state: 'closed' })
    })

    it('passes pagination params', async () => {
      const manager = new ChannelBotCredentialManager(tempDir)
      await listAction({ limit: '10', sort: 'asc', since: 'cursor123', _credManager: manager })

      expect(capturedListArgs[0]).toMatchObject({ limit: 10, sortOrder: 'asc', since: 'cursor123' })
    })
  })

  describe('getAction', () => {
    it('returns specific chat', async () => {
      const manager = new ChannelBotCredentialManager(tempDir)
      const result = await getAction('chat1', { _credManager: manager })

      expect(result.error).toBeUndefined()
      expect(result.id).toBe('chat1')
      expect(result.state).toBe('opened')
    })
  })

  describe('closeAction', () => {
    it('closes chat with bot name', async () => {
      const manager = new ChannelBotCredentialManager(tempDir)
      const result = await closeAction('chat1', { bot: 'my-bot', _credManager: manager })

      expect(result.error).toBeUndefined()
      expect(result.success).toBe(true)
      expect(capturedCloseArgs[1]).toBe('my-bot')
    })

    it('returns error when no bot name provided', async () => {
      const manager = new ChannelBotCredentialManager(tempDir)
      const result = await closeAction('chat1', { _credManager: manager })

      expect(result.error).toBeDefined()
      expect(result.error).toContain('Bot name is required')
    })
  })

  describe('deleteAction', () => {
    it('deletes chat with --force flag', async () => {
      const manager = new ChannelBotCredentialManager(tempDir)
      const result = await deleteAction('chat1', { force: true, _credManager: manager })

      expect(result.error).toBeUndefined()
      expect(result.success).toBe(true)
      expect(result.deleted).toBe('chat1')
    })

    it('returns error without --force flag', async () => {
      const manager = new ChannelBotCredentialManager(tempDir)
      const result = await deleteAction('chat1', { _credManager: manager })

      expect(result.error).toBeDefined()
      expect(result.error).toContain('--force')
    })
  })
})
