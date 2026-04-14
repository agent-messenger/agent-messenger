import { beforeEach, describe, expect, mock, test } from 'bun:test'

import type { WebClient } from '@slack/web-api'

import { SlackClient, SlackError } from '@/platforms/slack/client'

const mockWebClient: any = {
  conversations: {
    list: mock((): Promise<any> => Promise.resolve({ ok: true, channels: [] })),
    info: mock((): Promise<any> => Promise.resolve({ ok: true, channel: {} })),
    history: mock((): Promise<any> => Promise.resolve({ ok: true, messages: [] })),
    replies: mock((): Promise<any> => Promise.resolve({ ok: true, messages: [], has_more: false })),
    members: mock((): Promise<any> => Promise.resolve({ ok: true, members: [] })),
  },
  chat: {
    postMessage: mock((): Promise<any> => Promise.resolve({ ok: true, ts: '123.456', message: {} })),
    update: mock((): Promise<any> => Promise.resolve({ ok: true, ts: '123.456', message: {} })),
    delete: mock((): Promise<any> => Promise.resolve({ ok: true })),
  },
  reactions: {
    add: mock((): Promise<any> => Promise.resolve({ ok: true })),
    remove: mock((): Promise<any> => Promise.resolve({ ok: true })),
  },
  users: {
    list: mock((): Promise<any> => Promise.resolve({ ok: true, members: [] })),
    info: mock((): Promise<any> => Promise.resolve({ ok: true, user: {} })),
  },
  files: {
    uploadV2: mock((): Promise<any> => Promise.resolve({ ok: true, file: {} })),
    list: mock((): Promise<any> => Promise.resolve({ ok: true, files: [] })),
    info: mock((): Promise<any> => Promise.resolve({ ok: true, file: {} })),
  },
  auth: {
    test: mock((): Promise<any> => Promise.resolve({ ok: true, user_id: 'U123', team_id: 'T123' })),
  },
}

function resetMocks() {
  for (const group of Object.values(mockWebClient) as any[]) {
    for (const fn of Object.values(group) as any[]) {
      if (typeof fn.mockReset === 'function') {
        fn.mockReset()
      }
    }
  }
}

