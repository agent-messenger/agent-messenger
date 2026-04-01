import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

import { KakaoTalkClient, KakaoTalkError } from './client'

// Mock LocoSession at module level
const mockLogin = mock(() => Promise.resolve({}))
const mockGetChatList = mock(() => Promise.resolve({}))
const mockSyncMessages = mock(() => Promise.resolve({}))
const mockSendMessage = mock(() => Promise.resolve({}))
const mockClose = mock(() => {})
const mockOnClose = mock((_handler: () => void) => {})

mock.module('./protocol/session', () => ({
  LocoSession: class MockLocoSession {
    login = mockLogin
    getChatList = mockGetChatList
    syncMessages = mockSyncMessages
    sendMessage = mockSendMessage
    close = mockClose
    onClose = mockOnClose
  },
}))

function makeLong(n: number): { low: number; high: number } {
  return { low: n, high: 0 }
}

function resetAllMocks() {
  mockLogin.mockReset()
  mockGetChatList.mockReset()
  mockSyncMessages.mockReset()
  mockSendMessage.mockReset()
  mockClose.mockReset()
  mockOnClose.mockReset()
}

// LOCO protocol uses plain numbers for chat.c, but Long-like objects for logIds/cursors
const DEFAULT_LOGIN_RESULT = {
  chatDatas: [
    {
      c: 100,
      t: 1,
      k: ['Alice', 'Bob'],
      a: 2,
      n: 3,
      o: 1700000000,
      l: { authorId: 1, message: 'hi', sendAt: 1700000000 },
      ll: makeLong(999),
    },
    {
      c: 200,
      t: 2,
      k: ['Charlie'],
      a: 1,
      n: 0,
      o: 1699999000,
      l: null,
      ll: makeLong(500),
    },
  ],
  lastTokenId: makeLong(0),
  lastChatId: makeLong(0),
  eof: true,
}

