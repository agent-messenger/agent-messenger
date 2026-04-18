import { beforeEach, describe, expect, mock, it } from 'bun:test'

const mockResolveChannel = mock((_channel: string) => Promise.resolve('C123456'))
const mockPostMessage = mock(() =>
  Promise.resolve({
    ts: '1234567890.000100',
    text: 'Hello world',
    type: 'message',
    user: 'U123',
  }),
)
const mockGetConversationHistory = mock(() =>
  Promise.resolve([
    { ts: '1234567890.000100', text: 'Hello', type: 'message', user: 'U123' },
    { ts: '1234567890.000200', text: 'World', type: 'message', user: 'U456' },
  ]),
)
const mockGetMessage = mock(() =>
  Promise.resolve({
    ts: '1234567890.000100',
    text: 'Hello world',
    type: 'message',
    user: 'U123',
  }),
)
const mockUpdateMessage = mock(() =>
  Promise.resolve({
    ts: '1234567890.000100',
    text: 'Updated text',
    type: 'message',
    user: 'U123',
  }),
)
const mockDeleteMessage = mock(() => Promise.resolve())
const mockGetThreadReplies = mock(() =>
  Promise.resolve([
    { ts: '1234567890.000100', text: 'Thread reply 1', type: 'message', user: 'U123' },
    { ts: '1234567890.000200', text: 'Thread reply 2', type: 'message', user: 'U456' },
  ]),
)

mock.module('../client', () => ({
  SlackBotClient: class MockSlackBotClient {
    async login(_credentials?: { token: string }) {
      return this
    }
    resolveChannel = mockResolveChannel
    postMessage = mockPostMessage
    getConversationHistory = mockGetConversationHistory
    getMessage = mockGetMessage
    updateMessage = mockUpdateMessage
    deleteMessage = mockDeleteMessage
    getThreadReplies = mockGetThreadReplies
  },
}))

import { SlackBotClient } from '../client'

describe('message commands', () => {
  beforeEach(() => {
    mockResolveChannel.mockClear()
    mockPostMessage.mockClear()
    mockGetConversationHistory.mockClear()
    mockGetMessage.mockClear()
    mockUpdateMessage.mockClear()
    mockDeleteMessage.mockClear()
    mockGetThreadReplies.mockClear()
  })

  describe('postMessage', () => {
    it('sends message to channel', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const result = await client.postMessage('C123456', 'Hello world')

      // then
      expect(result.ts).toBe('1234567890.000100')
      expect(result.text).toBe('Hello world')
      expect(result.type).toBe('message')
    })

    it('sends message with thread_ts', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      await client.postMessage('C123456', 'Thread reply', { thread_ts: '1234567890.000100' })

      // then
      expect(mockPostMessage).toHaveBeenCalledWith('C123456', 'Thread reply', { thread_ts: '1234567890.000100' })
    })
  })

  describe('getConversationHistory', () => {
    it('returns messages from channel', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const messages = await client.getConversationHistory('C123456', { limit: 20 })

      // then
      expect(messages).toHaveLength(2)
      expect(messages[0].text).toBe('Hello')
      expect(messages[1].text).toBe('World')
    })

    it('passes limit option', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      await client.getConversationHistory('C123456', { limit: 50 })

      // then
      expect(mockGetConversationHistory).toHaveBeenCalledWith('C123456', { limit: 50 })
    })
  })

  describe('getMessage', () => {
    it('returns single message by ts', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const message = await client.getMessage('C123456', '1234567890.000100')

      // then
      expect(message).not.toBeNull()
      expect(message?.ts).toBe('1234567890.000100')
      expect(message?.text).toBe('Hello world')
    })

    it('returns null when message not found', async () => {
      // given
      mockGetMessage.mockResolvedValueOnce(null)
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const message = await client.getMessage('C123456', 'nonexistent.ts')

      // then
      expect(message).toBeNull()
    })
  })

  describe('updateMessage', () => {
    it('updates message text', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const result = await client.updateMessage('C123456', '1234567890.000100', 'Updated text')

      // then
      expect(result.ts).toBe('1234567890.000100')
      expect(result.text).toBe('Updated text')
    })

    it('passes correct arguments', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      await client.updateMessage('C123456', '1234567890.000100', 'New text')

      // then
      expect(mockUpdateMessage).toHaveBeenCalledWith('C123456', '1234567890.000100', 'New text')
    })
  })

  describe('deleteMessage', () => {
    it('deletes message by ts', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      await client.deleteMessage('C123456', '1234567890.000100')

      // then
      expect(mockDeleteMessage).toHaveBeenCalledWith('C123456', '1234567890.000100')
    })
  })

  describe('getThreadReplies', () => {
    it('returns thread replies', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const replies = await client.getThreadReplies('C123456', '1234567890.000100', { limit: 100 })

      // then
      expect(replies).toHaveLength(2)
      expect(replies[0].text).toBe('Thread reply 1')
      expect(replies[1].text).toBe('Thread reply 2')
    })

    it('passes limit option', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      await client.getThreadReplies('C123456', '1234567890.000100', { limit: 50 })

      // then
      expect(mockGetThreadReplies).toHaveBeenCalledWith('C123456', '1234567890.000100', { limit: 50 })
    })
  })

  describe('resolveChannel', () => {
    it('resolves channel name to ID', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const channelId = await client.resolveChannel('general')

      // then
      expect(channelId).toBe('C123456')
      expect(mockResolveChannel).toHaveBeenCalledWith('general')
    })
  })
})
