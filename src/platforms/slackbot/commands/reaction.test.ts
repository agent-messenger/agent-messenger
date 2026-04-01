import { beforeEach, describe, expect, mock, test } from 'bun:test'

const mockResolveChannel = mock((_channel: string) => Promise.resolve('C123456'))
const mockAddReaction = mock(() => Promise.resolve())
const mockRemoveReaction = mock(() => Promise.resolve())

mock.module('../client', () => ({
  SlackBotClient: class MockSlackBotClient {
    async login(_credentials?: { token: string }) {
      return this
    }
    resolveChannel = mockResolveChannel
    addReaction = mockAddReaction
    removeReaction = mockRemoveReaction
  },
}))

import { SlackBotClient } from '../client'

describe('reaction commands', () => {
  beforeEach(() => {
    mockResolveChannel.mockClear()
    mockAddReaction.mockClear()
    mockRemoveReaction.mockClear()
  })

  describe('addReaction', () => {
    test('adds emoji reaction to message', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      await client.addReaction('C123456', '1234567890.000100', 'thumbsup')

      // then
      expect(mockAddReaction).toHaveBeenCalledWith('C123456', '1234567890.000100', 'thumbsup')
    })

    test('called with correct arguments', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      await client.addReaction('C123456', '1234567890.000200', 'heart')

      // then
      expect(mockAddReaction).toHaveBeenCalledTimes(1)
      expect(mockAddReaction).toHaveBeenCalledWith('C123456', '1234567890.000200', 'heart')
    })
  })

  describe('removeReaction', () => {
    test('removes emoji reaction from message', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      await client.removeReaction('C123456', '1234567890.000100', 'thumbsup')

      // then
      expect(mockRemoveReaction).toHaveBeenCalledWith('C123456', '1234567890.000100', 'thumbsup')
    })

    test('called with correct arguments', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      await client.removeReaction('C123456', '1234567890.000200', 'wave')

      // then
      expect(mockRemoveReaction).toHaveBeenCalledTimes(1)
      expect(mockRemoveReaction).toHaveBeenCalledWith('C123456', '1234567890.000200', 'wave')
    })
  })

  describe('resolveChannel', () => {
    test('resolves channel name before reaction', async () => {
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