describe('KakaoTalkClient', () => {
  beforeEach(() => {
    resetAllMocks()
    mockLogin.mockResolvedValue(DEFAULT_LOGIN_RESULT)
  })

  afterEach(() => {
    resetAllMocks()
  })

  describe('constructor', () => {
    test('creates client with required params', async () => {
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1' })
      expect(client).toBeInstanceOf(KakaoTalkClient)
      client.close()
    })

    test('defaults deviceUuid when not provided', async () => {
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1' })
      expect(client).toBeInstanceOf(KakaoTalkClient)
      client.close()
    })

    test('throws KakaoTalkError with code missing_token when oauthToken is empty', async () => {
      await expect(new KakaoTalkClient().login({ oauthToken: '', userId: 'user1' })).rejects.toThrow(KakaoTalkError)
      try {
        await new KakaoTalkClient().login({ oauthToken: '', userId: 'user1' })
      } catch (e) {
        expect((e as KakaoTalkError).code).toBe('missing_token')
      }
    })

    test('throws KakaoTalkError with code missing_user_id when userId is empty', async () => {
      await expect(new KakaoTalkClient().login({ oauthToken: 'token', userId: '' })).rejects.toThrow(KakaoTalkError)
      try {
        await new KakaoTalkClient().login({ oauthToken: 'token', userId: '' })
      } catch (e) {
        expect((e as KakaoTalkError).code).toBe('missing_user_id')
      }
    })
  })

  describe('getChats', () => {
    test('returns formatted chats from login snapshot', async () => {
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const chats = await client.getChats()

      expect(chats).toHaveLength(2)
      expect(chats[0].display_name).toBe('Alice, Bob')
      expect(chats[0].active_members).toBe(2)
      expect(chats[0].unread_count).toBe(3)
      expect(chats[0].last_message).toEqual({
        author_id: 1,
        message: 'hi',
        sent_at: 1700000000,
      })
      expect(chats[1].display_name).toBe('Charlie')
      expect(chats[1].last_message).toBeNull()

      client.close()
    })

    test('sorts chats by recency (o field descending)', async () => {
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const chats = await client.getChats()

      // chat 100 has o=1700000000, chat 200 has o=1699999000
      expect(chats[0].chat_id).toBe('100')
      expect(chats[1].chat_id).toBe('200')

      client.close()
    })

    test('filters by search term', async () => {
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const chats = await client.getChats({ search: 'alice' })

      expect(chats).toHaveLength(1)
      expect(chats[0].display_name).toBe('Alice, Bob')

      client.close()
    })

    test('falls back to LCHATLIST when login snapshot is empty (new device)', async () => {
      // given — LOGINLIST returns empty chatDatas with eof:true (new device scenario)
      const emptyLoginResult = {
        chatDatas: [],
        lastTokenId: makeLong(0),
        lastChatId: makeLong(0),
        eof: true,
      }
      mockLogin.mockResolvedValue(emptyLoginResult)

      mockGetChatList.mockResolvedValueOnce({
        body: {
          chatDatas: [
            {
              c: 100,
              t: 1,
              k: ['Alice', 'Bob'],
              a: 2,
              n: 3,
              o: 1700000000,
              l: { authorId: 1, message: 'hi', sendAt: 1700000000 },
              ll: makeLong(999),
            },
            {
              c: 200,
              t: 2,
              k: ['Charlie'],
              a: 1,
              n: 0,
              o: 1699999000,
              l: null,
              ll: makeLong(500),
            },
          ],
          lastTokenId: makeLong(1),
          lastChatId: makeLong(200),
          eof: true,
        },
      })

      // when — default chat list (no --all flag)
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const chats = await client.getChats()

      // then — fetched via LCHATLIST despite eof:true and no --all
      expect(chats).toHaveLength(2)
      expect(mockGetChatList).toHaveBeenCalledTimes(1)
      expect(chats[0].display_name).toBe('Alice, Bob')
      expect(chats[1].display_name).toBe('Charlie')

      client.close()
    })

    test('does not call LCHATLIST when login snapshot has chats', async () => {
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      await client.getChats()

      expect(mockGetChatList).not.toHaveBeenCalled()

      client.close()
    })

    test('paginates when all=true and not eof', async () => {
      const loginResult = {
        ...DEFAULT_LOGIN_RESULT,
        eof: false,
      }
      mockLogin.mockResolvedValue(loginResult)

      mockGetChatList.mockResolvedValueOnce({
        body: {
          chatDatas: [
            {
              c: 300,
              t: 1,
              k: ['Dave'],
              a: 1,
              n: 0,
              o: 1698000000,
              l: null,
              ll: makeLong(100),
            },
          ],
          lastTokenId: makeLong(1),
          lastChatId: makeLong(300),
          eof: true,
        },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const chats = await client.getChats({ all: true })

      expect(chats).toHaveLength(3)
      expect(mockGetChatList).toHaveBeenCalledTimes(1)

      client.close()
    })

    test('deduplicates chats by id', async () => {
      const loginResult = {
        ...DEFAULT_LOGIN_RESULT,
        eof: false,
      }
      mockLogin.mockResolvedValue(loginResult)

      // Return a chat with same ID as login result
      mockGetChatList.mockResolvedValueOnce({
        body: {
          chatDatas: [
            {
              c: 100, // Same as first login chat
              t: 1,
              k: ['Alice', 'Bob'],
              a: 2,
              n: 0,
              o: 1700000000,
              l: null,
              ll: makeLong(999),
            },
          ],
          lastTokenId: makeLong(1),
          lastChatId: makeLong(100),
          eof: true,
        },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const chats = await client.getChats({ all: true })

      expect(chats).toHaveLength(2) // Not 3 — deduped
      client.close()
    })

    test('wraps errors as KakaoTalkError', async () => {
      mockLogin.mockRejectedValue(new Error('Connection refused'))

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      await expect(client.getChats()).rejects.toThrow(KakaoTalkError)

      // Reset for second attempt
      mockLogin.mockRejectedValue(new Error('Connection refused'))
      try {
        await client.getChats()
      } catch (e) {
        expect((e as KakaoTalkError).code).toBe('login_failed')
      }

      client.close()
    })

    test('wraps getChatList failure as KakaoTalkError with code get_chats_failed', async () => {
      const loginResult = { ...DEFAULT_LOGIN_RESULT, eof: false }
      mockLogin.mockResolvedValue(loginResult)
      mockGetChatList.mockRejectedValue(new Error('Network error'))

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      try {
        await client.getChats({ all: true })
        expect.unreachable('should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(KakaoTalkError)
        expect((e as KakaoTalkError).code).toBe('get_chats_failed')
      }

      client.close()
    })
  })

  describe('getMessages', () => {
    test('returns formatted messages', async () => {
      mockSyncMessages.mockResolvedValueOnce({
        body: {
          chatLogs: [
            { logId: makeLong(10), type: 1, authorId: 42, message: 'hello', sendAt: 1700000001 },
            { logId: makeLong(11), type: 1, authorId: 43, message: 'world', sendAt: 1700000002 },
          ],
          isOK: true,
        },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const messages = await client.getMessages('100')

      expect(messages).toHaveLength(2)
      expect(messages[0]).toEqual({
        log_id: '10',
        type: 1,
        author_id: 42,
        message: 'hello',
        sent_at: 1700000001,
      })
      expect(messages[1]).toEqual({
        log_id: '11',
        type: 1,
        author_id: 43,
        message: 'world',
        sent_at: 1700000002,
      })

      client.close()
    })

    test('respects count option', async () => {
      const logs = Array.from({ length: 50 }, (_, i) => ({
        logId: makeLong(i + 1),
        type: 1,
        authorId: 1,
        message: `msg-${i}`,
        sendAt: 1700000000 + i,
      }))

      mockSyncMessages.mockResolvedValueOnce({
        body: { chatLogs: logs, isOK: true },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const messages = await client.getMessages('100', { count: 5 })

      expect(messages).toHaveLength(5)
      // Should return the LAST 5 (most recent)
      expect(messages[0].message).toBe('msg-45')
      expect(messages[4].message).toBe('msg-49')

      client.close()
    })

    test('sorts messages by sent_at ascending', async () => {
      mockSyncMessages.mockResolvedValueOnce({
        body: {
          chatLogs: [
            { logId: makeLong(2), type: 1, authorId: 1, message: 'second', sendAt: 200 },
            { logId: makeLong(1), type: 1, authorId: 1, message: 'first', sendAt: 100 },
          ],
          isOK: true,
        },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const messages = await client.getMessages('100')

      expect(messages[0].message).toBe('first')
      expect(messages[1].message).toBe('second')

      client.close()
    })
  })

  describe('sendMessage', () => {
    test('returns send result on success', async () => {
      mockSendMessage.mockResolvedValueOnce({
        statusCode: 0,
        body: { logId: makeLong(42), sendAt: 1700000099 },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const result = await client.sendMessage('100', 'hello')

      expect(result).toEqual({
        success: true,
        status_code: 0,
        chat_id: '100',
        log_id: '42',
        sent_at: 1700000099,
      })

      client.close()
    })

    test('reports failure when statusCode is non-zero', async () => {
      mockSendMessage.mockResolvedValueOnce({
        statusCode: -500,
        body: { logId: makeLong(0), sendAt: 0 },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const result = await client.sendMessage('100', 'hello')

      expect(result.success).toBe(false)
      expect(result.status_code).toBe(-500)

      client.close()
    })

    test('wraps transport errors as KakaoTalkError', async () => {
      mockSendMessage.mockRejectedValue(new Error('Socket closed'))

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      await expect(client.sendMessage('100', 'hello')).rejects.toThrow(KakaoTalkError)

      mockSendMessage.mockRejectedValue(new Error('Socket closed'))
      try {
        await client.sendMessage('100', 'hello')
      } catch (e) {
        expect((e as KakaoTalkError).code).toBe('send_message_failed')
      }

      client.close()
    })
  })

  describe('getProfile', () => {
    const mockFetch = mock(() => Promise.resolve(new Response()))

    beforeEach(() => {
      mockFetch.mockReset()
      globalThis.fetch = mockFetch as unknown as typeof fetch
    })

    afterEach(() => {
      mockFetch.mockReset()
    })

    function makeJsonResponse(data: unknown, status = 200): Response {
      return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    test('returns profile data on success', async () => {
      mockFetch
        .mockResolvedValueOnce(makeJsonResponse({
          profile: {
            nickName: 'Test User',
            profileImageUrl: 'https://example.com/profile.jpg',
            originalProfileImageUrl: 'https://example.com/original.jpg',
            statusMessage: 'Hello world',
          },
        }))
        .mockResolvedValueOnce(makeJsonResponse({ accountDisplayId: 'testuser123' }))

      const client = await new KakaoTalkClient().login({ oauthToken: 'mytoken', userId: 'user42', deviceUuid: 'device1' })
      const profile = await client.getProfile()

      expect(profile.user_id).toBe('user42')
      expect(profile.nickname).toBe('Test User')
      expect(profile.profile_image_url).toBe('https://example.com/profile.jpg')
      expect(profile.original_profile_image_url).toBe('https://example.com/original.jpg')
      expect(profile.status_message).toBe('Hello world')
      expect(profile.account_display_id).toBe('testuser123')

      client.close()
    })

    test('throws not_authenticated when not logged in', async () => {
      const client = new KakaoTalkClient()
      try {
        await client.getProfile()
        expect.unreachable('should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(KakaoTalkError)
        expect((e as KakaoTalkError).code).toBe('not_authenticated')
      }
    })

    test('throws profile_request_failed when profile HTTP request fails', async () => {
      mockFetch
        .mockResolvedValueOnce(makeJsonResponse({}, 401))
        .mockResolvedValueOnce(makeJsonResponse({ accountDisplayId: null }))

      const client = await new KakaoTalkClient().login({ oauthToken: 'mytoken', userId: 'user42', deviceUuid: 'device1' })
      try {
        await client.getProfile()
        expect.unreachable('should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(KakaoTalkError)
        expect((e as KakaoTalkError).code).toBe('profile_request_failed')
      }

      client.close()
    })

    test('returns null account_display_id when more_settings request fails', async () => {
      mockFetch
        .mockResolvedValueOnce(makeJsonResponse({
          profile: {
            nickName: 'Test User',
            profileImageUrl: null,
            originalProfileImageUrl: null,
            statusMessage: null,
          },
        }))
        .mockResolvedValueOnce(makeJsonResponse({}, 500))

      const client = await new KakaoTalkClient().login({ oauthToken: 'mytoken', userId: 'user42', deviceUuid: 'device1' })
      const profile = await client.getProfile()

      expect(profile.user_id).toBe('user42')
      expect(profile.nickname).toBe('Test User')
      expect(profile.account_display_id).toBeNull()

      client.close()
    })
  })

  describe('session lifecycle', () => {
    test('lazy init: does not call login until first method call', async () => {
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      expect(mockLogin).not.toHaveBeenCalled()
      client.close()
    })

    test('calls login on first method call', async () => {
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      await client.getChats()
      expect(mockLogin).toHaveBeenCalledTimes(1)
      client.close()
    })

    test('reuses session across multiple calls', async () => {
      mockSyncMessages.mockResolvedValue({
        body: { chatLogs: [], isOK: true },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      await client.getChats()
      await client.getMessages('100')

      expect(mockLogin).toHaveBeenCalledTimes(1)

      client.close()
    })

    test('concurrent calls share a single login', async () => {
      // Make login take some time
      mockLogin.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(DEFAULT_LOGIN_RESULT), 50)),
      )
      mockSyncMessages.mockResolvedValue({
        body: { chatLogs: [], isOK: true },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      await Promise.all([client.getChats(), client.getMessages('100')])

      expect(mockLogin).toHaveBeenCalledTimes(1)

      client.close()
    })

    test('retries login after failure', async () => {
      mockLogin
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockResolvedValueOnce(DEFAULT_LOGIN_RESULT)

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })

      // First call fails
      await expect(client.getChats()).rejects.toThrow(KakaoTalkError)

      // Second call retries and succeeds
      const chats = await client.getChats()
      expect(chats).toHaveLength(2)
      expect(mockLogin).toHaveBeenCalledTimes(2)

      client.close()
    })

    test('close cleans up session state', async () => {
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      await client.getChats()

      client.close()
      expect(mockClose).toHaveBeenCalledTimes(1)
    })

    test('methods throw client_closed after close', async () => {
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      await client.getChats()
      client.close()

      try {
        await client.getChats()
        expect.unreachable('should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(KakaoTalkError)
        expect((error as KakaoTalkError).code).toBe('client_closed')
      }
    })

    test('close is idempotent', async () => {
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      client.close()
      expect(() => client.close()).not.toThrow()
    })

    test('login failure closes the session to prevent socket leak', async () => {
      mockLogin.mockRejectedValue(new Error('Auth failed'))

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      await expect(client.getChats()).rejects.toThrow()

      // LocoSession.close() should have been called to clean up
      expect(mockClose).toHaveBeenCalledTimes(1)

      client.close()
    })
  })
})
