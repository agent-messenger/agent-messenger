import { beforeEach, describe, expect, mock, test } from 'bun:test'

import { SlackBotClient } from './client'
import { SlackBotError } from './types'

// Mock the @slack/web-api module
const mockAuth = {
  test: mock(() =>
    Promise.resolve({
      ok: true,
      user_id: 'U123',
      team_id: 'T456',
      bot_id: 'B789',
      user: 'testbot',
      team: 'Test Team',
    }),
  ),
}
const mockConversations = {
  list: mock(() =>
    Promise.resolve({
      ok: true,
      channels: [
        {
          id: 'C123',
          name: 'general',
          is_private: false,
          is_archived: false,
          created: 1234567890,
          creator: 'U001',
        },
      ],
    }),
  ),
  info: mock(() =>
    Promise.resolve({
      ok: true,
      channel: {
        id: 'C123',
        name: 'general',
        is_private: false,
        is_archived: false,
        created: 1234567890,
        creator: 'U001',
      },
    }),
  ),
  history: mock(() =>
    Promise.resolve({
      ok: true,
      messages: [{ ts: '1234567890.123456', text: 'Hello', type: 'message', user: 'U123' }],
    }),
  ),
}
const mockChat = {
  postMessage: mock(() =>
    Promise.resolve({
      ok: true,
      ts: '1234567890.123456',
      message: { text: 'Hello', type: 'message' },
    }),
  ),
}
const mockReactions = {
  add: mock(() => Promise.resolve({ ok: true })),
  remove: mock(() => Promise.resolve({ ok: true })),
}
const mockUsers = {
  list: mock(() =>
    Promise.resolve({
      ok: true,
      members: [
        {
          id: 'U123',
          name: 'testuser',
          real_name: 'Test User',
          is_admin: false,
          is_owner: false,
          is_bot: false,
          is_app_user: false,
        },
      ],
    }),
  ),
  info: mock(() =>
    Promise.resolve({
      ok: true,
      user: {
        id: 'U123',
        name: 'testuser',
        real_name: 'Test User',
        is_admin: false,
        is_owner: false,
        is_bot: false,
        is_app_user: false,
      },
    }),
  ),
}

mock.module('@slack/web-api', () => ({
  WebClient: class MockWebClient {
    auth = mockAuth
    conversations = mockConversations
    chat = mockChat
    reactions = mockReactions
    users = mockUsers
  },
}))

