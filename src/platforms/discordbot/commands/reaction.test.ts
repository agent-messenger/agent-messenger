import { beforeEach, describe, expect, it, mock } from 'bun:test'

const mockGetMessage = mock(async () => ({
  reactions: [
    { emoji: { name: '👍' }, count: 2, me: true },
    { emoji: { id: 'emoji-1', name: 'party' }, count: 1, me: false },
  ],
}))

const mockResolveChannel = mock(async (_serverId: string, channel: string) => {
  if (channel === 'nonexistent') throw new Error('Channel not found')
  return 'channel-123'
})

mock.module('../client', () => ({
  DiscordBotClient: class {
    async login() {
      return this
    }
    getMessage = mockGetMessage
    resolveChannel = mockResolveChannel
    addReaction = mock(async () => {})
    removeReaction = mock(async () => {})
  },
}))

import { DiscordBotCredentialManager } from '../credential-manager'
import { addAction, listAction, removeAction } from './reaction'
import type { BotOption } from './shared'

describe('reaction commands', () => {
  let mockCredManager: DiscordBotCredentialManager
  let options: BotOption

  beforeEach(() => {
    mockGetMessage.mockReset()
    mockGetMessage.mockResolvedValue({
      reactions: [
        { emoji: { name: '👍' }, count: 2, me: true },
        { emoji: { id: 'emoji-1', name: 'party' }, count: 1, me: false },
      ],
    })
    mockResolveChannel.mockReset()
    mockResolveChannel.mockImplementation(async (_serverId: string, channel: string) => {
      if (channel === 'nonexistent') throw new Error('Channel not found')
      return 'channel-123'
    })
    mockCredManager = {
      getCurrentServer: mock(async () => 'server-123'),
      getCredentials: mock(async () => ({ token: 'test-token' })),
    } as unknown as DiscordBotCredentialManager

    options = {
      _credManager: mockCredManager,
    }
  })

  describe('addAction', () => {
    it('adds reaction successfully', async () => {
      const result = await addAction('general', 'msg-456', '👍', {
        ...options,
        _credManager: mockCredManager,
      })

      expect(result).toBeDefined()
    })

    it('returns error when channel resolution fails', async () => {
      const result = await addAction('nonexistent', 'msg-456', '👍', options)
      expect(result.error).toBeDefined()
    })
  })

  describe('listAction', () => {
    it('returns reaction summaries for a message', async () => {
      const result = await listAction('general', 'msg-456', options)

      expect(result).toEqual({
        channel: 'channel-123',
        messageId: 'msg-456',
        reactions: [
          { emoji: { id: null, name: '👍' }, count: 2, me: true },
          { emoji: { id: 'emoji-1', name: 'party' }, count: 1, me: false },
        ],
      })
    })

    it('returns an empty list when the message has no reactions', async () => {
      mockGetMessage.mockResolvedValueOnce({ reactions: [] })
      const result = await listAction('general', 'msg-456', options)

      expect(result.reactions).toEqual([])
    })

    it('returns resolution errors without calling getMessage', async () => {
      const result = await listAction('nonexistent', 'msg-456', options)
      expect(result).toEqual({ error: 'Channel not found' })
      expect(mockGetMessage).not.toHaveBeenCalled()
    })

    it('returns a client error and confirms getMessage was called', async () => {
      mockGetMessage.mockRejectedValueOnce(new Error('Discord API unavailable'))
      const result = await listAction('general', 'msg-456', options)
      expect(result).toEqual({ error: 'Discord API unavailable' })
      expect(mockGetMessage).toHaveBeenCalledWith('channel-123', 'msg-456')
    })
  })

  describe('removeAction', () => {
    it('removes reaction successfully', async () => {
      const result = await removeAction('general', 'msg-456', '👍', {
        ...options,
        _credManager: mockCredManager,
      })

      expect(result).toBeDefined()
    })

    it('returns error when channel resolution fails', async () => {
      const result = await removeAction('nonexistent', 'msg-456', '👍', options)
      expect(result.error).toBeDefined()
    })
  })

  describe('action result structure', () => {
    it('returns success result with channel, messageId, and emoji for addAction', async () => {
      const result = await addAction('general', 'msg-456', '👍', {
        ...options,
        _credManager: mockCredManager,
      })

      if (!result.error) {
        expect(result.success).toBe(true)
        expect(result.messageId).toBe('msg-456')
        expect(result.emoji).toBe('👍')
      }
    })

    it('returns success result with channel, messageId, and emoji for removeAction', async () => {
      const result = await removeAction('general', 'msg-456', '👍', {
        ...options,
        _credManager: mockCredManager,
      })

      if (!result.error) {
        expect(result.success).toBe(true)
        expect(result.messageId).toBe('msg-456')
        expect(result.emoji).toBe('👍')
      }
    })
  })
})
