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

const mockListUserChats = mock(() =>
  Promise.resolve([
    { id: 'chat1', channelId: 'ch1', name: 'Customer A', state: 'opened' as const },
    { id: 'chat2', channelId: 'ch1', name: 'Customer B', state: 'opened' as const },
  ]),
)

let capturedSendUserChatArgs: unknown[] = []
let _capturedSendGroupArgs: unknown[] = []
let capturedGetUserChatMsgArgs: unknown[] = []

mock.module('../client', () => ({
  ChannelBotClient: class MockChannelBotClient {
    static wrapTextInBlocks(text: string) {
      return [{ type: 'text', content: [{ type: 'plain', attrs: { text } }] }]
    }
    static extractText(msg: { blocks?: Array<{ type: string; content?: Array<{ type: string; attrs?: { text?: string } }>; value?: string }>; plainText?: string }) {
      const parts: string[] = []
      for (const block of msg.blocks ?? []) {
        if (block.content) {
          for (const inline of block.content) {
            if (inline.attrs?.text) parts.push(inline.attrs.text)
          }
        } else if (block.value) {
          parts.push(block.value)
        }
      }
      if (msg.plainText) parts.push(msg.plainText)
      return parts.join('\n')
    }
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
    listUserChats = mockListUserChats
  },
}))

mock.module('./shared', () => ({
  getClient: async () => new (await import('../client')).ChannelBotClient('key', 'secret'),
  getDefaultBotName: async (opts: { bot?: string }) => opts.bot || undefined,
  getCurrentWorkspace: async () => 'ws1',
}))

import { ChannelBotCredentialManager } from '../credential-manager'
import { getAction, listAction, searchAction, sendAction } from './message'

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
    mockListUserChats.mockClear()
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
      expect(capturedSendUserChatArgs[1]).toEqual([{ type: 'text', content: [{ type: 'plain', attrs: { text: 'Hello world' } }] }])
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

  describe('searchAction', () => {
    const searchMsg = (overrides: Record<string, unknown> = {}) => ({
      id: 'msg-a',
      chatId: 'chat1',
      chatType: 'userChat',
      personType: 'manager' as const,
      personId: 'mgr1',
      createdAt: 1000,
      plainText: '',
      ...overrides,
    })

    test('finds messages matching query across chats', async () => {
      // given
      mockGetUserChatMessages.mockImplementation(() =>
        Promise.resolve([
          searchMsg({ id: 'msg-a', plainText: '리뷰 부탁드립니다' }),
          searchMsg({ id: 'msg-b', personType: 'manager' as const, personId: 'mgr1', createdAt: 2000, plainText: '확인했습니다' }),
        ]),
      )

      // when
      const result = await searchAction('리뷰', { state: 'opened', _credManager: new ChannelBotCredentialManager(tempDir) })

      // then
      expect(result.error).toBeUndefined()
      expect(result.total_results).toBe(2)
      expect(result.results).toHaveLength(2)
      expect(result.results?.[0].plain_text).toContain('리뷰')
    })

    test('returns empty results when no matches', async () => {
      // given
      mockGetUserChatMessages.mockImplementation(() =>
        Promise.resolve([searchMsg({ plainText: 'No match here' })]),
      )

      // when
      const result = await searchAction('리뷰', { state: 'opened', _credManager: new ChannelBotCredentialManager(tempDir) })

      // then
      expect(result.error).toBeUndefined()
      expect(result.total_results).toBe(0)
      expect(result.results).toHaveLength(0)
    })

    test('searches case-insensitively', async () => {
      // given
      mockGetUserChatMessages.mockImplementation(() =>
        Promise.resolve([searchMsg({ plainText: 'Please REVIEW this' })]),
      )

      // when
      const result = await searchAction('review', { state: 'opened', _credManager: new ChannelBotCredentialManager(tempDir) })

      // then
      expect(result.total_results).toBe(2)
    })

    test('respects limit option', async () => {
      // given
      mockGetUserChatMessages.mockImplementation(() =>
        Promise.resolve([
          searchMsg({ id: 'msg-1', plainText: 'review 1', createdAt: 1000 }),
          searchMsg({ id: 'msg-2', plainText: 'review 2', createdAt: 2000 }),
          searchMsg({ id: 'msg-3', plainText: 'review 3', createdAt: 3000 }),
        ]),
      )

      // when
      const result = await searchAction('review', { limit: '2', state: 'opened', _credManager: new ChannelBotCredentialManager(tempDir) })

      // then
      expect(result.results).toHaveLength(2)
    })

    test('includes chat_id and chat_name in results', async () => {
      // given
      mockGetUserChatMessages.mockImplementation(() =>
        Promise.resolve([searchMsg({ plainText: 'review this' })]),
      )

      // when
      const result = await searchAction('review', { state: 'opened', _credManager: new ChannelBotCredentialManager(tempDir) })

      // then
      expect(result.results?.[0].chat_id).toBe('chat1')
      expect(result.results?.[0].chat_name).toBe('Customer A')
    })

    test('searches with specific state filter', async () => {
      // given
      mockGetUserChatMessages.mockImplementation(() =>
        Promise.resolve([searchMsg({ plainText: 'review' })]),
      )

      // when
      await searchAction('review', { state: 'opened', _credManager: new ChannelBotCredentialManager(tempDir) })

      // then
      expect(mockListUserChats).toHaveBeenCalledTimes(1)
    })

    test('searches all states by default', async () => {
      // given
      mockGetUserChatMessages.mockImplementation(() => Promise.resolve([]))

      // when
      await searchAction('review', { _credManager: new ChannelBotCredentialManager(tempDir) })

      // then
      expect(mockListUserChats).toHaveBeenCalledTimes(3)
    })

    test('matches text from blocks when plainText is empty', async () => {
      // given
      mockGetUserChatMessages.mockImplementation(() =>
        Promise.resolve([searchMsg({ plainText: undefined, blocks: [{ type: 'text', content: [{ type: 'plain', attrs: { text: '리뷰 요청합니다' } }] }] })]),
      )

      // when
      const result = await searchAction('리뷰', { state: 'opened', _credManager: new ChannelBotCredentialManager(tempDir) })

      // then
      expect(result.total_results).toBe(2)
    })
  })
})
