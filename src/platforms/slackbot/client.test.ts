import { beforeEach, describe, expect, mock, it } from 'bun:test'

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
const mockAssistant = {
  threads: {
    setStatus: mock(() => Promise.resolve({ ok: true })),
  },
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
    assistant = mockAssistant
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
    mockAssistant.threads.setStatus.mockClear()
  })

  describe('login', () => {
    it('accepts bot tokens (xoxb-)', async () => {
      // when/then: should not throw
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })
      expect(client).toBeDefined()
    })

    it('rejects user tokens (xoxp-)', async () => {
      // when/then
      await expect(new SlackBotClient().login({ token: 'xoxp-user-token' })).rejects.toThrow(SlackBotError)
    })

    it('rejects empty token', async () => {
      // when/then
      await expect(new SlackBotClient().login({ token: '' })).rejects.toThrow(SlackBotError)
    })

    it('rejects non-bot tokens', async () => {
      // when/then
      await expect(new SlackBotClient().login({ token: 'invalid-token' })).rejects.toThrow(SlackBotError)
    })
  })

  describe('testAuth', () => {
    it('returns auth info for valid token', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const result = await client.testAuth()

      // then
      expect(result.user_id).toBe('U123')
      expect(result.team_id).toBe('T456')
      expect(result.bot_id).toBe('B789')
    })
  })

  describe('postMessage', () => {
    it('sends message and returns timestamp', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const result = await client.postMessage('C123', 'Hello')

      // then
      expect(result.ts).toBe('1234567890.123456')
      expect(result.text).toBe('Hello')
    })
  })

  describe('getConversationHistory', () => {
    it('returns messages', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const messages = await client.getConversationHistory('C123')

      // then
      expect(messages.length).toBeGreaterThan(0)
      expect(messages[0].ts).toBe('1234567890.123456')
    })
  })

  describe('getMessage', () => {
    it('returns single message', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const message = await client.getMessage('C123', '1234567890.123456')

      // then
      expect(message).not.toBeNull()
      expect(message?.ts).toBe('1234567890.123456')
    })
  })

  describe('addReaction', () => {
    it('adds reaction to message', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when/then: should not throw
      await client.addReaction('C123', '1234567890.123456', 'thumbsup')
      expect(mockReactions.add).toHaveBeenCalled()
    })
  })

  describe('removeReaction', () => {
    it('removes reaction from message', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when/then: should not throw
      await client.removeReaction('C123', '1234567890.123456', 'thumbsup')
      expect(mockReactions.remove).toHaveBeenCalled()
    })
  })

  describe('setAssistantStatus', () => {
    it('sets assistant typing status with channel_id and thread_ts', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      await client.setAssistantStatus('C123', '1234567890.123456', 'is typing...')

      // then
      expect(mockAssistant.threads.setStatus).toHaveBeenCalledWith({
        channel_id: 'C123',
        thread_ts: '1234567890.123456',
        status: 'is typing...',
      })
    })

    it('clears status when given empty string', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      await client.setAssistantStatus('C123', '1234567890.123456', '')

      // then
      expect(mockAssistant.threads.setStatus).toHaveBeenCalledWith({
        channel_id: 'C123',
        thread_ts: '1234567890.123456',
        status: '',
      })
    })
  })

  describe('listChannels', () => {
    it('returns list of channels', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const channels = await client.listChannels()

      // then
      expect(channels.length).toBeGreaterThan(0)
      expect(channels[0].id).toBe('C123')
      expect(channels[0].name).toBe('general')
    })
  })

  describe('getChannelInfo', () => {
    it('returns channel details', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const channel = await client.getChannelInfo('C123')

      // then
      expect(channel.id).toBe('C123')
      expect(channel.name).toBe('general')
    })
  })

  describe('resolveChannel', () => {
    it('returns channel ID unchanged when it starts with C', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const channel = await client.resolveChannel('C123ABC')

      // then
      expect(channel).toBe('C123ABC')
      expect(mockConversations.list).not.toHaveBeenCalled()
    })

    it('returns channel ID unchanged when it starts with D', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const channel = await client.resolveChannel('D123ABC')

      // then
      expect(channel).toBe('D123ABC')
      expect(mockConversations.list).not.toHaveBeenCalled()
    })

    it('returns channel ID unchanged when it starts with G', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const channel = await client.resolveChannel('G123ABC')

      // then
      expect(channel).toBe('G123ABC')
      expect(mockConversations.list).not.toHaveBeenCalled()
    })

    it('resolves channel name to ID', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const channel = await client.resolveChannel('general')

      // then
      expect(channel).toBe('C123')
      expect(mockConversations.list).toHaveBeenCalled()
    })

    it('strips leading # from channel name', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const channel = await client.resolveChannel('#general')

      // then
      expect(channel).toBe('C123')
      expect(mockConversations.list).toHaveBeenCalled()
    })

    it('returns channel ID unchanged when input is #C prefixed ID', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const channel = await client.resolveChannel('#C123ABC')

      // then
      expect(channel).toBe('C123ABC')
    })

    it('throws channel_not_found error when name is not found', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

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
    it('returns list of users', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const users = await client.listUsers()

      // then
      expect(users.length).toBeGreaterThan(0)
      expect(users[0].id).toBe('U123')
    })
  })

  describe('getUserInfo', () => {
    it('returns user details', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const user = await client.getUserInfo('U123')

      // then
      expect(user.id).toBe('U123')
      expect(user.name).toBe('testuser')
    })
  })
})
