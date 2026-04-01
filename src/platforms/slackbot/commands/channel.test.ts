import { beforeEach, describe, expect, mock, test } from 'bun:test'

const mockResolveChannel = mock((_channel: string) => Promise.resolve('C123456'))
const mockListChannels = mock(() =>
  Promise.resolve([
    {
      id: 'C123456',
      name: 'general',
      is_private: false,
      is_archived: false,
      created: 1609459200,
      creator: 'U123',
    },
    {
      id: 'C789012',
      name: 'random',
      is_private: false,
      is_archived: false,
      created: 1609459200,
      creator: 'U123',
    },
  ]),
)
const mockGetChannelInfo = mock(() =>
  Promise.resolve({
    id: 'C123456',
    name: 'general',
    is_private: false,
    is_archived: false,
    created: 1609459200,
    creator: 'U123',
    topic: { value: 'General discussion', creator: 'U123', last_set: 1609459200 },
    purpose: { value: 'Company-wide announcements', creator: 'U123', last_set: 1609459200 },
  }),
)

mock.module('../client', () => ({
  SlackBotClient: class MockSlackBotClient {
    async login(_credentials?: { token: string }) {
      return this
    }
    resolveChannel = mockResolveChannel
    listChannels = mockListChannels
    getChannelInfo = mockGetChannelInfo
  },
}))

import { SlackBotClient } from '../client'

describe('channel commands', () => {
  beforeEach(() => {
    mockResolveChannel.mockClear()
    mockListChannels.mockClear()
    mockGetChannelInfo.mockClear()
  })

  describe('listChannels', () => {
    test('returns list of channels', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const channels = await client.listChannels()

      // then
      expect(channels).toHaveLength(2)
      expect(channels[0].name).toBe('general')
      expect(channels[1].name).toBe('random')
    })

    test('includes channel metadata', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const channels = await client.listChannels()
      const channel = channels[0]

      // then
      expect(channel.id).toBeDefined()
      expect(channel.name).toBeDefined()
      expect(channel.is_private).toBe(false)
      expect(channel.is_archived).toBe(false)
      expect(channel.created).toBeDefined()
    })

    test('passes limit option', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      await client.listChannels({ limit: 50 })

      // then
      expect(mockListChannels).toHaveBeenCalledWith({ limit: 50 })
    })
  })

  describe('getChannelInfo', () => {
    test('returns channel details', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const channel = await client.getChannelInfo('C123456')

      // then
      expect(channel.id).toBe('C123456')
      expect(channel.name).toBe('general')
      expect(channel.is_private).toBe(false)
    })

    test('includes topic and purpose', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const channel = await client.getChannelInfo('C123456')

      // then
      expect(channel.topic?.value).toBe('General discussion')
      expect(channel.purpose?.value).toBe('Company-wide announcements')
    })
  })

  describe('resolveChannel', () => {
    test('resolves channel name to ID', async () => {
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