describe('SlackClient', () => {
  describe('login', () => {
    test('throws SlackError when token is empty', async () => {
      await expect(new SlackClient().login({ token: '', cookie: 'xoxd-cookie' })).rejects.toThrow(SlackError)
      await expect(new SlackClient().login({ token: '', cookie: 'xoxd-cookie' })).rejects.toThrow('Token is required')
    })

    test('throws SlackError when cookie is empty', async () => {
      await expect(new SlackClient().login({ token: 'xoxc-token', cookie: '' })).rejects.toThrow(SlackError)
      await expect(new SlackClient().login({ token: 'xoxc-token', cookie: '' })).rejects.toThrow('Cookie is required')
    })

    test('throws SlackError when both token and cookie are empty', async () => {
      await expect(new SlackClient().login({ token: '', cookie: '' })).rejects.toThrow(SlackError)
    })

    test('creates client successfully with valid token and cookie', async () => {
      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      expect(client).toBeInstanceOf(SlackClient)
    })
  })

  describe('testAuth', () => {
    beforeEach(() => resetMocks())

    test('returns auth info on success', async () => {
      mockWebClient.auth.test.mockResolvedValue({
        ok: true,
        user_id: 'U123',
        team_id: 'T123',
        user: 'testuser',
        team: 'Test Team',
      })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      const result = await client.testAuth()
      expect(result.user_id).toBe('U123')
      expect(result.team_id).toBe('T123')
    })

    test('throws SlackError on API failure', async () => {
      mockWebClient.auth.test.mockResolvedValue({
        ok: false,
        error: 'invalid_auth',
      })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      await expect(client.testAuth()).rejects.toThrow(SlackError)
    })
  })

  describe('listChannels', () => {
    beforeEach(() => resetMocks())

    test('returns list of channels', async () => {
      mockWebClient.conversations.list.mockResolvedValue({
        ok: true,
        channels: [
          {
            id: 'C123',
            name: 'general',
            is_private: false,
            is_archived: false,
            created: 1234567890,
            creator: 'U123',
          },
          {
            id: 'C456',
            name: 'random',
            is_private: false,
            is_archived: false,
            created: 1234567891,
            creator: 'U123',
          },
        ],
      })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      const channels = await client.listChannels()
      expect(channels).toHaveLength(2)
      expect(channels[0].id).toBe('C123')
      expect(channels[1].name).toBe('random')
    })

    test('handles pagination automatically', async () => {
      mockWebClient.conversations.list
        .mockResolvedValueOnce({
          ok: true,
          channels: [
            {
              id: 'C123',
              name: 'general',
              is_private: false,
              is_archived: false,
              created: 1234567890,
              creator: 'U123',
            },
          ],
          response_metadata: { next_cursor: 'cursor123' },
        })
        .mockResolvedValueOnce({
          ok: true,
          channels: [
            {
              id: 'C456',
              name: 'random',
              is_private: false,
              is_archived: false,
              created: 1234567891,
              creator: 'U123',
            },
          ],
        })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      const channels = await client.listChannels()
      expect(channels).toHaveLength(2)
      expect(mockWebClient.conversations.list).toHaveBeenCalledTimes(2)
    })

    test('throws SlackError on API failure', async () => {
      mockWebClient.conversations.list.mockResolvedValue({
        ok: false,
        error: 'channel_not_found',
      })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      await expect(client.listChannels()).rejects.toThrow(SlackError)
    })
  })

  describe('getChannel', () => {
    beforeEach(() => resetMocks())

    test('returns channel info', async () => {
      mockWebClient.conversations.info.mockResolvedValue({
        ok: true,
        channel: {
          id: 'C123',
          name: 'general',
          is_private: false,
          is_archived: false,
          created: 1234567890,
          creator: 'U123',
        },
      })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      const channel = await client.getChannel('C123')
      expect(channel.id).toBe('C123')
      expect(channel.name).toBe('general')
    })

    test('throws SlackError when channel not found', async () => {
      mockWebClient.conversations.info.mockResolvedValue({
        ok: false,
        error: 'channel_not_found',
      })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      await expect(client.getChannel('C999')).rejects.toThrow(SlackError)
    })
  })

  describe('resolveChannel', () => {
    beforeEach(() => resetMocks())

    test('returns channel ID unchanged when input starts with C', async () => {
      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      const channel = await client.resolveChannel('C123ABC')
      expect(channel).toBe('C123ABC')
    })

    test('returns channel ID unchanged when input starts with D', async () => {
      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      const channel = await client.resolveChannel('D123ABC')
      expect(channel).toBe('D123ABC')
    })

    test('returns channel ID unchanged when input starts with G', async () => {
      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      const channel = await client.resolveChannel('G123ABC')
      expect(channel).toBe('G123ABC')
    })

    test('resolves channel name to ID by calling listChannels', async () => {
      mockWebClient.conversations.list.mockResolvedValue({
        ok: true,
        channels: [
          {
            id: 'C123',
            name: 'general',
            is_private: false,
            is_archived: false,
            created: 1234567890,
            creator: 'U123',
          },
        ],
      })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      const channel = await client.resolveChannel('general')
      expect(channel).toBe('C123')
      expect(mockWebClient.conversations.list).toHaveBeenCalledTimes(1)
    })

    test('strips leading # from channel name', async () => {
      mockWebClient.conversations.list.mockResolvedValue({
        ok: true,
        channels: [
          {
            id: 'C123',
            name: 'general',
            is_private: false,
            is_archived: false,
            created: 1234567890,
            creator: 'U123',
          },
        ],
      })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      const channel = await client.resolveChannel('#general')
      expect(channel).toBe('C123')
      expect(mockWebClient.conversations.list).toHaveBeenCalledTimes(1)
    })

    test('returns channel ID unchanged when input is #C prefixed ID', async () => {
      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      const channel = await client.resolveChannel('#C123ABC')
      expect(channel).toBe('C123ABC')
    })

    test("throws SlackError with code 'channel_not_found' when name is not found", async () => {
      mockWebClient.conversations.list.mockResolvedValue({
        ok: true,
        channels: [
          {
            id: 'C123',
            name: 'general',
            is_private: false,
            is_archived: false,
            created: 1234567890,
            creator: 'U123',
          },
        ],
      })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      await expect(client.resolveChannel('missing-channel')).rejects.toMatchObject({
        name: 'SlackError',
        code: 'channel_not_found',
      })
    })
  })

  describe('getMessages', () => {
    beforeEach(() => resetMocks())

    test('returns messages with default limit of 20', async () => {
      const messages = Array.from({ length: 20 }, (_, i) => ({
        ts: `123.${i}`,
        text: `Message ${i}`,
        type: 'message',
      }))
      mockWebClient.conversations.history.mockResolvedValue({
        ok: true,
        messages,
      })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      const result = await client.getMessages('C123')
      expect(result).toHaveLength(20)
      expect(mockWebClient.conversations.history).toHaveBeenCalledWith(
        expect.objectContaining({ channel: 'C123', limit: 20 }),
      )
    })

    test('respects custom limit', async () => {
      mockWebClient.conversations.history.mockResolvedValue({
        ok: true,
        messages: [{ ts: '123.456', text: 'Hello', type: 'message' }],
      })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      await client.getMessages('C123', 50)
      expect(mockWebClient.conversations.history).toHaveBeenCalledWith(
        expect.objectContaining({ channel: 'C123', limit: 50 }),
      )
    })

    test('throws SlackError on API failure', async () => {
      mockWebClient.conversations.history.mockResolvedValue({
        ok: false,
        error: 'channel_not_found',
      })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      await expect(client.getMessages('C999')).rejects.toThrow(SlackError)
    })
  })

  describe('sendMessage', () => {
    beforeEach(() => resetMocks())

    test('sends message to channel', async () => {
      mockWebClient.chat.postMessage.mockResolvedValue({
        ok: true,
        ts: '123.456',
        message: { ts: '123.456', text: 'Hello', type: 'message' },
      })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      const message = await client.sendMessage('C123', 'Hello')
      expect(message.ts).toBe('123.456')
      expect(mockWebClient.chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ channel: 'C123', text: 'Hello' }),
      )
    })

    test('sends message to thread', async () => {
      mockWebClient.chat.postMessage.mockResolvedValue({
        ok: true,
        ts: '123.789',
        message: { ts: '123.789', text: 'Reply', type: 'message', thread_ts: '123.456' },
      })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      const message = await client.sendMessage('C123', 'Reply', '123.456')
      expect(message.thread_ts).toBe('123.456')
      expect(mockWebClient.chat.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ channel: 'C123', text: 'Reply', thread_ts: '123.456' }),
      )
    })

    test('throws SlackError on API failure', async () => {
      mockWebClient.chat.postMessage.mockResolvedValue({
        ok: false,
        error: 'channel_not_found',
      })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      await expect(client.sendMessage('C999', 'Hello')).rejects.toThrow(SlackError)
    })
  })

  describe('updateMessage', () => {
    beforeEach(() => resetMocks())

    test('updates message text', async () => {
      mockWebClient.chat.update.mockResolvedValue({
        ok: true,
        ts: '123.456',
        message: { ts: '123.456', text: 'Updated', type: 'message' },
      })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      const message = await client.updateMessage('C123', '123.456', 'Updated')
      expect(message.text).toBe('Updated')
      expect(mockWebClient.chat.update).toHaveBeenCalledWith(
        expect.objectContaining({ channel: 'C123', ts: '123.456', text: 'Updated' }),
      )
    })

    test('throws SlackError on API failure', async () => {
      mockWebClient.chat.update.mockResolvedValue({
        ok: false,
        error: 'message_not_found',
      })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      await expect(client.updateMessage('C123', '999.999', 'Updated')).rejects.toThrow(SlackError)
    })
  })

  describe('deleteMessage', () => {
    beforeEach(() => resetMocks())

    test('deletes message', async () => {
      mockWebClient.chat.delete.mockResolvedValue({ ok: true })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      await expect(client.deleteMessage('C123', '123.456')).resolves.toBeUndefined()
      expect(mockWebClient.chat.delete).toHaveBeenCalledWith(
        expect.objectContaining({ channel: 'C123', ts: '123.456' }),
      )
    })

    test('throws SlackError on API failure', async () => {
      mockWebClient.chat.delete.mockResolvedValue({
        ok: false,
        error: 'message_not_found',
      })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      await expect(client.deleteMessage('C123', '999.999')).rejects.toThrow(SlackError)
    })
  })

  describe('addReaction', () => {
    beforeEach(() => resetMocks())

    test('adds reaction to message', async () => {
      mockWebClient.reactions.add.mockResolvedValue({ ok: true })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      await expect(client.addReaction('C123', '123.456', 'thumbsup')).resolves.toBeUndefined()
      expect(mockWebClient.reactions.add).toHaveBeenCalledWith(
        expect.objectContaining({ channel: 'C123', timestamp: '123.456', name: 'thumbsup' }),
      )
    })

    test('throws SlackError on API failure', async () => {
      mockWebClient.reactions.add.mockResolvedValue({
        ok: false,
        error: 'already_reacted',
      })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      await expect(client.addReaction('C123', '123.456', 'thumbsup')).rejects.toThrow(SlackError)
    })
  })

  describe('removeReaction', () => {
    beforeEach(() => resetMocks())

    test('removes reaction from message', async () => {
      mockWebClient.reactions.remove.mockResolvedValue({ ok: true })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      await expect(client.removeReaction('C123', '123.456', 'thumbsup')).resolves.toBeUndefined()
      expect(mockWebClient.reactions.remove).toHaveBeenCalledWith(
        expect.objectContaining({ channel: 'C123', timestamp: '123.456', name: 'thumbsup' }),
      )
    })

    test('throws SlackError on API failure', async () => {
      mockWebClient.reactions.remove.mockResolvedValue({
        ok: false,
        error: 'no_reaction',
      })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      await expect(client.removeReaction('C123', '123.456', 'thumbsup')).rejects.toThrow(SlackError)
    })
  })

  describe('listUsers', () => {
    beforeEach(() => resetMocks())

    test('returns list of users', async () => {
      mockWebClient.users.list.mockResolvedValue({
        ok: true,
        members: [
          {
            id: 'U123',
            name: 'alice',
            real_name: 'Alice',
            is_admin: false,
            is_owner: false,
            is_bot: false,
            is_app_user: false,
          },
          {
            id: 'U456',
            name: 'bob',
            real_name: 'Bob',
            is_admin: true,
            is_owner: false,
            is_bot: false,
            is_app_user: false,
          },
        ],
      })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      const users = await client.listUsers()
      expect(users).toHaveLength(2)
      expect(users[0].name).toBe('alice')
      expect(users[1].is_admin).toBe(true)
    })

    test('handles pagination automatically', async () => {
      mockWebClient.users.list
        .mockResolvedValueOnce({
          ok: true,
          members: [
            {
              id: 'U123',
              name: 'alice',
              real_name: 'Alice',
              is_admin: false,
              is_owner: false,
              is_bot: false,
              is_app_user: false,
            },
          ],
          response_metadata: { next_cursor: 'cursor123' },
        })
        .mockResolvedValueOnce({
          ok: true,
          members: [
            {
              id: 'U456',
              name: 'bob',
              real_name: 'Bob',
              is_admin: false,
              is_owner: false,
              is_bot: false,
              is_app_user: false,
            },
          ],
        })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      const users = await client.listUsers()
      expect(users).toHaveLength(2)
      expect(mockWebClient.users.list).toHaveBeenCalledTimes(2)
    })

    test('returns pagination info for a single page', async () => {
      mockWebClient.users.list.mockResolvedValue({
        ok: true,
        members: [
          {
            id: 'U123',
            name: 'alice',
            real_name: 'Alice',
            is_admin: false,
            is_owner: false,
            is_bot: false,
            is_app_user: false,
          },
        ],
        response_metadata: { next_cursor: 'cursor123' },
      })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      const result = await client.listUsersPage({ limit: 1 })

      expect(result.users).toHaveLength(1)
      expect(result.has_more).toBe(true)
      expect(result.next_cursor).toBe('cursor123')
      expect(mockWebClient.users.list).toHaveBeenCalledWith(expect.objectContaining({ limit: 1 }))
    })

    test('accepts cursor for paginated user listing', async () => {
      mockWebClient.users.list.mockResolvedValue({
        ok: true,
        members: [
          {
            id: 'U456',
            name: 'bob',
            real_name: 'Bob',
            is_admin: false,
            is_owner: false,
            is_bot: false,
            is_app_user: false,
          },
        ],
      })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      const result = await client.listUsersPage({ cursor: 'cursor123', limit: 50 })

      expect(result.users).toHaveLength(1)
      expect(result.has_more).toBe(false)
      expect(result.next_cursor).toBeUndefined()
      expect(mockWebClient.users.list).toHaveBeenCalledWith(expect.objectContaining({ cursor: 'cursor123', limit: 50 }))
    })

    test('throws SlackError on API failure', async () => {
      mockWebClient.users.list.mockResolvedValue({
        ok: false,
        error: 'invalid_auth',
      })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      await expect(client.listUsers()).rejects.toThrow(SlackError)
    })
  })

  describe('listChannelMembers', () => {
    beforeEach(() => resetMocks())

    test('returns member IDs for a channel', async () => {
      mockWebClient.conversations.members.mockResolvedValue({
        ok: true,
        members: ['U123', 'U456', 'U789'],
      })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      const members = await client.listChannelMembers('C123')
      expect(members).toEqual(['U123', 'U456', 'U789'])
      expect(mockWebClient.conversations.members).toHaveBeenCalledWith(
        expect.objectContaining({ channel: 'C123', limit: 200 }),
      )
    })

    test('handles pagination automatically', async () => {
      mockWebClient.conversations.members
        .mockResolvedValueOnce({
          ok: true,
          members: ['U123', 'U456'],
          response_metadata: { next_cursor: 'cursor123' },
        })
        .mockResolvedValueOnce({
          ok: true,
          members: ['U789'],
        })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      const members = await client.listChannelMembers('C123')
      expect(members).toEqual(['U123', 'U456', 'U789'])
      expect(mockWebClient.conversations.members).toHaveBeenCalledTimes(2)
    })

    test('throws SlackError on API failure', async () => {
      mockWebClient.conversations.members.mockResolvedValue({
        ok: false,
        error: 'channel_not_found',
      })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      await expect(client.listChannelMembers('C999')).rejects.toThrow(SlackError)
    })
  })

  describe('getUser', () => {
    beforeEach(() => resetMocks())

    test('returns user info', async () => {
      mockWebClient.users.info.mockResolvedValue({
        ok: true,
        user: {
          id: 'U123',
          name: 'alice',
          real_name: 'Alice',
          is_admin: false,
          is_owner: false,
          is_bot: false,
          is_app_user: false,
        },
      })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      const user = await client.getUser('U123')
      expect(user.id).toBe('U123')
      expect(user.name).toBe('alice')
    })

    test('throws SlackError when user not found', async () => {
      mockWebClient.users.info.mockResolvedValue({
        ok: false,
        error: 'user_not_found',
      })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      await expect(client.getUser('U999')).rejects.toThrow(SlackError)
    })
  })

  describe('uploadFile', () => {
    beforeEach(() => resetMocks())

    test('uploads file to channels', async () => {
      mockWebClient.files.uploadV2.mockResolvedValue({
        ok: true,
        files: [
          {
            ok: true,
            files: [
              {
                id: 'F123',
                name: 'test.txt',
                title: 'test.txt',
                mimetype: 'text/plain',
                size: 100,
                url_private: 'https://...',
                created: 1234567890,
                user: 'U123',
              },
            ],
          },
        ],
      })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      const file = await client.uploadFile(['C123'], Buffer.from('test'), 'test.txt')
      expect(file.id).toBe('F123')
      expect(mockWebClient.files.uploadV2).toHaveBeenCalledWith(
        expect.objectContaining({ channel_id: 'C123', filename: 'test.txt' }),
      )
    })

    test('throws SlackError on API failure', async () => {
      mockWebClient.files.uploadV2.mockResolvedValue({
        ok: false,
        error: 'file_upload_failed',
      })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      await expect(client.uploadFile(['C123'], Buffer.from('test'), 'test.txt')).rejects.toThrow(SlackError)
    })

    test('throws SlackError when response has empty files array', async () => {
      mockWebClient.files.uploadV2.mockResolvedValue({
        ok: true,
        files: [],
      })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      await expect(client.uploadFile(['C123'], Buffer.from('test'), 'test.txt')).rejects.toThrow(SlackError)
    })

    test('throws SlackError when completion has no inner files', async () => {
      mockWebClient.files.uploadV2.mockResolvedValue({
        ok: true,
        files: [{ ok: true, files: [] }],
      })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      await expect(client.uploadFile(['C123'], Buffer.from('test'), 'test.txt')).rejects.toThrow(SlackError)
    })
  })

  describe('listFiles', () => {
    beforeEach(() => resetMocks())

    test('returns list of files', async () => {
      mockWebClient.files.list.mockResolvedValue({
        ok: true,
        files: [
          {
            id: 'F123',
            name: 'test.txt',
            title: 'test.txt',
            mimetype: 'text/plain',
            size: 100,
            url_private: 'https://...',
            created: 1234567890,
            user: 'U123',
          },
        ],
      })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      const files = await client.listFiles()
      expect(files).toHaveLength(1)
      expect(files[0].name).toBe('test.txt')
    })

    test('filters by channel when provided', async () => {
      mockWebClient.files.list.mockResolvedValue({
        ok: true,
        files: [],
      })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      await client.listFiles('C123')
      expect(mockWebClient.files.list).toHaveBeenCalledWith(expect.objectContaining({ channel: 'C123' }))
    })

    test('throws SlackError on API failure', async () => {
      mockWebClient.files.list.mockResolvedValue({
        ok: false,
        error: 'invalid_auth',
      })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      await expect(client.listFiles()).rejects.toThrow(SlackError)
    })
  })

  describe('getFileInfo', () => {
    beforeEach(() => resetMocks())

    test('returns file info', async () => {
      mockWebClient.files.info.mockResolvedValue({
        ok: true,
        file: {
          id: 'F123',
          name: 'test.txt',
          title: 'test.txt',
          mimetype: 'text/plain',
          size: 1024,
          url_private: 'https://files.slack.com/files-pri/T123-F123/test.txt',
          created: 1234567890,
          user: 'U123',
          channels: ['C123'],
        },
      })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      const file = await client.getFileInfo('F123')
      expect(file.id).toBe('F123')
      expect(file.name).toBe('test.txt')
      expect(file.url_private).toBe('https://files.slack.com/files-pri/T123-F123/test.txt')
    })

    test('throws on API failure', async () => {
      mockWebClient.files.info.mockResolvedValue({ ok: false, error: 'file_not_found' })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      await expect(client.getFileInfo('F999')).rejects.toThrow(SlackError)
    })
  })

  describe('downloadFile', () => {
    beforeEach(() => resetMocks())

    test('downloads file content', async () => {
      mockWebClient.files.info.mockResolvedValue({
        ok: true,
        file: {
          id: 'F123',
          name: 'test.txt',
          title: 'test.txt',
          mimetype: 'text/plain',
          size: 12,
          url_private: 'https://files.slack.com/files-pri/T123-F123/test.txt',
          created: 1234567890,
          user: 'U123',
        },
      })

      const originalFetch = globalThis.fetch
      globalThis.fetch = async () => new Response(Buffer.from('test content'), { status: 200 })

      try {
        const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
        // @ts-expect-error - accessing private property for testing
        client.client = mockWebClient as unknown as WebClient

        const result = await client.downloadFile('F123')
        expect(result.file.id).toBe('F123')
        expect(result.buffer).toBeInstanceOf(Buffer)
        expect(result.buffer.toString()).toBe('test content')
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    test('throws when url_private is empty', async () => {
      mockWebClient.files.info.mockResolvedValue({
        ok: true,
        file: {
          id: 'F123',
          name: 'test.txt',
          title: 'test.txt',
          mimetype: 'text/plain',
          size: 0,
          url_private: '',
          created: 1234567890,
          user: 'U123',
        },
      })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      await expect(client.downloadFile('F123')).rejects.toThrow('File has no download URL')
    })

    test('throws on download failure', async () => {
      mockWebClient.files.info.mockResolvedValue({
        ok: true,
        file: {
          id: 'F123',
          name: 'test.txt',
          title: 'test.txt',
          mimetype: 'text/plain',
          size: 12,
          url_private: 'https://files.slack.com/files-pri/T123-F123/test.txt',
          created: 1234567890,
          user: 'U123',
        },
      })

      const originalFetch = globalThis.fetch
      globalThis.fetch = async () => new Response('Forbidden', { status: 403, statusText: 'Forbidden' })

      try {
        const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
        // @ts-expect-error - accessing private property for testing
        client.client = mockWebClient as unknown as WebClient

        await expect(client.downloadFile('F123')).rejects.toThrow('Failed to download file')
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    test('sends correct auth headers', async () => {
      mockWebClient.files.info.mockResolvedValue({
        ok: true,
        file: {
          id: 'F123',
          name: 'test.txt',
          title: 'test.txt',
          mimetype: 'text/plain',
          size: 12,
          url_private: 'https://files.slack.com/files-pri/T123-F123/test.txt',
          created: 1234567890,
          user: 'U123',
        },
      })

      let capturedHeaders: Headers | undefined
      const originalFetch = globalThis.fetch
      globalThis.fetch = async (_url: any, init?: any) => {
        capturedHeaders = new Headers(init?.headers)
        return new Response(Buffer.from('data'), { status: 200 })
      }

      try {
        const client = await new SlackClient().login({ token: 'xoxc-test-token', cookie: 'xoxd-test-cookie' })
        // @ts-expect-error - accessing private property for testing
        client.client = mockWebClient as unknown as WebClient

        await client.downloadFile('F123')
        expect(capturedHeaders?.get('Authorization')).toBe('Bearer xoxc-test-token')
        expect(capturedHeaders?.get('Cookie')).toBe('d=xoxd-test-cookie')
      } finally {
        globalThis.fetch = originalFetch
      }
    })
  })

  describe('getThreadReplies', () => {
    beforeEach(() => resetMocks())

    test('returns thread replies including parent message', async () => {
      mockWebClient.conversations.replies.mockResolvedValue({
        ok: true,
        messages: [
          {
            ts: '123.456',
            text: 'Parent message',
            type: 'message',
            user: 'U123',
            thread_ts: '123.456',
            reply_count: 2,
          },
          {
            ts: '123.457',
            text: 'First reply',
            type: 'message',
            user: 'U456',
            thread_ts: '123.456',
          },
          {
            ts: '123.458',
            text: 'Second reply',
            type: 'message',
            user: 'U789',
            thread_ts: '123.456',
          },
        ],
        has_more: false,
      })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      const result = await client.getThreadReplies('C123', '123.456')
      expect(result.messages).toHaveLength(3)
      expect(result.messages[0].text).toBe('Parent message')
      expect(result.messages[0].reply_count).toBe(2)
      expect(result.messages[1].text).toBe('First reply')
      expect(result.messages[2].text).toBe('Second reply')
      expect(result.has_more).toBe(false)
    })

    test('respects limit parameter', async () => {
      mockWebClient.conversations.replies.mockResolvedValue({
        ok: true,
        messages: [{ ts: '123.456', text: 'Hello', type: 'message' }],
        has_more: false,
      })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      await client.getThreadReplies('C123', '123.456', { limit: 50 })
      expect(mockWebClient.conversations.replies).toHaveBeenCalledWith(
        expect.objectContaining({ channel: 'C123', ts: '123.456', limit: 50 }),
      )
    })

    test('passes optional oldest and latest parameters', async () => {
      mockWebClient.conversations.replies.mockResolvedValue({
        ok: true,
        messages: [],
        has_more: false,
      })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      await client.getThreadReplies('C123', '123.456', {
        oldest: '123.400',
        latest: '123.500',
      })
      expect(mockWebClient.conversations.replies).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: 'C123',
          ts: '123.456',
          oldest: '123.400',
          latest: '123.500',
        }),
      )
    })

    test('returns pagination info when has_more is true', async () => {
      mockWebClient.conversations.replies.mockResolvedValue({
        ok: true,
        messages: [{ ts: '123.456', text: 'Hello', type: 'message' }],
        has_more: true,
        response_metadata: { next_cursor: 'cursor123' },
      })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      const result = await client.getThreadReplies('C123', '123.456')
      expect(result.has_more).toBe(true)
      expect(result.next_cursor).toBe('cursor123')
    })

    test('throws SlackError when thread not found', async () => {
      mockWebClient.conversations.replies.mockResolvedValue({
        ok: false,
        error: 'thread_not_found',
      })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      await expect(client.getThreadReplies('C123', '999.999')).rejects.toThrow(SlackError)
    })

    test('throws SlackError when channel not found', async () => {
      mockWebClient.conversations.replies.mockResolvedValue({
        ok: false,
        error: 'channel_not_found',
      })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      await expect(client.getThreadReplies('C999', '123.456')).rejects.toThrow(SlackError)
    })
  })

  describe('rate limiting', () => {
    beforeEach(() => resetMocks())

    test('retries on rate limit error with exponential backoff', async () => {
      const rateLimitError = new Error('Rate limited')
      ;(rateLimitError as any).code = 'slack_webapi_rate_limited_error'
      ;(rateLimitError as any).retryAfter = 0.001

      mockWebClient.conversations.list
        .mockRejectedValueOnce(rateLimitError)
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({
          ok: true,
          channels: [
            {
              id: 'C123',
              name: 'general',
              is_private: false,
              is_archived: false,
              created: 1234567890,
              creator: 'U123',
            },
          ],
        })

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      const channels = await client.listChannels()
      expect(channels).toHaveLength(1)
      expect(mockWebClient.conversations.list).toHaveBeenCalledTimes(3)
    })

    test('throws SlackError after max retries (3)', async () => {
      const rateLimitError = new Error('Rate limited')
      ;(rateLimitError as any).code = 'slack_webapi_rate_limited_error'
      ;(rateLimitError as any).retryAfter = 0.001

      mockWebClient.conversations.list.mockRejectedValue(rateLimitError)

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      await expect(client.listChannels()).rejects.toThrow(SlackError)
      // Initial call + 3 retries = 4 total calls
      expect(mockWebClient.conversations.list).toHaveBeenCalledTimes(4)
    })

    test('does not retry on non-rate-limit errors', async () => {
      const otherError = new Error('Some other error')
      ;(otherError as any).code = 'some_other_error'

      mockWebClient.conversations.list.mockRejectedValue(otherError)

      const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
      // @ts-expect-error - accessing private property for testing
      client.client = mockWebClient as unknown as WebClient

      await expect(client.listChannels()).rejects.toThrow(SlackError)
      expect(mockWebClient.conversations.list).toHaveBeenCalledTimes(1)
    })
  })

  describe('SlackError', () => {
    test('is an instance of Error', () => {
      const error = new SlackError('test error', 'test_code')
      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(SlackError)
    })

    test('has message and code properties', () => {
      const error = new SlackError('test error', 'test_code')
      expect(error.message).toBe('test error')
      expect(error.code).toBe('test_code')
    })

    test('has name property set to SlackError', () => {
      const error = new SlackError('test error', 'test_code')
      expect(error.name).toBe('SlackError')
    })
  })
})

describe('SlackClient extended methods', () => {
  async function makeClient() {
    const client = await new SlackClient().login({ token: 'xoxc-token', cookie: 'xoxd-cookie' })
    const mock: any = {
      pins: {
        add: mock_fn(() => Promise.resolve({ ok: true })),
        remove: mock_fn(() => Promise.resolve({ ok: true })),
        list: mock_fn(() => Promise.resolve({ ok: true, items: [] })),
      },
      conversations: {
        create: mock_fn(() =>
          Promise.resolve({
            ok: true,
            channel: { id: 'C001', name: 'test', is_private: false, is_archived: false, created: 0, creator: 'U001' },
          }),
        ),
        archive: mock_fn(() => Promise.resolve({ ok: true })),
        setTopic: mock_fn(() => Promise.resolve({ ok: true, topic: 'new-topic' })),
        setPurpose: mock_fn(() => Promise.resolve({ ok: true, purpose: 'new-purpose' })),
        open: mock_fn(() => Promise.resolve({ ok: true, channel: { id: 'D001' }, already_open: false })),
        mark: mock_fn(() => Promise.resolve({ ok: true })),
        invite: mock_fn(() =>
          Promise.resolve({
            ok: true,
            channel: { id: 'C001', name: 'test', is_private: false, is_archived: false, created: 0, creator: 'U001' },
          }),
        ),
        join: mock_fn(() =>
          Promise.resolve({
            ok: true,
            channel: { id: 'C001', name: 'test', is_private: false, is_archived: false, created: 0, creator: 'U001' },
          }),
        ),
        leave: mock_fn(() => Promise.resolve({ ok: true })),
        list: mock_fn(() => Promise.resolve({ ok: true, channels: [] })),
      },
      subscriptions: {
        thread: {
          getView: mock_fn(() => Promise.resolve({ ok: true, view: {} })),
        },
      },
      chat: {
        scheduleMessage: mock_fn(() => Promise.resolve({ ok: true, scheduled_message_id: 'SM001' })),
        scheduledMessages: {
          list: mock_fn(() => Promise.resolve({ ok: true, scheduled_messages: [] })),
        },
        deleteScheduledMessage: mock_fn(() => Promise.resolve({ ok: true })),
        postEphemeral: mock_fn(() => Promise.resolve({ ok: true, message_ts: '123.456' })),
        getPermalink: mock_fn(() =>
          Promise.resolve({ ok: true, permalink: 'https://slack.com/archives/C001/p123456' }),
        ),
      },
      users: {
        lookupByEmail: mock_fn(() =>
          Promise.resolve({
            ok: true,
            user: {
              id: 'U001',
              name: 'test',
              real_name: 'Test User',
              is_admin: false,
              is_owner: false,
              is_bot: false,
              is_app_user: false,
            },
          }),
        ),
        profile: {
          get: mock_fn(() =>
            Promise.resolve({ ok: true, profile: { display_name: 'Test', status_text: '', status_emoji: '' } }),
          ),
          set: mock_fn(() =>
            Promise.resolve({
              ok: true,
              profile: { display_name: 'Test', status_text: 'Working', status_emoji: ':computer:' },
            }),
          ),
        },
      },
      reminders: {
        add: mock_fn(() =>
          Promise.resolve({
            ok: true,
            reminder: {
              id: 'Rm001',
              creator: 'U001',
              text: 'Test',
              user: 'U001',
              recurring: false,
              time: 1700000000,
              complete_ts: 0,
            },
          }),
        ),
        list: mock_fn(() => Promise.resolve({ ok: true, reminders: [] })),
        complete: mock_fn(() => Promise.resolve({ ok: true })),
        delete: mock_fn(() => Promise.resolve({ ok: true })),
      },
      files: {
        delete: mock_fn(() => Promise.resolve({ ok: true })),
      },
      emoji: {
        list: mock_fn(() => Promise.resolve({ ok: true, emoji: { party_blob: 'https://example.com/party_blob.gif' } })),
      },
      apiCall: mock_fn((method: string) => {
        if (method === 'bookmarks.add')
          return Promise.resolve({
            ok: true,
            bookmark: {
              id: 'Bm001',
              channel_id: 'C001',
              title: 'Test',
              link: 'https://example.com',
              type: 'link',
              date_created: 0,
              date_updated: 0,
              created_by: 'U001',
            },
          })
        if (method === 'bookmarks.edit')
          return Promise.resolve({
            ok: true,
            bookmark: {
              id: 'Bm001',
              channel_id: 'C001',
              title: 'Updated',
              link: 'https://example.com',
              type: 'link',
              date_created: 0,
              date_updated: 1,
              created_by: 'U001',
            },
          })
        if (method === 'bookmarks.remove') return Promise.resolve({ ok: true })
        if (method === 'bookmarks.list') return Promise.resolve({ ok: true, bookmarks: [] })
        if (method === 'usergroups.list')
          return Promise.resolve({
            ok: true,
            usergroups: [
              {
                id: 'S001',
                team_id: 'T001',
                name: 'Engineering',
                handle: 'engineering',
                description: 'Eng team',
                is_external: false,
                is_usergroup: true,
                date_create: 100,
                date_update: 200,
                date_delete: 0,
                auto_type: null,
                created_by: 'U001',
                updated_by: 'U001',
                deleted_by: null,
                prefs: { channels: [], groups: [] },
                users: ['U001'],
                user_count: 1,
              },
            ],
          })
        if (method === 'usergroups.create')
          return Promise.resolve({
            ok: true,
            usergroup: {
              id: 'S002',
              team_id: 'T001',
              name: 'Marketing',
              handle: 'marketing',
              description: '',
              is_external: false,
              is_usergroup: true,
              date_create: 100,
              date_update: 100,
              date_delete: 0,
              auto_type: null,
              created_by: 'U001',
              updated_by: 'U001',
              deleted_by: null,
              prefs: { channels: [], groups: [] },
              users: [],
              user_count: 0,
            },
          })
        if (method === 'usergroups.update')
          return Promise.resolve({
            ok: true,
            usergroup: {
              id: 'S001',
              team_id: 'T001',
              name: 'Updated',
              handle: 'updated',
              description: 'New desc',
              is_external: false,
              is_usergroup: true,
              date_create: 100,
              date_update: 300,
              date_delete: 0,
              auto_type: null,
              created_by: 'U001',
              updated_by: 'U001',
              deleted_by: null,
              prefs: { channels: [], groups: [] },
              users: ['U001'],
              user_count: 1,
            },
          })
        if (method === 'usergroups.disable')
          return Promise.resolve({
            ok: true,
            usergroup: {
              id: 'S001',
              team_id: 'T001',
              name: 'Engineering',
              handle: 'engineering',
              description: '',
              is_external: false,
              is_usergroup: true,
              date_create: 100,
              date_update: 300,
              date_delete: 400,
              auto_type: null,
              created_by: 'U001',
              updated_by: 'U001',
              deleted_by: 'U001',
              prefs: { channels: [], groups: [] },
              users: [],
              user_count: 0,
            },
          })
        if (method === 'usergroups.enable')
          return Promise.resolve({
            ok: true,
            usergroup: {
              id: 'S001',
              team_id: 'T001',
              name: 'Engineering',
              handle: 'engineering',
              description: '',
              is_external: false,
              is_usergroup: true,
              date_create: 100,
              date_update: 500,
              date_delete: 0,
              auto_type: null,
              created_by: 'U001',
              updated_by: 'U001',
              deleted_by: null,
              prefs: { channels: [], groups: [] },
              users: ['U001'],
              user_count: 1,
            },
          })
        if (method === 'usergroups.users.list') return Promise.resolve({ ok: true, users: ['U001', 'U002'] })
        if (method === 'usergroups.users.update')
          return Promise.resolve({
            ok: true,
            usergroup: {
              id: 'S001',
              team_id: 'T001',
              name: 'Engineering',
              handle: 'engineering',
              description: '',
              is_external: false,
              is_usergroup: true,
              date_create: 100,
              date_update: 600,
              date_delete: 0,
              auto_type: null,
              created_by: 'U001',
              updated_by: 'U001',
              deleted_by: null,
              prefs: { channels: [], groups: [] },
              users: ['U001', 'U003'],
              user_count: 2,
            },
          })
        return Promise.resolve({ ok: true })
      }),
    }
    // @ts-expect-error - accessing private property for testing
    client.client = mock
    return { client, mock }
  }

  function mock_fn(impl: (...args: any[]) => any) {
    return mock(impl)
  }

  describe('mid-surface methods', () => {
    test('lists DMs and respects includeArchived option', async () => {
      const { client, mock } = await makeClient()
      mock.conversations.list.mockResolvedValueOnce({
        ok: true,
        channels: [
          { id: 'D001', user: 'U001', is_mpim: false },
          { id: 'G001', name: 'project-room', is_mpim: true },
        ],
      })

      const dms = await client.listDMs({ includeArchived: true })

      expect(dms).toEqual([
        { id: 'D001', user: 'U001', is_mpim: false },
        { id: 'G001', user: 'project-room', is_mpim: true },
      ])
      expect(mock.conversations.list).toHaveBeenCalledWith({
        cursor: undefined,
        limit: 200,
        types: 'im,mpim',
        exclude_archived: false,
      })
    })

    test('maps unread counts and totals', async () => {
      const { client, mock } = await makeClient()
      mock.apiCall.mockImplementation((method: string) => {
        if (method === 'client.counts') {
          return Promise.resolve({
            ok: true,
            channels: [
              { id: 'C001', name: 'general', unread_count: 3, mention_count: 1 },
              { id: 'C002', name: 'random', unread_count: 2, mention_count: 0 },
            ],
          })
        }
        return Promise.resolve({ ok: true })
      })

      const counts = await client.getUnreadCounts()

      expect(counts.channels).toEqual([
        { id: 'C001', name: 'general', unread_count: 3, mention_count: 1 },
        { id: 'C002', name: 'random', unread_count: 2, mention_count: 0 },
      ])
      expect(counts.total_unread).toBe(5)
      expect(counts.total_mentions).toBe(1)
    })

    test('maps thread view from subscriptions API', async () => {
      const { client, mock } = await makeClient()
      mock.subscriptions.thread.getView.mockResolvedValue({
        ok: true,
        view: {
          channel_id: 'C001',
          thread_ts: '123.456',
          unread_count: 4,
          last_read: '123.455',
          subscribed: true,
        },
      })

      const view = await client.getThreadView('C001', '123.456')

      expect(view).toEqual({
        channel_id: 'C001',
        thread_ts: '123.456',
        unread_count: 4,
        last_read: '123.455',
        subscribed: true,
      })
      expect(mock.subscriptions.thread.getView).toHaveBeenCalledWith({
        channel: 'C001',
        thread_ts: '123.456',
      })
    })

    test('marks a channel as read', async () => {
      const { client, mock } = await makeClient()

      await client.markRead('C001', '123.456')

      expect(mock.conversations.mark).toHaveBeenCalledWith({ channel: 'C001', ts: '123.456' })
    })

    test('maps activity feed and passes custom options', async () => {
      const { client, mock } = await makeClient()
      mock.apiCall.mockImplementation((method: string, args?: Record<string, unknown>) => {
        if (method === 'activity.feed') {
          expect(args).toEqual({
            types: 'thread_reply',
            mode: 'unreads',
            limit: 10,
          })
          return Promise.resolve({
            ok: true,
            items: [
              {
                id: 'A001',
                type: 'thread_reply',
                channel: 'C001',
                ts: '123.456',
                text: 'Reply',
                user: 'U001',
                created: 1700000000,
              },
            ],
          })
        }
        return Promise.resolve({ ok: true })
      })

      const items = await client.getActivityFeed({ types: 'thread_reply', mode: 'unreads', limit: 10 })

      expect(items).toEqual([
        {
          id: 'A001',
          type: 'thread_reply',
          channel: 'C001',
          ts: '123.456',
          text: 'Reply',
          user: 'U001',
          created: 1700000000,
        },
      ])
    })

    test('maps saved items with pagination metadata', async () => {
      const { client, mock } = await makeClient()
      mock.apiCall.mockImplementation((method: string) => {
        if (method === 'saved.list') {
          return Promise.resolve({
            ok: true,
            items: [
              {
                type: 'message',
                message: {
                  ts: '123.456',
                  text: 'Saved message',
                  user: 'U001',
                  username: 'alice',
                  type: 'message',
                  thread_ts: '123.400',
                  reply_count: 2,
                  replies: [{ user: 'U002', ts: '123.401' }],
                  edited: { user: 'U003', ts: '123.500' },
                },
                channel: { id: 'C001', name: 'general' },
                date_created: 1700000000,
              },
            ],
            has_more: true,
            response_metadata: { next_cursor: 'cursor123' },
          })
        }
        return Promise.resolve({ ok: true })
      })

      const saved = await client.getSavedItems('cursor0')

      expect(saved).toEqual({
        items: [
          {
            type: 'message',
            message: {
              ts: '123.456',
              text: 'Saved message',
              user: 'U001',
              username: 'alice',
              type: 'message',
              thread_ts: '123.400',
              reply_count: 2,
              replies: [{ user: 'U002', ts: '123.401' }],
              edited: { user: 'U003', ts: '123.500' },
            },
            channel: { id: 'C001', name: 'general' },
            date_created: 1700000000,
          },
        ],
        has_more: true,
        next_cursor: 'cursor123',
      })
    })

    test('maps channel sections', async () => {
      const { client, mock } = await makeClient()
      mock.apiCall.mockImplementation((method: string) => {
        if (method === 'users.channelSections.list') {
          return Promise.resolve({
            ok: true,
            channel_sections: [
              {
                id: 'S001',
                name: 'Focus',
                channel_ids: ['C001', 'C002'],
                date_created: 100,
                date_updated: 200,
              },
            ],
          })
        }
        return Promise.resolve({ ok: true })
      })

      const sections = await client.getChannelSections()

      expect(sections).toEqual([
        {
          id: 'S001',
          name: 'Focus',
          channel_ids: ['C001', 'C002'],
          date_created: 100,
          date_updated: 200,
        },
      ])
    })

    test('opens a conversation and returns open status', async () => {
      const { client, mock } = await makeClient()
      mock.conversations.open.mockResolvedValue({
        ok: true,
        channel: { id: 'D001' },
        already_open: true,
      })

      const result = await client.openConversation('U001,U002')

      expect(result).toEqual({ channel_id: 'D001', already_open: true })
      expect(mock.conversations.open).toHaveBeenCalledWith({ users: 'U001,U002' })
    })

    test('maps drafts and next cursor', async () => {
      const { client, mock } = await makeClient()
      mock.apiCall.mockImplementation((method: string) => {
        if (method === 'drafts.list') {
          return Promise.resolve({
            ok: true,
            drafts: [
              {
                id: 'DR001',
                channel_id: 'C001',
                message: { text: 'Draft text' },
                date_created: 100,
                date_updated: 200,
              },
            ],
            response_metadata: { next_cursor: 'cursor456' },
          })
        }
        return Promise.resolve({ ok: true })
      })

      const drafts = await client.getDrafts('cursor0')

      expect(drafts).toEqual({
        drafts: [
          {
            id: 'DR001',
            channel_id: 'C001',
            message: { text: 'Draft text' },
            date_created: 100,
            date_updated: 200,
          },
        ],
        next_cursor: 'cursor456',
      })
    })

    test('returns RTM connection info with stored cookie', async () => {
      const { client, mock } = await makeClient()
      mock.apiCall.mockImplementation((method: string) => {
        if (method === 'rtm.connect') {
          return Promise.resolve({
            ok: true,
            url: 'wss://example.slack-msgs.com',
            self: { id: 'U001' },
            team: { id: 'T001' },
          })
        }
        return Promise.resolve({ ok: true })
      })

      const connection = await client.rtmConnect()

      expect(connection).toEqual({
        url: 'wss://example.slack-msgs.com',
        cookie: 'xoxd-cookie',
        self: { id: 'U001' },
        team: { id: 'T001' },
      })
    })
  })

  describe('pinMessage', () => {
    test('calls pins.add with correct args', async () => {
      const { client, mock } = await makeClient()
      await client.pinMessage('C001', '123.456')
      expect(mock.pins.add).toHaveBeenCalledWith({ channel: 'C001', timestamp: '123.456' })
    })

    test('throws SlackError on API failure', async () => {
      const { client, mock } = await makeClient()
      mock.pins.add.mockResolvedValue({ ok: false, error: 'not_pinned' })
      await expect(client.pinMessage('C001', '123.456')).rejects.toThrow(SlackError)
    })
  })

  describe('unpinMessage', () => {
    test('calls pins.remove with correct args', async () => {
      const { client, mock } = await makeClient()
      await client.unpinMessage('C001', '123.456')
      expect(mock.pins.remove).toHaveBeenCalledWith({ channel: 'C001', timestamp: '123.456' })
    })

    test('throws SlackError on API failure', async () => {
      const { client, mock } = await makeClient()
      mock.pins.remove.mockResolvedValue({ ok: false, error: 'no_pin' })
      await expect(client.unpinMessage('C001', '123.456')).rejects.toThrow(SlackError)
    })
  })

  describe('listPins', () => {
    test('returns mapped pin items', async () => {
      const { client, mock } = await makeClient()
      mock.pins.list.mockResolvedValue({
        ok: true,
        items: [{ message: { ts: '1.2', text: 'hi', type: 'message' }, created: 100, created_by: 'U001' }],
      })
      const pins = await client.listPins('C001')
      expect(pins).toHaveLength(1)
      expect(pins[0].message.ts).toBe('1.2')
      expect(pins[0].created_by).toBe('U001')
    })

    test('throws SlackError on API failure', async () => {
      const { client, mock } = await makeClient()
      mock.pins.list.mockResolvedValue({ ok: false, error: 'channel_not_found' })
      await expect(client.listPins('C001')).rejects.toThrow(SlackError)
    })
  })

  describe('addBookmark', () => {
    test('calls bookmarks.add and returns bookmark', async () => {
      const { client } = await makeClient()
      const result = await client.addBookmark('C001', 'Test', 'https://example.com')
      expect(result.id).toBe('Bm001')
      expect(result.title).toBe('Test')
    })

    test('throws SlackError on API failure', async () => {
      const { client, mock } = await makeClient()
      mock.apiCall.mockResolvedValue({ ok: false, error: 'channel_not_found' })
      await expect(client.addBookmark('C001', 'Test', 'https://example.com')).rejects.toThrow(SlackError)
    })
  })

  describe('editBookmark', () => {
    test('calls bookmarks.edit and returns updated bookmark', async () => {
      const { client } = await makeClient()
      const result = await client.editBookmark('C001', 'Bm001', { title: 'Updated' })
      expect(result.title).toBe('Updated')
    })

    test('throws SlackError on API failure', async () => {
      const { client, mock } = await makeClient()
      mock.apiCall.mockResolvedValue({ ok: false, error: 'bookmark_not_found' })
      await expect(client.editBookmark('C001', 'Bm001', { title: 'X' })).rejects.toThrow(SlackError)
    })
  })

  describe('removeBookmark', () => {
    test('calls bookmarks.remove successfully', async () => {
      const { client, mock } = await makeClient()
      await client.removeBookmark('C001', 'Bm001')
      expect(mock.apiCall).toHaveBeenCalledWith('bookmarks.remove', { channel_id: 'C001', bookmark_id: 'Bm001' })
    })

    test('throws SlackError on API failure', async () => {
      const { client, mock } = await makeClient()
      mock.apiCall.mockResolvedValue({ ok: false, error: 'bookmark_not_found' })
      await expect(client.removeBookmark('C001', 'Bm001')).rejects.toThrow(SlackError)
    })
  })

  describe('listBookmarks', () => {
    test('returns empty array when no bookmarks', async () => {
      const { client } = await makeClient()
      const result = await client.listBookmarks('C001')
      expect(result).toHaveLength(0)
    })

    test('throws SlackError on API failure', async () => {
      const { client, mock } = await makeClient()
      mock.apiCall.mockResolvedValue({ ok: false, error: 'channel_not_found' })
      await expect(client.listBookmarks('C001')).rejects.toThrow(SlackError)
    })
  })

  describe('scheduleMessage', () => {
    test('returns scheduled message with id', async () => {
      const { client } = await makeClient()
      const result = await client.scheduleMessage('C001', 'Hello', 1700000000)
      expect(result.id).toBe('SM001')
      expect(result.text).toBe('Hello')
      expect(result.channel_id).toBe('C001')
    })

    test('throws SlackError on API failure', async () => {
      const { client, mock } = await makeClient()
      mock.chat.scheduleMessage.mockResolvedValue({ ok: false, error: 'invalid_time' })
      await expect(client.scheduleMessage('C001', 'Hello', 1700000000)).rejects.toThrow(SlackError)
    })
  })

  describe('listScheduledMessages', () => {
    test('returns empty array when no scheduled messages', async () => {
      const { client } = await makeClient()
      const result = await client.listScheduledMessages()
      expect(result).toHaveLength(0)
    })

    test('throws SlackError on API failure', async () => {
      const { client, mock } = await makeClient()
      mock.chat.scheduledMessages.list.mockResolvedValue({ ok: false, error: 'invalid_auth' })
      await expect(client.listScheduledMessages()).rejects.toThrow(SlackError)
    })
  })

  describe('deleteScheduledMessage', () => {
    test('calls deleteScheduledMessage with correct args', async () => {
      const { client, mock } = await makeClient()
      await client.deleteScheduledMessage('C001', 'SM001')
      expect(mock.chat.deleteScheduledMessage).toHaveBeenCalledWith({ channel: 'C001', scheduled_message_id: 'SM001' })
    })

    test('throws SlackError on API failure', async () => {
      const { client, mock } = await makeClient()
      mock.chat.deleteScheduledMessage.mockResolvedValue({ ok: false, error: 'invalid_scheduled_message_id' })
      await expect(client.deleteScheduledMessage('C001', 'SM001')).rejects.toThrow(SlackError)
    })
  })

  describe('createChannel', () => {
    test('returns created channel', async () => {
      const { client } = await makeClient()
      const ch = await client.createChannel('new-channel')
      expect(ch.id).toBe('C001')
      expect(ch.name).toBe('test')
    })

    test('throws SlackError on API failure', async () => {
      const { client, mock } = await makeClient()
      mock.conversations.create.mockResolvedValue({ ok: false, error: 'name_taken' })
      await expect(client.createChannel('existing')).rejects.toThrow(SlackError)
    })
  })

  describe('archiveChannel', () => {
    test('archives channel successfully', async () => {
      const { client, mock } = await makeClient()
      await client.archiveChannel('C001')
      expect(mock.conversations.archive).toHaveBeenCalledWith({ channel: 'C001' })
    })

    test('throws SlackError on API failure', async () => {
      const { client, mock } = await makeClient()
      mock.conversations.archive.mockResolvedValue({ ok: false, error: 'already_archived' })
      await expect(client.archiveChannel('C001')).rejects.toThrow(SlackError)
    })
  })

  describe('setChannelTopic', () => {
    test('returns new topic', async () => {
      const { client } = await makeClient()
      const result = await client.setChannelTopic('C001', 'new-topic')
      expect(result.topic).toBe('new-topic')
    })

    test('throws SlackError on API failure', async () => {
      const { client, mock } = await makeClient()
      mock.conversations.setTopic.mockResolvedValue({ ok: false, error: 'channel_not_found' })
      await expect(client.setChannelTopic('C001', 'topic')).rejects.toThrow(SlackError)
    })
  })

  describe('setChannelPurpose', () => {
    test('returns new purpose', async () => {
      const { client } = await makeClient()
      const result = await client.setChannelPurpose('C001', 'new-purpose')
      expect(result.purpose).toBe('new-purpose')
    })

    test('throws SlackError on API failure', async () => {
      const { client, mock } = await makeClient()
      mock.conversations.setPurpose.mockResolvedValue({ ok: false, error: 'channel_not_found' })
      await expect(client.setChannelPurpose('C001', 'purpose')).rejects.toThrow(SlackError)
    })
  })

  describe('inviteToChannel', () => {
    test('returns channel after invite', async () => {
      const { client } = await makeClient()
      const ch = await client.inviteToChannel('C001', 'U002')
      expect(ch.id).toBe('C001')
    })

    test('throws SlackError on API failure', async () => {
      const { client, mock } = await makeClient()
      mock.conversations.invite.mockResolvedValue({ ok: false, error: 'user_not_found' })
      await expect(client.inviteToChannel('C001', 'U999')).rejects.toThrow(SlackError)
    })
  })

  describe('joinChannel', () => {
    test('returns channel after joining', async () => {
      const { client } = await makeClient()
      const ch = await client.joinChannel('C001')
      expect(ch.id).toBe('C001')
    })

    test('throws SlackError on API failure', async () => {
      const { client, mock } = await makeClient()
      mock.conversations.join.mockResolvedValue({ ok: false, error: 'channel_not_found' })
      await expect(client.joinChannel('C001')).rejects.toThrow(SlackError)
    })
  })

  describe('leaveChannel', () => {
    test('leaves channel successfully', async () => {
      const { client, mock } = await makeClient()
      await client.leaveChannel('C001')
      expect(mock.conversations.leave).toHaveBeenCalledWith({ channel: 'C001' })
    })

    test('throws SlackError on API failure', async () => {
      const { client, mock } = await makeClient()
      mock.conversations.leave.mockResolvedValue({ ok: false, error: 'channel_not_found' })
      await expect(client.leaveChannel('C001')).rejects.toThrow(SlackError)
    })
  })

  describe('lookupUserByEmail', () => {
    test('returns user for given email', async () => {
      const { client } = await makeClient()
      const user = await client.lookupUserByEmail('test@example.com')
      expect(user.id).toBe('U001')
      expect(user.name).toBe('test')
    })

    test('throws SlackError on API failure', async () => {
      const { client, mock } = await makeClient()
      mock.users.lookupByEmail.mockResolvedValue({ ok: false, error: 'users_not_found' })
      await expect(client.lookupUserByEmail('nobody@example.com')).rejects.toThrow(SlackError)
    })
  })

  describe('getUserProfile', () => {
    test('returns user profile', async () => {
      const { client } = await makeClient()
      const profile = await client.getUserProfile('U001')
      expect(profile.display_name).toBe('Test')
    })

    test('throws SlackError on API failure', async () => {
      const { client, mock } = await makeClient()
      mock.users.profile.get.mockResolvedValue({ ok: false, error: 'user_not_found' })
      await expect(client.getUserProfile('U999')).rejects.toThrow(SlackError)
    })
  })

  describe('setUserProfile', () => {
    test('returns updated profile', async () => {
      const { client } = await makeClient()
      const profile = await client.setUserProfile({ status_text: 'Working', status_emoji: ':computer:' })
      expect(profile.status_text).toBe('Working')
    })

    test('throws SlackError on API failure', async () => {
      const { client, mock } = await makeClient()
      mock.users.profile.set.mockResolvedValue({ ok: false, error: 'invalid_profile' })
      await expect(client.setUserProfile({ status_text: 'x' })).rejects.toThrow(SlackError)
    })
  })

  describe('postEphemeral', () => {
    test('returns message_ts on success', async () => {
      const { client } = await makeClient()
      const ts = await client.postEphemeral('C001', 'U001', 'Hello!')
      expect(ts).toBe('123.456')
    })

    test('throws SlackError on API failure', async () => {
      const { client, mock } = await makeClient()
      mock.chat.postEphemeral.mockResolvedValue({ ok: false, error: 'user_not_in_channel' })
      await expect(client.postEphemeral('C001', 'U001', 'Hello!')).rejects.toThrow(SlackError)
    })
  })

  describe('getPermalink', () => {
    test('returns permalink on success', async () => {
      const { client } = await makeClient()
      const link = await client.getPermalink('C001', '123.456')
      expect(link).toBe('https://slack.com/archives/C001/p123456')
    })

    test('throws SlackError on API failure', async () => {
      const { client, mock } = await makeClient()
      mock.chat.getPermalink.mockResolvedValue({ ok: false, error: 'message_not_found' })
      await expect(client.getPermalink('C001', '123.456')).rejects.toThrow(SlackError)
    })
  })

  describe('addReminder', () => {
    test('returns reminder on success', async () => {
      const { client } = await makeClient()
      const reminder = await client.addReminder('Do something', 1700000000)
      expect(reminder.id).toBe('Rm001')
      expect(reminder.text).toBe('Test')
    })

    test('throws SlackError on API failure', async () => {
      const { client, mock } = await makeClient()
      mock.reminders.add.mockResolvedValue({ ok: false, error: 'invalid_time' })
      await expect(client.addReminder('Do something', 1700000000)).rejects.toThrow(SlackError)
    })
  })

  describe('listReminders', () => {
    test('returns empty array when no reminders', async () => {
      const { client } = await makeClient()
      const result = await client.listReminders()
      expect(result).toHaveLength(0)
    })

    test('throws SlackError on API failure', async () => {
      const { client, mock } = await makeClient()
      mock.reminders.list.mockResolvedValue({ ok: false, error: 'invalid_auth' })
      await expect(client.listReminders()).rejects.toThrow(SlackError)
    })
  })

  describe('completeReminder', () => {
    test('completes reminder successfully', async () => {
      const { client, mock } = await makeClient()
      await client.completeReminder('Rm001')
      expect(mock.reminders.complete).toHaveBeenCalledWith({ reminder: 'Rm001' })
    })

    test('throws SlackError on API failure', async () => {
      const { client, mock } = await makeClient()
      mock.reminders.complete.mockResolvedValue({ ok: false, error: 'reminder_not_found' })
      await expect(client.completeReminder('Rm999')).rejects.toThrow(SlackError)
    })
  })

  describe('deleteReminder', () => {
    test('deletes reminder successfully', async () => {
      const { client, mock } = await makeClient()
      await client.deleteReminder('Rm001')
      expect(mock.reminders.delete).toHaveBeenCalledWith({ reminder: 'Rm001' })
    })

    test('throws SlackError on API failure', async () => {
      const { client, mock } = await makeClient()
      mock.reminders.delete.mockResolvedValue({ ok: false, error: 'reminder_not_found' })
      await expect(client.deleteReminder('Rm999')).rejects.toThrow(SlackError)
    })
  })

  describe('deleteFile', () => {
    test('deletes file successfully', async () => {
      const { client, mock } = await makeClient()
      await client.deleteFile('F001')
      expect(mock.files.delete).toHaveBeenCalledWith({ file: 'F001' })
    })

    test('throws SlackError on API failure', async () => {
      const { client, mock } = await makeClient()
      mock.files.delete.mockResolvedValue({ ok: false, error: 'file_not_found' })
      await expect(client.deleteFile('F999')).rejects.toThrow(SlackError)
    })
  })

  describe('listEmoji', () => {
    test('returns emoji map on success', async () => {
      const { client } = await makeClient()
      const emoji = await client.listEmoji()
      expect(emoji['party_blob']).toBe('https://example.com/party_blob.gif')
    })

    test('throws SlackError on API failure', async () => {
      const { client, mock } = await makeClient()
      mock.emoji.list.mockResolvedValue({ ok: false, error: 'invalid_auth' })
      await expect(client.listEmoji()).rejects.toThrow(SlackError)
    })
  })

  describe('listUsergroups', () => {
    test('returns mapped usergroups', async () => {
      const { client } = await makeClient()
      const groups = await client.listUsergroups({ includeCount: true })
      expect(groups).toHaveLength(1)
      expect(groups[0].id).toBe('S001')
      expect(groups[0].name).toBe('Engineering')
      expect(groups[0].handle).toBe('engineering')
      expect(groups[0].user_count).toBe(1)
    })

    test('calls apiCall with correct params', async () => {
      const { client, mock } = await makeClient()
      await client.listUsergroups({ includeDisabled: true, includeUsers: true, includeCount: true })
      expect(mock.apiCall).toHaveBeenCalledWith('usergroups.list', {
        include_disabled: true,
        include_users: true,
        include_count: true,
      })
    })

    test('throws SlackError on API failure', async () => {
      const { client, mock } = await makeClient()
      mock.apiCall.mockResolvedValue({ ok: false, error: 'invalid_auth' })
      await expect(client.listUsergroups()).rejects.toThrow(SlackError)
    })
  })

  describe('createUsergroup', () => {
    test('returns created usergroup', async () => {
      const { client } = await makeClient()
      const group = await client.createUsergroup('Marketing', { handle: 'marketing' })
      expect(group.id).toBe('S002')
      expect(group.name).toBe('Marketing')
    })

    test('calls apiCall with correct params including channels', async () => {
      const { client, mock } = await makeClient()
      await client.createUsergroup('Marketing', {
        handle: 'marketing',
        description: 'Mktg',
        channels: ['C001', 'C002'],
      })
      expect(mock.apiCall).toHaveBeenCalledWith('usergroups.create', {
        name: 'Marketing',
        handle: 'marketing',
        description: 'Mktg',
        channels: 'C001,C002',
      })
    })

    test('throws SlackError on API failure', async () => {
      const { client, mock } = await makeClient()
      mock.apiCall.mockResolvedValue({ ok: false, error: 'name_already_exists' })
      await expect(client.createUsergroup('Dup')).rejects.toThrow(SlackError)
    })
  })

  describe('updateUsergroup', () => {
    test('returns updated usergroup', async () => {
      const { client } = await makeClient()
      const group = await client.updateUsergroup('S001', { name: 'Updated', handle: 'updated' })
      expect(group.name).toBe('Updated')
      expect(group.handle).toBe('updated')
    })

    test('calls apiCall with correct params', async () => {
      const { client, mock } = await makeClient()
      await client.updateUsergroup('S001', { name: 'New', channels: ['C001'] })
      expect(mock.apiCall).toHaveBeenCalledWith('usergroups.update', {
        usergroup: 'S001',
        name: 'New',
        handle: undefined,
        description: undefined,
        channels: 'C001',
      })
    })

    test('throws SlackError on API failure', async () => {
      const { client, mock } = await makeClient()
      mock.apiCall.mockResolvedValue({ ok: false, error: 'no_such_subteam' })
      await expect(client.updateUsergroup('S999', { name: 'X' })).rejects.toThrow(SlackError)
    })
  })

  describe('disableUsergroup', () => {
    test('returns disabled usergroup with date_delete set', async () => {
      const { client } = await makeClient()
      const group = await client.disableUsergroup('S001')
      expect(group.id).toBe('S001')
      expect(group.date_delete).toBeGreaterThan(0)
    })

    test('throws SlackError on API failure', async () => {
      const { client, mock } = await makeClient()
      mock.apiCall.mockResolvedValue({ ok: false, error: 'no_such_subteam' })
      await expect(client.disableUsergroup('S999')).rejects.toThrow(SlackError)
    })
  })

  describe('enableUsergroup', () => {
    test('returns enabled usergroup with date_delete cleared', async () => {
      const { client } = await makeClient()
      const group = await client.enableUsergroup('S001')
      expect(group.id).toBe('S001')
      expect(group.date_delete).toBe(0)
    })

    test('throws SlackError on API failure', async () => {
      const { client, mock } = await makeClient()
      mock.apiCall.mockResolvedValue({ ok: false, error: 'no_such_subteam' })
      await expect(client.enableUsergroup('S999')).rejects.toThrow(SlackError)
    })
  })

  describe('listUsergroupMembers', () => {
    test('returns user ID array', async () => {
      const { client } = await makeClient()
      const users = await client.listUsergroupMembers('S001')
      expect(users).toEqual(['U001', 'U002'])
    })

    test('calls apiCall with correct params', async () => {
      const { client, mock } = await makeClient()
      await client.listUsergroupMembers('S001', { includeDisabled: true })
      expect(mock.apiCall).toHaveBeenCalledWith('usergroups.users.list', {
        usergroup: 'S001',
        include_disabled: true,
      })
    })

    test('throws SlackError on API failure', async () => {
      const { client, mock } = await makeClient()
      mock.apiCall.mockResolvedValue({ ok: false, error: 'no_such_subteam' })
      await expect(client.listUsergroupMembers('S999')).rejects.toThrow(SlackError)
    })
  })

  describe('updateUsergroupMembers', () => {
    test('returns updated usergroup with new members', async () => {
      const { client } = await makeClient()
      const group = await client.updateUsergroupMembers('S001', ['U001', 'U003'])
      expect(group.users).toEqual(['U001', 'U003'])
      expect(group.user_count).toBe(2)
    })

    test('calls apiCall with comma-joined user IDs', async () => {
      const { client, mock } = await makeClient()
      await client.updateUsergroupMembers('S001', ['U001', 'U003'])
      expect(mock.apiCall).toHaveBeenCalledWith('usergroups.users.update', {
        usergroup: 'S001',
        users: 'U001,U003',
      })
    })

    test('throws SlackError on API failure', async () => {
      const { client, mock } = await makeClient()
      mock.apiCall.mockResolvedValue({ ok: false, error: 'no_users_provided' })
      await expect(client.updateUsergroupMembers('S001', [])).rejects.toThrow(SlackError)
    })
  })
})
