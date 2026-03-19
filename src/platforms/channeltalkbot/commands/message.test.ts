import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const mockSendUserChatMessage = mock(() =>
  Promise.resolve({
    id: 'msg1',
    chatId: 'chat1',
    chatType: 'userChat',
    personType: 'bot' as const,
    personId: 'bot1',
    createdAt: 1234567890,
    plainText: 'Hello world',
  }),
)

const mockSendGroupMessage = mock(() =>
  Promise.resolve({
    id: 'msg2',
    chatId: 'grp1',
    chatType: 'group',
    personType: 'bot' as const,
    personId: 'bot1',
    createdAt: 1234567890,
    plainText: 'Hello group',
  }),
)

const mockGetUserChatMessages = mock(() =>
  Promise.resolve([
    {
      id: 'msg1',
      chatId: 'chat1',
      chatType: 'userChat',
      personType: 'manager' as const,
      personId: 'mgr1',
      createdAt: 1234567890,
      plainText: 'Hello',
    },
  ]),
)

const mockGetGroupMessages = mock(() =>
  Promise.resolve([
    {
      id: 'msg2',
      chatId: 'grp1',
      chatType: 'group',
      personType: 'manager' as const,
      personId: 'mgr1',
      createdAt: 1234567890,
      plainText: 'Group message',
    },
  ]),
)

let capturedSendUserChatArgs: unknown[] = []
let _capturedSendGroupArgs: unknown[] = []
let capturedGetUserChatMsgArgs: unknown[] = []

mock.module('../client', () => ({
  ChannelBotClient: class MockChannelBotClient {
    sendUserChatMessage = (...args: unknown[]) => {
      capturedSendUserChatArgs = args
      return mockSendUserChatMessage()
    }
    sendGroupMessage = (...args: unknown[]) => {
      _capturedSendGroupArgs = args
      return mockSendGroupMessage()
    }
    resolveGroup = (groupIdOrName: string) => {
      const id = groupIdOrName.startsWith('@') ? 'grp1' : groupIdOrName
      return Promise.resolve({ id, channelId: 'ch1', name: groupIdOrName.replace('@', '') })
    }
    getUserChatMessages = (...args: unknown[]) => {
      capturedGetUserChatMsgArgs = args
      return mockGetUserChatMessages()
    }
    getGroupMessages = mockGetGroupMessages
  },
}))

mock.module('./shared', () => ({
  getClient: async () => new (await import('../client')).ChannelBotClient('key', 'secret'),
  getDefaultBotName: async (opts: { bot?: string }) => opts.bot || undefined,
  getCurrentWorkspace: async () => 'ws1',
}))

import { ChannelBotCredentialManager } from '../credential-manager'
import { getAction, listAction, sendAction } from './message'

describe('message commands', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = join(tmpdir(), `channelbot-msg-test-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })
    capturedSendUserChatArgs = []
    _capturedSendGroupArgs = []
    capturedGetUserChatMsgArgs = []
    mockSendUserChatMessage.mockClear()
    mockSendGroupMessage.mockClear()
    mockGetUserChatMessages.mockClear()
    mockGetGroupMessages.mockClear()
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true })
    }
  })

  describe('sendAction', () => {
    test('sends to userchat and wraps text in blocks', async () => {
      const manager = new ChannelBotCredentialManager(tempDir)
        const result = await sendAction('chat1', 'Hello world', { type: 'userchat', _credManager: manager })

        expect(result.error).toBeUndefined()
        expect(result.id).toBe('msg1')
        expect(capturedSendUserChatArgs[1]).toEqual([{ type: 'text', value: 'Hello world' }])
      })

    test('sends to group when type=group', async () => {
      const manager = new ChannelBotCredentialManager(tempDir)
      const result = await sendAction('grp1', 'Hello group', { type: 'group', _credManager: manager })

      expect(result.error).toBeUndefined()
      expect(result.id).toBe('msg2')
      expect(mockSendGroupMessage).toHaveBeenCalledTimes(1)
    })

    test('includes botName in request when --bot provided', async () => {
      const manager = new ChannelBotCredentialManager(tempDir)
      await sendAction('chat1', 'Hello', { type: 'userchat', bot: 'my-bot', _credManager: manager })

      expect(capturedSendUserChatArgs[2]).toBe('my-bot')
    })

    test('auto-detects group target from @ prefix', async () => {
      const manager = new ChannelBotCredentialManager(tempDir)
      await sendAction('@team', 'Hello', { _credManager: manager })

      expect(mockSendGroupMessage).toHaveBeenCalledTimes(1)
    })
  })

  describe('listAction', () => {
    test('lists userchat messages', async () => {
      const manager = new ChannelBotCredentialManager(tempDir)
      const result = await listAction('chat1', { type: 'userchat', _credManager: manager })

      expect(result.error).toBeUndefined()
      expect(result.messages).toHaveLength(1)
      expect(result.messages?.[0].id).toBe('msg1')
    })

    test('lists group messages when type=group', async () => {
      const manager = new ChannelBotCredentialManager(tempDir)
      const result = await listAction('grp1', { type: 'group', _credManager: manager })

      expect(result.error).toBeUndefined()
      expect(result.messages).toHaveLength(1)
      expect(result.messages?.[0].id).toBe('msg2')
    })

    test('passes pagination params', async () => {
      const manager = new ChannelBotCredentialManager(tempDir)
      await listAction('chat1', { type: 'userchat', limit: '10', sort: 'asc', since: 'cursor123', _credManager: manager })

      expect(capturedGetUserChatMsgArgs[0]).toBe('chat1')
      expect(capturedGetUserChatMsgArgs[1]).toMatchObject({ limit: 10, sortOrder: 'asc', since: 'cursor123' })
    })
  })

  describe('getAction', () => {
    test('returns specific message by ID', async () => {
      const manager = new ChannelBotCredentialManager(tempDir)
      const result = await getAction('chat1', 'msg1', { type: 'userchat', _credManager: manager })

      expect(result.error).toBeUndefined()
      expect(result.id).toBe('msg1')
    })

    test('returns error when message not found', async () => {
      const manager = new ChannelBotCredentialManager(tempDir)
      const result = await getAction('chat1', 'nonexistent', { type: 'userchat', _credManager: manager })

      expect(result.error).toBeDefined()
      expect(result.error).toContain('not found')
    })
  })
})