describe('SlackBotClient', () => {
  beforeEach(() => {
    // Reset mocks
    mockAuth.test.mockClear()
    mockConversations.list.mockClear()
    mockConversations.info.mockClear()
    mockConversations.history.mockClear()
    mockChat.postMessage.mockClear()
    mockReactions.add.mockClear()
    mockReactions.remove.mockClear()
    mockUsers.list.mockClear()
    mockUsers.info.mockClear()
  })

  describe('constructor', () => {
    test('accepts bot tokens (xoxb-)', () => {
      // when/then: should not throw
      const client = new SlackBotClient('xoxb-test-token')
      expect(client).toBeDefined()
    })

    test('rejects user tokens (xoxp-)', () => {
      // when/then
      expect(() => new SlackBotClient('xoxp-user-token')).toThrow(SlackBotError)
    })

    test('rejects empty token', () => {
      // when/then
      expect(() => new SlackBotClient('')).toThrow(SlackBotError)
    })

    test('rejects non-bot tokens', () => {
      // when/then
      expect(() => new SlackBotClient('invalid-token')).toThrow(SlackBotError)
    })
  })

  describe('testAuth', () => {
    test('returns auth info for valid token', async () => {
      // given
      const client = new SlackBotClient('xoxb-test-token')

      // when
      const result = await client.testAuth()

      // then
      expect(result.user_id).toBe('U123')
      expect(result.team_id).toBe('T456')
      expect(result.bot_id).toBe('B789')
    })
  })

  describe('postMessage', () => {
    test('sends message and returns timestamp', async () => {
      // given
      const client = new SlackBotClient('xoxb-test-token')

      // when
      const result = await client.postMessage('C123', 'Hello')

      // then
      expect(result.ts).toBe('1234567890.123456')
      expect(result.text).toBe('Hello')
    })
  })

  describe('getConversationHistory', () => {
    test('returns messages', async () => {
      // given
      const client = new SlackBotClient('xoxb-test-token')

      // when
      const messages = await client.getConversationHistory('C123')

      // then
      expect(messages.length).toBeGreaterThan(0)
      expect(messages[0].ts).toBe('1234567890.123456')
    })
  })

  describe('getMessage', () => {
    test('returns single message', async () => {
      // given
      const client = new SlackBotClient('xoxb-test-token')

      // when
      const message = await client.getMessage('C123', '1234567890.123456')

      // then
      expect(message).not.toBeNull()
      expect(message?.ts).toBe('1234567890.123456')
    })
  })

  describe('addReaction', () => {
    test('adds reaction to message', async () => {
      // given
      const client = new SlackBotClient('xoxb-test-token')

      // when/then: should not throw
      await client.addReaction('C123', '1234567890.123456', 'thumbsup')
      expect(mockReactions.add).toHaveBeenCalled()
    })
  })

  describe('removeReaction', () => {
    test('removes reaction from message', async () => {
      // given
      const client = new SlackBotClient('xoxb-test-token')

      // when/then: should not throw
      await client.removeReaction('C123', '1234567890.123456', 'thumbsup')
      expect(mockReactions.remove).toHaveBeenCalled()
    })
  })

  describe('listChannels', () => {
    test('returns list of channels', async () => {
      // given
      const client = new SlackBotClient('xoxb-test-token')

      // when
      const channels = await client.listChannels()

      // then
      expect(channels.length).toBeGreaterThan(0)
      expect(channels[0].id).toBe('C123')
      expect(channels[0].name).toBe('general')
    })
  })

  describe('getChannelInfo', () => {
    test('returns channel details', async () => {
      // given
      const client = new SlackBotClient('xoxb-test-token')

      // when
      const channel = await client.getChannelInfo('C123')

      // then
      expect(channel.id).toBe('C123')
      expect(channel.name).toBe('general')
    })
  })

  describe('resolveChannel', () => {
    test('returns channel ID unchanged when it starts with C', async () => {
      // given
      const client = new SlackBotClient('xoxb-test-token')

      // when
      const channel = await client.resolveChannel('C123ABC')

      // then
      expect(channel).toBe('C123ABC')
      expect(mockConversations.list).not.toHaveBeenCalled()
    })

    test('returns channel ID unchanged when it starts with D', async () => {
      // given
      const client = new SlackBotClient('xoxb-test-token')

      // when
      const channel = await client.resolveChannel('D123ABC')

      // then
      expect(channel).toBe('D123ABC')
      expect(mockConversations.list).not.toHaveBeenCalled()
    })

    test('returns channel ID unchanged when it starts with G', async () => {
      // given
      const client = new SlackBotClient('xoxb-test-token')

      // when
      const channel = await client.resolveChannel('G123ABC')

      // then
      expect(channel).toBe('G123ABC')
      expect(mockConversations.list).not.toHaveBeenCalled()
    })

    test('resolves channel name to ID', async () => {
      // given
      const client = new SlackBotClient('xoxb-test-token')

      // when
      const channel = await client.resolveChannel('general')

      // then
      expect(channel).toBe('C123')
      expect(mockConversations.list).toHaveBeenCalled()
    })

    test('strips leading # from channel name', async () => {
      // given
      const client = new SlackBotClient('xoxb-test-token')

      // when
      const channel = await client.resolveChannel('#general')

      // then
      expect(channel).toBe('C123')
      expect(mockConversations.list).toHaveBeenCalled()
    })

    test('returns channel ID unchanged when input is #C prefixed ID', async () => {
      // given
      const client = new SlackBotClient('xoxb-test-token')

      // when
      const channel = await client.resolveChannel('#C123ABC')

      // then
      expect(channel).toBe('C123ABC')
    })

    test('throws channel_not_found error when name is not found', async () => {
      // given
      const client = new SlackBotClient('xoxb-test-token')

      // when/then
      try {
        await client.resolveChannel('does-not-exist')
        throw new Error('Expected resolveChannel to throw')
      } catch (error) {
        expect(error).toBeInstanceOf(SlackBotError)
        expect((error as SlackBotError).code).toBe('channel_not_found')
      }
    })
  })

  describe('listUsers', () => {
    test('returns list of users', async () => {
      // given
      const client = new SlackBotClient('xoxb-test-token')

      // when
      const users = await client.listUsers()

      // then
      expect(users.length).toBeGreaterThan(0)
      expect(users[0].id).toBe('U123')
    })
  })

  describe('getUserInfo', () => {
    test('returns user details', async () => {
      // given
      const client = new SlackBotClient('xoxb-test-token')

      // when
      const user = await client.getUserInfo('U123')

      // then
      expect(user.id).toBe('U123')
      expect(user.name).toBe('testuser')
    })
  })
})
