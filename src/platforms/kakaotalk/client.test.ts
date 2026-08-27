import { afterEach, beforeEach, describe, expect, mock, it } from 'bun:test'

import { KakaoTalkClient, KakaoTalkError } from './client'

// Mock LocoSession at module level
const mockLogin = mock(() => Promise.resolve({}))
const mockGetChatList = mock(() => Promise.resolve({}))
const mockGetChatLogs = mock(() => Promise.resolve({}))
const mockGetChatInfo = mock(() => Promise.resolve({}))
const mockGetChannelInfo = mock(() => Promise.resolve({}))
const mockGetOpenLinkInfo = mock(() => Promise.resolve({}))
const mockGetAllMembers = mock(() => Promise.resolve({}))
const mockGetMembersByIds = mock(() => Promise.resolve({}))
const mockSyncMessages = mock(() => Promise.resolve({}))
const mockSendMessage = mock(() => Promise.resolve({}))
const mockSendReply = mock(() => Promise.resolve({}))
const mockMarkRead = mock(() => Promise.resolve({}))
const mockLeaveChat = mock(() => Promise.resolve({}))
const mockSendTyping = mock(() => Promise.resolve({}))
const mockClose = mock(() => {})
const mockOnClose = mock((_handler: () => void) => {})
const mockOnPush = mock((_handler: (packet: unknown) => void) => {})

mock.module('./protocol/session', () => ({
  LocoSession: class MockLocoSession {
    login = mockLogin
    getChatList = mockGetChatList
    getChatLogs = mockGetChatLogs
    getChatInfo = mockGetChatInfo
    getChannelInfo = mockGetChannelInfo
    getOpenLinkInfo = mockGetOpenLinkInfo
    getAllMembers = mockGetAllMembers
    getMembersByIds = mockGetMembersByIds
    syncMessages = mockSyncMessages
    sendMessage = mockSendMessage
    sendReply = mockSendReply
    markRead = mockMarkRead
    leaveChat = mockLeaveChat
    sendTyping = mockSendTyping
    close = mockClose
    onClose = mockOnClose
    onPush = mockOnPush
  },
}))

function makeLong(n: number): { low: number; high: number } {
  return { low: n, high: 0 }
}

function memberChannelInfo(
  activeMembersCount: number,
  displayMembers: Array<Record<string, unknown>> = [],
  chatId = 100,
) {
  return {
    statusCode: 0,
    body: {
      chatInfo: {
        chatId: makeLong(chatId),
        activeMembersCount,
        displayMembers,
      },
    },
  }
}

function resetAllMocks() {
  mockLogin.mockReset()
  mockGetChatList.mockReset()
  mockGetChatLogs.mockReset()
  mockGetChatInfo.mockReset()
  mockGetChannelInfo.mockReset()
  mockGetOpenLinkInfo.mockReset()
  mockGetAllMembers.mockReset()
  mockGetMembersByIds.mockReset()
  mockSyncMessages.mockReset()
  mockSendMessage.mockReset()
  mockSendReply.mockReset()
  mockMarkRead.mockReset()
  mockLeaveChat.mockReset()
  mockSendTyping.mockReset()
  mockClose.mockReset()
  mockOnClose.mockReset()
  mockOnPush.mockReset()
}

// LOCO protocol uses plain numbers for chat.c, but Long-like objects for logIds/cursors.
// `i` and `k` are paired arrays — i[n] is the user_id, k[n] is the nickname.
const DEFAULT_LOGIN_RESULT = {
  chatDatas: [
    {
      c: 100,
      t: 1,
      k: ['Alice', 'Bob'],
      i: [1, 2],
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
      i: [3],
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
    // Deep-clone so tests that mutate loginResult.chatDatas (e.g. leaveChat)
    // don't leak into subsequent tests.
    mockLogin.mockResolvedValue(structuredClone(DEFAULT_LOGIN_RESULT))
    mockGetChatLogs.mockResolvedValue({ body: { status: 0, chatLogs: [], eof: true } })
    mockGetChatInfo.mockResolvedValue({ body: { l: makeLong(99999) } })
    mockSyncMessages.mockResolvedValue({ body: { status: 0, isOK: true, chatLogs: [] } })
  })

  afterEach(() => {
    expect(mockGetChatInfo).not.toHaveBeenCalled()
    resetAllMocks()
  })

  describe('constructor', () => {
    it('creates client with required params', async () => {
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1' })
      expect(client).toBeInstanceOf(KakaoTalkClient)
      client.close()
    })

    it('defaults deviceUuid when not provided', async () => {
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1' })
      expect(client).toBeInstanceOf(KakaoTalkClient)
      client.close()
    })

    it('throws KakaoTalkError with code missing_token when oauthToken is empty', async () => {
      await expect(new KakaoTalkClient().login({ oauthToken: '', userId: 'user1' })).rejects.toThrow(KakaoTalkError)
      try {
        await new KakaoTalkClient().login({ oauthToken: '', userId: 'user1' })
      } catch (e) {
        expect((e as KakaoTalkError).code).toBe('missing_token')
      }
    })

    it('throws KakaoTalkError with code missing_user_id when userId is empty', async () => {
      await expect(new KakaoTalkClient().login({ oauthToken: 'token', userId: '' })).rejects.toThrow(KakaoTalkError)
      try {
        await new KakaoTalkClient().login({ oauthToken: 'token', userId: '' })
      } catch (e) {
        expect((e as KakaoTalkError).code).toBe('missing_user_id')
      }
    })

    it('preserves invalid_access_token and never continues to LCHATLIST', async () => {
      mockLogin.mockRejectedValue(
        Object.assign(new Error('KakaoTalk LOGINLIST invalid access token (status -950)'), {
          code: 'invalid_access_token',
          serverStatus: -950,
        }),
      )
      const client = await new KakaoTalkClient().login({
        oauthToken: 'expired-access-token',
        userId: 'user1',
        deviceUuid: 'device1',
      })

      let error: unknown
      try {
        await client.getChats({ all: true })
      } catch (cause) {
        error = cause
      }

      expect(error).toBeInstanceOf(KakaoTalkError)
      expect(error).toMatchObject({ code: 'invalid_access_token', serverStatus: -950 })
      expect(mockGetChatList).not.toHaveBeenCalled()
      expect(mockClose).toHaveBeenCalledTimes(1)
    })

    it('preserves other typed LOGINLIST rejections', async () => {
      mockLogin.mockRejectedValue(
        Object.assign(new Error('KakaoTalk LOGINLIST rejected (status -777)'), {
          code: 'login_rejected',
          serverStatus: -777,
        }),
      )
      const client = await new KakaoTalkClient().login({
        oauthToken: 'rejected-access-token',
        userId: 'user1',
        deviceUuid: 'device1',
      })

      await expect(client.getChats()).rejects.toMatchObject({ code: 'login_rejected', serverStatus: -777 })
      expect(mockGetChatList).not.toHaveBeenCalled()
    })

    it('keeps interrupted LOGINLIST connections classified as login_failed', async () => {
      mockLogin.mockRejectedValue(new Error('KakaoTalk LOGINLIST transport failed: connection closed'))
      const client = await new KakaoTalkClient().login({
        oauthToken: 'token',
        userId: 'user1',
        deviceUuid: 'device1',
      })

      await expect(client.getChats()).rejects.toMatchObject({ code: 'login_failed' })
      expect(mockGetChatList).not.toHaveBeenCalled()
    })
  })

  describe('getChats', () => {
    it('returns formatted chats from login snapshot', async () => {
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const chats = await client.getChats()

      expect(chats).toHaveLength(2)
      expect(chats[0].display_name).toBe('Alice, Bob')
      expect(chats[0].title).toBeNull()
      expect(chats[0].active_members).toBe(2)
      expect(chats[0].unread_count).toBe(3)
      expect(chats[0].last_message).toEqual({
        author_id: 1,
        author_name: 'Alice',
        message: 'hi',
        sent_at: 1700000000,
      })
      expect(chats[1].display_name).toBe('Charlie')
      expect(chats[1].title).toBeNull()
      expect(chats[1].last_message).toBeNull()

      client.close()
    })

    it('preserves an unknown non-empty string type from the login snapshot', async () => {
      mockLogin.mockResolvedValue({
        ...DEFAULT_LOGIN_RESULT,
        chatDatas: [{ ...DEFAULT_LOGIN_RESULT.chatDatas[0], t: 'FutureChat' }],
      })

      const client = await new KakaoTalkClient().login({
        oauthToken: 'token',
        userId: 'user1',
        deviceUuid: 'device1',
      })

      await expect(client.getChats()).resolves.toMatchObject([{ type: 'FutureChat' }])

      client.close()
    })

    for (const invalidType of ['', true] as const) {
      it(`rejects invalid ${JSON.stringify(invalidType)} type from the login snapshot`, async () => {
        mockLogin.mockResolvedValue({
          ...DEFAULT_LOGIN_RESULT,
          chatDatas: [{ ...DEFAULT_LOGIN_RESULT.chatDatas[0], t: invalidType }],
        })

        const client = await new KakaoTalkClient().login({
          oauthToken: 'token',
          userId: 'user1',
          deviceUuid: 'device1',
        })

        await expect(client.getChats()).rejects.toMatchObject({ code: 'get_chats_failed' })

        client.close()
      })
    }

    it('populates last_message.author_name from paired chat.i / chat.k arrays', async () => {
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const chats = await client.getChats()

      expect(chats[0].last_message?.author_name).toBe('Alice')
    })

    it('returns null author_name when authorId is not in the paired arrays', async () => {
      const customLogin = {
        ...DEFAULT_LOGIN_RESULT,
        chatDatas: [
          {
            c: 100,
            t: 1,
            k: ['Alice'],
            i: [1],
            a: 1,
            n: 0,
            o: 1700000000,
            l: { authorId: 99, message: 'from a stranger', sendAt: 1700000000 },
            ll: makeLong(999),
          },
        ],
      }
      mockLogin.mockResolvedValue(customLogin)

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const chats = await client.getChats()

      expect(chats[0].last_message?.author_id).toBe(99)
      expect(chats[0].last_message?.author_name).toBeNull()
    })

    it('returns null author_name when chat.i is missing (no paired data)', async () => {
      const customLogin = {
        ...DEFAULT_LOGIN_RESULT,
        chatDatas: [
          {
            c: 100,
            t: 1,
            k: ['Alice'],
            a: 1,
            n: 0,
            o: 1700000000,
            l: { authorId: 1, message: 'hi', sendAt: 1700000000 },
            ll: makeLong(999),
          },
        ],
      }
      mockLogin.mockResolvedValue(customLogin)

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const chats = await client.getChats()

      expect(chats[0].last_message?.author_name).toBeNull()
    })

    it('does not call CHATINFO when resolveTitles is not set (default behavior preserved)', async () => {
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      await client.getChats()

      expect(mockGetChannelInfo).not.toHaveBeenCalled()

      client.close()
    })

    it('resolves user-set titles via CHATINFO when resolveTitles=true', async () => {
      mockGetChannelInfo.mockResolvedValueOnce({
        body: {
          chatInfo: {
            chatMetas: [
              { type: 1, content: '{"notice":"hello"}', revision: makeLong(1), updatedAt: 0 },
              { type: 3, content: 'Renamed Chat', revision: makeLong(2), updatedAt: 0 },
            ],
          },
        },
      })
      mockGetChannelInfo.mockResolvedValueOnce({
        body: {
          chatInfo: {
            chatMetas: [],
          },
        },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const chats = await client.getChats({ resolveTitles: true })

      expect(mockGetChannelInfo).toHaveBeenCalledTimes(2)
      expect(chats[0].title).toBe('Renamed Chat')
      expect(chats[0].display_name).toBe('Alice, Bob')
      expect(chats[1].title).toBeNull()
      expect(chats[1].display_name).toBe('Charlie')

      client.close()
    })

    it('returns null title when chatInfo or chatMetas is missing', async () => {
      mockGetChannelInfo.mockResolvedValue({ body: {} })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const chats = await client.getChats({ resolveTitles: true })

      for (const chat of chats) {
        expect(chat.title).toBeNull()
      }

      client.close()
    })

    it('swallows CHATINFO failures and returns null title (does not poison list)', async () => {
      mockGetChannelInfo.mockRejectedValueOnce(new Error('CHATINFO timed out'))
      mockGetChannelInfo.mockResolvedValueOnce({
        body: { chatInfo: { chatMetas: [{ type: 3, content: 'OK Title' }] } },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const chats = await client.getChats({ resolveTitles: true })

      expect(chats).toHaveLength(2)
      expect(chats[0].title).toBeNull()
      expect(chats[1].title).toBe('OK Title')

      client.close()
    })

    it('ignores empty-string title content and returns null', async () => {
      mockGetChannelInfo.mockResolvedValue({
        body: { chatInfo: { chatMetas: [{ type: 3, content: '' }] } },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const chats = await client.getChats({ resolveTitles: true })

      for (const chat of chats) {
        expect(chat.title).toBeNull()
      }

      client.close()
    })

    it('resolves open-chat titles via INFOLINK fallback in batch resolveTitles=true path', async () => {
      // Mixed login snapshot: regular chat (uses CHATINFO TITLE meta), open chat
      // with TITLE meta (CHATINFO only), open chat without TITLE meta (CHATINFO
      // empty + INFOLINK fallback). Verifies the batch path wires open-chat
      // fallback correctly — previously only the single-chat getChatTitle()
      // path was covered.
      const mixedLogin = {
        chatDatas: [
          {
            c: 100,
            t: 1,
            k: ['Alice'],
            i: [1],
            a: 1,
            n: 0,
            o: 1700000003,
            l: null,
            ll: makeLong(1),
          },
          {
            c: 500,
            t: 'OM',
            li: makeLong(7777),
            k: ['User1'],
            i: [10],
            a: 1,
            n: 0,
            o: 1700000002,
            l: null,
            ll: makeLong(2),
          },
          {
            c: 600,
            t: 'OD',
            li: makeLong(8888),
            k: ['User2'],
            i: [20],
            a: 1,
            n: 0,
            o: 1700000001,
            l: null,
            ll: makeLong(3),
          },
        ],
        lastTokenId: makeLong(0),
        lastChatId: makeLong(0),
        eof: true,
      }
      mockLogin.mockResolvedValue(mixedLogin)

      // CHATINFO is fired in parallel for all 3 chats; mock by chatId so order
      // doesn't matter (Promise.all resolves in fire order, not array order).
      mockGetChannelInfo.mockImplementation((chatId: { low: number; high: number }) => {
        switch (chatId.low) {
          case 100:
            return Promise.resolve({ body: { chatInfo: { chatMetas: [{ type: 3, content: 'Regular Title' }] } } })
          case 500:
            return Promise.resolve({ body: { chatInfo: { chatMetas: [{ type: 3, content: 'Open With Title' }] } } })
          case 600:
            return Promise.resolve({ body: { chatInfo: { chatMetas: [] } } })
          default:
            return Promise.resolve({ body: {} })
        }
      })
      mockGetOpenLinkInfo.mockResolvedValueOnce({ body: { ols: [{ ln: 'Open Link Name' }] } })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const chats = await client.getChats({ resolveTitles: true })

      const byId = Object.fromEntries(chats.map((c) => [c.chat_id, c]))
      expect(byId['100'].title).toBe('Regular Title')
      expect(byId['500'].title).toBe('Open With Title')
      expect(byId['600'].title).toBe('Open Link Name')

      // INFOLINK fires only for the open chat that lacked a TITLE meta — not
      // for the regular chat (skipped by isOpenChat) and not for the open
      // chat that already had a TITLE (skipped by short-circuit).
      expect(mockGetOpenLinkInfo).toHaveBeenCalledTimes(1)
      const [linkIds] = mockGetOpenLinkInfo.mock.calls[0] as [Array<{ low: number; high: number }>]
      expect(linkIds).toHaveLength(1)
      expect(linkIds[0]).toMatchObject({ low: 8888, high: 0 })

      client.close()
    })

    it('sorts chats by recency (o field descending)', async () => {
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const chats = await client.getChats()

      // chat 100 has o=1700000000, chat 200 has o=1699999000
      expect(chats[0].chat_id).toBe('100')
      expect(chats[1].chat_id).toBe('200')

      client.close()
    })

    it('filters by search term', async () => {
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const chats = await client.getChats({ search: 'alice' })

      expect(chats).toHaveLength(1)
      expect(chats[0].display_name).toBe('Alice, Bob')

      client.close()
    })

    it('falls back to LCHATLIST when login snapshot is empty (new device)', async () => {
      // given — LOGINLIST returns empty chatDatas with eof:true (new device scenario)
      const emptyLoginResult = {
        chatDatas: [],
        lastTokenId: makeLong(0),
        lastChatId: makeLong(0),
        eof: true,
      }
      mockLogin.mockResolvedValue(emptyLoginResult)

      mockGetChatList.mockResolvedValueOnce({
        statusCode: 0,
        body: {
          status: 0,
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

    it('does not call LCHATLIST when login snapshot has chats', async () => {
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      await client.getChats()

      expect(mockGetChatList).not.toHaveBeenCalled()

      client.close()
    })

    it('paginates when all=true and not eof', async () => {
      const loginResult = {
        ...DEFAULT_LOGIN_RESULT,
        eof: false,
      }
      mockLogin.mockResolvedValue(loginResult)

      mockGetChatList.mockResolvedValueOnce({
        statusCode: 0,
        body: {
          status: 0,
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

    it('deduplicates chats by id', async () => {
      const loginResult = {
        ...DEFAULT_LOGIN_RESULT,
        eof: false,
      }
      mockLogin.mockResolvedValue(loginResult)

      // Return a chat with same ID as login result
      mockGetChatList.mockResolvedValueOnce({
        statusCode: 0,
        body: {
          status: 0,
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

    it('normalizes Long-like chat ids from LCHATLIST pages', async () => {
      const loginResult = {
        ...DEFAULT_LOGIN_RESULT,
        eof: false,
      }
      mockLogin.mockResolvedValue(loginResult)

      mockGetChatList.mockResolvedValueOnce({
        statusCode: 0,
        body: {
          status: 0,
          chatDatas: [
            {
              c: makeLong(300),
              t: 1,
              k: ['Dave'],
              i: [4],
              a: 1,
              n: 0,
              o: 1698000000,
              l: { authorId: 4, message: 'from paginated chat', sendAt: 1698000000 },
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

      const paginatedChat = chats.find((chat) => chat.chat_id === '300')
      expect(paginatedChat?.chat_id).toBe('300')
      expect(paginatedChat?.display_name).toBe('Dave')
      expect(paginatedChat?.last_message?.author_name).toBe('Dave')
      expect(chats.some((chat) => chat.chat_id === '[object Object]')).toBe(false)

      client.close()
    })

    it('collects every LCHATLIST page until an explicit EOF', async () => {
      mockLogin.mockResolvedValue({ ...DEFAULT_LOGIN_RESULT, eof: false })
      mockGetChatList
        .mockResolvedValueOnce({
          statusCode: 0,
          body: {
            status: 0,
            chatDatas: [
              {
                c: 300,
                t: 1,
                k: ['Dave'],
                i: [4],
                a: 1,
                n: 0,
                o: 1698000000,
                l: null,
                ll: makeLong(100),
              },
            ],
            lastTokenId: makeLong(1),
            lastChatId: makeLong(300),
            eof: false,
          },
        })
        .mockResolvedValueOnce({
          statusCode: 0,
          body: {
            status: 0,
            chatDatas: [
              {
                c: 400,
                t: 1,
                k: ['Erin'],
                i: [5],
                a: 1,
                n: 0,
                o: 1697000000,
                l: null,
                ll: makeLong(90),
              },
            ],
            lastTokenId: makeLong(2),
            lastChatId: makeLong(400),
            eof: true,
          },
        })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const chats = await client.getChats({ all: true })

      expect(chats.map((chat) => chat.chat_id)).toEqual(['100', '200', '300', '400'])
      expect(mockGetChatList).toHaveBeenCalledTimes(2)

      client.close()
    })

    it('fails closed when LCHATLIST has a nonzero response status', async () => {
      mockLogin.mockResolvedValue({ ...DEFAULT_LOGIN_RESULT, eof: false })
      mockGetChatList.mockResolvedValueOnce({
        statusCode: 503,
        body: { status: 0, chatDatas: [], lastTokenId: makeLong(1), lastChatId: makeLong(300), eof: true },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })

      await expect(client.getChats({ all: true })).rejects.toMatchObject({
        code: 'get_chats_failed',
        responseFailureKind: 'provider_rejection',
        serverStatus: 503,
      })

      client.close()
    })

    it('fails closed on an empty non-EOF LCHATLIST page', async () => {
      mockLogin.mockResolvedValue({ ...DEFAULT_LOGIN_RESULT, eof: false })
      mockGetChatList.mockResolvedValueOnce({
        statusCode: 0,
        body: { status: 0, chatDatas: [], lastTokenId: makeLong(1), lastChatId: makeLong(300), eof: false },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })

      await expect(client.getChats({ all: true })).rejects.toMatchObject({ code: 'get_chats_failed' })
      expect(mockGetChatList).toHaveBeenCalledTimes(1)

      client.close()
    })

    it('fails closed when LCHATLIST reaches the page cap without EOF', async () => {
      mockLogin.mockResolvedValue({ ...DEFAULT_LOGIN_RESULT, eof: false })
      let page = 0
      mockGetChatList.mockImplementation(async () => {
        page++
        return {
          statusCode: 0,
          body: {
            status: 0,
            chatDatas: [
              {
                c: 1000 + page,
                t: 1,
                k: [`Room ${page}`],
                i: [1000 + page],
                a: 1,
                n: 0,
                o: 1600000000 - page,
                l: null,
                ll: makeLong(page),
              },
            ],
            lastTokenId: makeLong(page),
            lastChatId: makeLong(1000 + page),
            eof: false,
          },
        }
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })

      await expect(client.getChats({ all: true })).rejects.toMatchObject({ code: 'get_chats_failed' })
      expect(mockGetChatList).toHaveBeenCalledTimes(50)

      client.close()
    })

    it('preserves non-all search compatibility on an empty non-EOF page', async () => {
      mockLogin.mockResolvedValue({ ...DEFAULT_LOGIN_RESULT, eof: false })
      mockGetChatList.mockResolvedValueOnce({
        body: { chatDatas: [], lastTokenId: makeLong(1), lastChatId: makeLong(300), eof: false },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const chats = await client.getChats({ search: 'Alice' })

      expect(chats.map((chat) => chat.chat_id)).toEqual(['100'])
      expect(mockGetChatList).toHaveBeenCalledTimes(1)

      client.close()
    })

    it('wraps errors as KakaoTalkError', async () => {
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

    it('exposes getChatTitle() for single-chat title resolution', async () => {
      mockGetChannelInfo.mockResolvedValueOnce({
        body: { chatInfo: { chatMetas: [{ type: 3, content: 'Direct Lookup' }] } },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const title = await client.getChatTitle('100')

      expect(title).toBe('Direct Lookup')
      expect(mockGetChannelInfo).toHaveBeenCalledTimes(1)

      client.close()
    })

    it('getChatTitle() returns null on CHATINFO failure', async () => {
      mockGetChannelInfo.mockRejectedValueOnce(new Error('Network error'))

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const title = await client.getChatTitle('100')

      expect(title).toBeNull()

      client.close()
    })

    it('getChatTitle() returns null on invalid chatId without contacting LOCO', async () => {
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const title = await client.getChatTitle('not-a-number')

      expect(title).toBeNull()
      expect(mockGetChannelInfo).not.toHaveBeenCalled()
      expect(mockLogin).not.toHaveBeenCalled()

      client.close()
    })

    it('falls back to INFOLINK link name for open chats with no TITLE meta', async () => {
      const openChatLogin = {
        chatDatas: [
          {
            c: 500,
            t: 'OM',
            li: makeLong(7777),
            k: ['User1', 'User2'],
            i: [10, 20],
            a: 2,
            n: 0,
            o: 1700000000,
            l: null,
            ll: makeLong(1),
          },
        ],
        lastTokenId: makeLong(0),
        lastChatId: makeLong(0),
        eof: true,
      }
      mockLogin.mockResolvedValue(openChatLogin)
      mockGetChannelInfo.mockResolvedValueOnce({ body: { chatInfo: { chatMetas: [] } } })
      mockGetOpenLinkInfo.mockResolvedValueOnce({ body: { ols: [{ ln: 'Open Group Title' }] } })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const title = await client.getChatTitle('500')

      expect(title).toBe('Open Group Title')
      expect(mockGetChannelInfo).toHaveBeenCalledTimes(1)
      expect(mockGetOpenLinkInfo).toHaveBeenCalledTimes(1)

      client.close()
    })

    it('does not call INFOLINK for non-open chats (regular MultiChat)', async () => {
      mockGetChannelInfo.mockResolvedValueOnce({ body: { chatInfo: { chatMetas: [] } } })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const title = await client.getChatTitle('100')

      expect(title).toBeNull()
      expect(mockGetOpenLinkInfo).not.toHaveBeenCalled()

      client.close()
    })

    it('does not call INFOLINK when CHATINFO already returned a TITLE meta', async () => {
      const openChatLogin = {
        chatDatas: [
          {
            c: 500,
            t: 'OM',
            li: makeLong(7777),
            k: [],
            i: [],
            a: 1,
            n: 0,
            o: 1700000000,
            l: null,
            ll: makeLong(1),
          },
        ],
        lastTokenId: makeLong(0),
        lastChatId: makeLong(0),
        eof: true,
      }
      mockLogin.mockResolvedValue(openChatLogin)
      mockGetChannelInfo.mockResolvedValueOnce({
        body: { chatInfo: { chatMetas: [{ type: 3, content: 'User Set Title' }] } },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const title = await client.getChatTitle('500')

      expect(title).toBe('User Set Title')
      expect(mockGetOpenLinkInfo).not.toHaveBeenCalled()

      client.close()
    })

    it('returns null when INFOLINK fails for open chats', async () => {
      const openChatLogin = {
        chatDatas: [
          {
            c: 500,
            t: 'OD',
            li: makeLong(7777),
            k: [],
            i: [],
            a: 1,
            n: 0,
            o: 1700000000,
            l: null,
            ll: makeLong(1),
          },
        ],
        lastTokenId: makeLong(0),
        lastChatId: makeLong(0),
        eof: true,
      }
      mockLogin.mockResolvedValue(openChatLogin)
      mockGetChannelInfo.mockResolvedValueOnce({ body: { chatInfo: { chatMetas: [] } } })
      mockGetOpenLinkInfo.mockRejectedValueOnce(new Error('INFOLINK timeout'))

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const title = await client.getChatTitle('500')

      expect(title).toBeNull()

      client.close()
    })

    it('returns null when open chat has no link id (li missing)', async () => {
      const openChatLogin = {
        chatDatas: [
          {
            c: 500,
            t: 'OM',
            k: [],
            i: [],
            a: 1,
            n: 0,
            o: 1700000000,
            l: null,
            ll: makeLong(1),
          },
        ],
        lastTokenId: makeLong(0),
        lastChatId: makeLong(0),
        eof: true,
      }
      mockLogin.mockResolvedValue(openChatLogin)
      mockGetChannelInfo.mockResolvedValueOnce({ body: { chatInfo: { chatMetas: [] } } })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const title = await client.getChatTitle('500')

      expect(title).toBeNull()
      expect(mockGetOpenLinkInfo).not.toHaveBeenCalled()

      client.close()
    })

    it('wraps getChatList failure as KakaoTalkError with code get_chats_failed', async () => {
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

  describe('getChat', () => {
    it('returns one fully normalized late chat from read-only CHATINFO', async () => {
      mockGetChannelInfo.mockResolvedValueOnce({
        statusCode: 0,
        body: {
          chatInfo: {
            chatId: makeLong(300),
            type: 11,
            left: false,
            activeMembersCount: 2,
            newMessageCount: 4,
            invalidNewMessageCount: false,
            lastLogId: makeLong(77),
            lastSeenLogId: makeLong(73),
            lastChatLog: {
              logId: makeLong(77),
              authorId: 42,
              type: 1,
              message: 'latest',
              sendAt: 1700000077,
            },
            displayMembers: [
              { userId: makeLong(42), nickName: 'Alice' },
              { userId: makeLong(43), nickName: 'Bob' },
            ],
            chatMetas: [{ type: 3, content: 'Late room' }],
            pushAlert: true,
          },
        },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const chat = await client.getChat('300')

      expect(chat).toEqual({
        chat_id: '300',
        type: 11,
        display_name: 'Alice, Bob',
        title: 'Late room',
        active_members: 2,
        unread_count: 4,
        last_message: {
          author_id: 42,
          author_name: 'Alice',
          message: 'latest',
          sent_at: 1700000077,
        },
      })

      client.close()
    })

    it('classifies an explicit CHATINFO header rejection without exposing response contents', async () => {
      mockGetChannelInfo.mockResolvedValueOnce({ statusCode: 403, body: {} })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })

      await expect(client.getChat('300')).rejects.toMatchObject({
        code: 'get_chat_failed',
        getChatFailureReason: 'provider_rejection',
        responseFailureKind: 'provider_rejection',
        responseStatusSource: 'packet',
        serverStatus: 403,
      })

      client.close()
    })

    it('classifies an explicit CHATINFO body rejection and preserves its numeric status', async () => {
      mockGetChannelInfo.mockResolvedValueOnce({ statusCode: 0, body: { status: -404 } })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })

      await expect(client.getChat('300')).rejects.toMatchObject({
        code: 'get_chat_failed',
        getChatFailureReason: 'provider_rejection',
        responseFailureKind: 'provider_rejection',
        responseStatusSource: 'body',
        serverStatus: -404,
      })

      client.close()
    })

    it('does not expose rejected CHATINFO body contents through public error metadata', async () => {
      const secretSentinel = 'secret-sentinel-do-not-emit'
      mockGetChannelInfo.mockResolvedValueOnce({
        statusCode: 0,
        body: { status: -404, secret: secretSentinel },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      let error: unknown
      try {
        await client.getChat('300')
      } catch (cause) {
        error = cause
      }

      expect(error).toBeInstanceOf(KakaoTalkError)
      const publicError = error as KakaoTalkError
      expect(publicError).toMatchObject({
        code: 'get_chat_failed',
        getChatFailureReason: 'provider_rejection',
        responseFailureKind: 'provider_rejection',
        responseStatusSource: 'body',
        serverStatus: -404,
      })
      expect(publicError.message).not.toContain(secretSentinel)
      expect(JSON.stringify(publicError)).not.toContain(secretSentinel)
      expect(JSON.stringify(publicError.cause)).not.toContain(secretSentinel)

      client.close()
    })

    it('classifies synthetic connection-close status -1 as transient rather than provider rejection', async () => {
      mockGetChannelInfo.mockResolvedValueOnce({ statusCode: -1, body: { error: 'connection closed' } })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })

      await expect(client.getChat('300')).rejects.toMatchObject({
        code: 'get_chat_failed',
        getChatFailureReason: 'synthetic_connection_close',
        responseFailureKind: 'transient_or_unknown',
        responseStatusSource: 'packet',
        serverStatus: -1,
      })

      client.close()
    })

    it('does not classify status -1 with a nonmatching body as a synthetic connection close', async () => {
      mockGetChannelInfo.mockResolvedValueOnce({ statusCode: -1, body: { error: 'provider rejected' } })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })

      await expect(client.getChat('300')).rejects.toMatchObject({
        code: 'get_chat_failed',
        getChatFailureReason: 'provider_rejection',
        responseFailureKind: 'provider_rejection',
        responseStatusSource: 'packet',
        serverStatus: -1,
      })

      client.close()
    })

    it('classifies a thrown CHATINFO transport failure as transient or unknown', async () => {
      const secretSentinel = 'secret-transport-body-do-not-emit'
      mockGetChannelInfo.mockRejectedValueOnce(
        Object.assign(new Error('socket unavailable'), { body: { secret: secretSentinel } }),
      )

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })

      let error: unknown
      try {
        await client.getChat('300')
      } catch (cause) {
        error = cause
      }

      expect(error).toBeInstanceOf(KakaoTalkError)
      expect(error).toMatchObject({
        code: 'get_chat_failed',
        getChatFailureReason: 'transport_or_unknown',
        responseFailureKind: 'transient_or_unknown',
      })
      const serialized = JSON.stringify(error)
      expect(serialized).not.toContain(secretSentinel)
      expect(serialized).not.toContain('body')
      expect(serialized).not.toContain('message')
      expect(serialized).not.toContain('cause')

      client.close()
    })

    it('classifies a successful CHATINFO response without chatInfo as structurally absent', async () => {
      const secretSentinel = 'secret-chat-body-do-not-emit'
      mockGetChannelInfo.mockResolvedValueOnce({ statusCode: 0, body: { secret: secretSentinel } })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })

      let error: unknown
      try {
        await client.getChat('300')
      } catch (cause) {
        error = cause
      }

      expect(error).toBeInstanceOf(KakaoTalkError)
      expect(error).toMatchObject({
        code: 'get_chat_failed',
        getChatFailureReason: 'chat_info_absent',
        responseFailureKind: 'transient_or_unknown',
      })
      const serialized = JSON.stringify(error)
      expect(serialized).not.toContain(secretSentinel)
      expect(serialized).not.toContain('body')
      expect(serialized).not.toContain('message')
      expect(serialized).not.toContain('cause')

      client.close()
    })

    it('classifies a successful CHATINFO response with null chatInfo as structurally absent', async () => {
      const secretSentinel = 'secret-null-chat-body-do-not-emit'
      const chatIdSentinel = '987654321012345678'
      mockGetChannelInfo.mockResolvedValueOnce({
        statusCode: 0,
        body: { chatInfo: null, secret: secretSentinel },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })

      let error: unknown
      try {
        await client.getChat(chatIdSentinel)
      } catch (cause) {
        error = cause
      }

      expect(error).toBeInstanceOf(KakaoTalkError)
      expect(error).toMatchObject({
        code: 'get_chat_failed',
        getChatFailureReason: 'chat_info_absent',
        responseFailureKind: 'transient_or_unknown',
      })
      const serialized = JSON.stringify(error)
      expect(serialized).not.toContain(secretSentinel)
      expect(serialized).not.toContain('body')
      expect(serialized).not.toContain('message')
      expect(serialized).not.toContain('cause')
      expect(serialized).not.toContain('chatId')
      expect(serialized).not.toContain(chatIdSentinel)

      client.close()
    })

    it('classifies exact CHATINFO left=true as structurally absent without exposing response contents', async () => {
      const secretSentinel = 'secret-left-chat-body-do-not-emit'
      const nativeChatIdSentinel = '987654321'
      mockGetChannelInfo.mockResolvedValueOnce({
        statusCode: 0,
        body: {
          chatInfo: {
            left: true,
            chatId: makeLong(Number(nativeChatIdSentinel)),
            secret: secretSentinel,
          },
        },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })

      let error: unknown
      try {
        await client.getChat(nativeChatIdSentinel)
      } catch (cause) {
        error = cause
      }

      expect(error).toBeInstanceOf(KakaoTalkError)
      expect(error).toMatchObject({
        code: 'get_chat_failed',
        getChatFailureReason: 'chat_info_absent',
        responseFailureKind: 'transient_or_unknown',
      })
      const publicError = error as KakaoTalkError
      const serialized = JSON.stringify(publicError)
      expect(publicError.message).not.toContain(secretSentinel)
      expect(publicError.message).not.toContain(nativeChatIdSentinel)
      expect(serialized).not.toContain(secretSentinel)
      expect(serialized).not.toContain(nativeChatIdSentinel)

      client.close()
    })

    for (const [label, chatInfo] of [
      ['mismatched chatId', { left: true, chatId: makeLong(301) }],
      ['missing chatId', { left: true }],
      ['invalid chatId', { left: true, chatId: { invalid: true } }],
    ] as const) {
      it(`does not classify CHATINFO left=true with ${label} as structurally absent`, async () => {
        mockGetChannelInfo.mockResolvedValueOnce({
          statusCode: 0,
          body: { chatInfo },
        })

        const client = await new KakaoTalkClient().login({
          oauthToken: 'token',
          userId: 'user1',
          deviceUuid: 'device1',
        })

        await expect(client.getChat('300')).rejects.toMatchObject({
          code: 'get_chat_failed',
          getChatFailureReason: 'transport_or_unknown',
          responseFailureKind: 'transient_or_unknown',
        })

        client.close()
      })
    }

    for (const [label, chatInfo] of [
      ['left=false', { left: false }],
      ['left missing', {}],
      ['left nonboolean', { left: 'true' }],
    ] as const) {
      it(`does not classify malformed successful CHATINFO with ${label} as structurally absent`, async () => {
        mockGetChannelInfo.mockResolvedValueOnce({
          statusCode: 0,
          body: { chatInfo },
        })

        const client = await new KakaoTalkClient().login({
          oauthToken: 'token',
          userId: 'user1',
          deviceUuid: 'device1',
        })

        await expect(client.getChat('300')).rejects.toMatchObject({
          code: 'get_chat_failed',
          getChatFailureReason: 'transport_or_unknown',
          responseFailureKind: 'transient_or_unknown',
        })

        client.close()
      })
    }

    it('classifies malformed successful CHATINFO chatInfo as transport or unknown', async () => {
      mockGetChannelInfo.mockResolvedValueOnce({
        statusCode: 0,
        body: { chatInfo: { chatId: makeLong(300) } },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })

      await expect(client.getChat('300')).rejects.toMatchObject({
        code: 'get_chat_failed',
        getChatFailureReason: 'transport_or_unknown',
        responseFailureKind: 'transient_or_unknown',
      })

      client.close()
    })

    for (const openChatType of ['OM', 'OD'] as const) {
      it(`preserves ${openChatType} and falls back to INFOLINK when CHATINFO has no title`, async () => {
        mockGetChannelInfo.mockResolvedValueOnce({
          statusCode: 0,
          body: {
            chatInfo: {
              chatId: makeLong(300),
              type: openChatType,
              activeMembersCount: 2,
              newMessageCount: 0,
              invalidNewMessageCount: false,
              lastLogId: makeLong(77),
              lastSeenLogId: makeLong(73),
              lastChatLog: null,
              displayMembers: [
                { userId: makeLong(42), nickName: 'Alice' },
                { userId: makeLong(43), nickName: 'Bob' },
              ],
              chatMetas: [],
              li: makeLong(7777),
              pushAlert: true,
            },
          },
        })
        mockGetOpenLinkInfo.mockResolvedValueOnce({ body: { ols: [{ ln: 'Open Group Title' }] } })

        const client = await new KakaoTalkClient().login({
          oauthToken: 'token',
          userId: 'user1',
          deviceUuid: 'device1',
        })
        const chat = await client.getChat('300')

        expect(chat).toEqual({
          chat_id: '300',
          type: openChatType,
          display_name: 'Alice, Bob',
          title: 'Open Group Title',
          active_members: 2,
          unread_count: 0,
          last_message: null,
        })
        expect(mockGetOpenLinkInfo).toHaveBeenCalledTimes(1)

        client.close()
      })
    }

    it('falls back to INFOLINK for a numeric open-chat code', async () => {
      mockGetChannelInfo.mockResolvedValueOnce({
        statusCode: 0,
        body: {
          chatInfo: {
            chatId: makeLong(300),
            type: 13,
            activeMembersCount: 2,
            newMessageCount: 0,
            invalidNewMessageCount: false,
            lastLogId: makeLong(77),
            lastSeenLogId: makeLong(73),
            lastChatLog: null,
            displayMembers: [],
            chatMetas: [],
            li: makeLong(7777),
            pushAlert: true,
          },
        },
      })
      mockGetOpenLinkInfo.mockResolvedValueOnce({ body: { ols: [{ ln: 'Numeric Open Title' }] } })

      const client = await new KakaoTalkClient().login({
        oauthToken: 'token',
        userId: 'user1',
        deviceUuid: 'device1',
      })
      const chat = await client.getChat('300')

      expect(chat.type).toBe(13)
      expect(chat.title).toBe('Numeric Open Title')
      expect(mockGetOpenLinkInfo).toHaveBeenCalledTimes(1)

      client.close()
    })

    for (const normalChatType of ['DirectChat', 'MultiChat', 'PlusChat', 'MemoChat'] as const) {
      it(`preserves donor-defined ${normalChatType} without contacting INFOLINK`, async () => {
        mockGetChannelInfo.mockResolvedValueOnce({
          statusCode: 0,
          body: {
            chatInfo: {
              chatId: makeLong(300),
              type: normalChatType,
              activeMembersCount: 2,
              newMessageCount: 0,
              invalidNewMessageCount: false,
              lastLogId: makeLong(1),
              lastSeenLogId: makeLong(0),
              displayMembers: [],
              chatMetas: [],
              li: makeLong(7777),
              pushAlert: true,
            },
          },
        })

        const client = await new KakaoTalkClient().login({
          oauthToken: 'token',
          userId: 'user1',
          deviceUuid: 'device1',
        })

        await expect(client.getChat('300')).resolves.toEqual({
          chat_id: '300',
          type: normalChatType,
          display_name: null,
          title: null,
          active_members: 2,
          unread_count: 0,
          last_message: null,
        })
        expect(mockGetOpenLinkInfo).not.toHaveBeenCalled()

        client.close()
      })
    }

    it('rejects an empty string CHATINFO type without contacting INFOLINK', async () => {
      mockGetChannelInfo.mockResolvedValueOnce({
        statusCode: 0,
        body: {
          chatInfo: {
            chatId: makeLong(300),
            type: '',
            activeMembersCount: 2,
            newMessageCount: 0,
            invalidNewMessageCount: false,
            lastLogId: makeLong(1),
            lastSeenLogId: makeLong(0),
            displayMembers: [],
            chatMetas: [],
            pushAlert: true,
          },
        },
      })

      const client = await new KakaoTalkClient().login({
        oauthToken: 'token',
        userId: 'user1',
        deviceUuid: 'device1',
      })

      await expect(client.getChat('300')).rejects.toMatchObject({
        code: 'get_chat_failed',
        getChatFailureReason: 'transport_or_unknown',
        responseFailureKind: 'transient_or_unknown',
      })
      expect(mockGetOpenLinkInfo).not.toHaveBeenCalled()

      client.close()
    })

    it('preserves an unknown non-empty string CHATINFO type without contacting INFOLINK', async () => {
      mockGetChannelInfo.mockResolvedValueOnce({
        statusCode: 0,
        body: {
          chatInfo: {
            chatId: makeLong(300),
            type: 'UnknownChat',
            activeMembersCount: 2,
            newMessageCount: 0,
            invalidNewMessageCount: false,
            lastLogId: makeLong(1),
            lastSeenLogId: makeLong(0),
            displayMembers: [],
            chatMetas: [],
            pushAlert: true,
          },
        },
      })

      const client = await new KakaoTalkClient().login({
        oauthToken: 'token',
        userId: 'user1',
        deviceUuid: 'device1',
      })

      await expect(client.getChat('300')).resolves.toEqual({
        chat_id: '300',
        type: 'UnknownChat',
        display_name: null,
        title: null,
        active_members: 2,
        unread_count: 0,
        last_message: null,
      })
      expect(mockGetOpenLinkInfo).not.toHaveBeenCalled()

      client.close()
    })

    it('rejects a CHATINFO response bound to a different chat id', async () => {
      mockGetChannelInfo.mockResolvedValueOnce({
        statusCode: 0,
        body: {
          chatInfo: {
            chatId: makeLong(999),
            type: 11,
            activeMembersCount: 2,
            newMessageCount: 0,
            invalidNewMessageCount: false,
            lastLogId: makeLong(1),
            lastSeenLogId: makeLong(0),
            displayMembers: [],
            chatMetas: [],
            pushAlert: true,
          },
        },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })

      await expect(client.getChat('300')).rejects.toMatchObject({ code: 'get_chat_failed' })

      client.close()
    })

    it('rejects an invalid chat id before opening a LOCO session', async () => {
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })

      await expect(client.getChat('not-a-number')).rejects.toMatchObject({ code: 'invalid_chat_id' })
      expect(mockLogin).not.toHaveBeenCalled()
      expect(mockGetChannelInfo).not.toHaveBeenCalled()

      client.close()
    })
  })

  describe('getMessages', () => {
    it('returns a lossless forward page without discarding the oldest messages', async () => {
      mockGetChatLogs.mockResolvedValueOnce({
        statusCode: 0,
        body: {
          status: 0,
          chatLogs: Array.from({ length: 5 }, (_, index) => ({
            logId: makeLong(index + 1),
            chatId: 100,
            type: 1,
            authorId: 42,
            message: `message-${index + 1}`,
            sendAt: 1700000000 + index,
          })),
          eof: true,
        },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const page = await client.getMessagePage('100', { count: 2 })

      expect(page.messages.map((message) => message.log_id)).toEqual(['1', '2'])
      expect(page.next_cursor).toBe('2')
      expect(page.complete).toBe(false)

      client.close()
    })

    it('returns a complete forward page when the protocol page is exhausted', async () => {
      mockGetChatLogs.mockResolvedValueOnce({
        statusCode: 0,
        body: {
          status: 0,
          chatLogs: [
            { logId: makeLong(11), chatId: 100, type: 1, authorId: 42, message: 'eleven', sendAt: 11 },
            { logId: makeLong(10), chatId: 100, type: 1, authorId: 42, message: 'ten', sendAt: 10 },
          ],
          eof: true,
        },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const page = await client.getMessagePage('100', { from: '9', count: 10 })

      expect(page.messages.map((message) => message.log_id)).toEqual(['10', '11'])
      expect(page.next_cursor).toBe('11')
      expect(page.complete).toBe(true)

      client.close()
    })

    it('continues exclusively after the supplied cursor when the server repeats it', async () => {
      mockGetChatLogs.mockResolvedValueOnce({
        statusCode: 0,
        body: {
          status: 0,
          chatLogs: [
            { logId: makeLong(2), chatId: 100, type: 1, authorId: 42, message: 'repeat', sendAt: 2 },
            { logId: makeLong(3), chatId: 100, type: 1, authorId: 42, message: 'three', sendAt: 3 },
            { logId: makeLong(4), chatId: 100, type: 1, authorId: 42, message: 'four', sendAt: 4 },
          ],
          eof: true,
        },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const page = await client.getMessagePage('100', { from: '2', count: 10 })

      expect(page.messages.map((message) => message.log_id)).toEqual(['3', '4'])
      expect(page.next_cursor).toBe('4')
      expect(page.complete).toBe(true)

      client.close()
    })

    it('does not report completion when the protocol makes no cursor progress', async () => {
      mockGetChatLogs.mockResolvedValueOnce({
        statusCode: 0,
        body: { status: 0, chatLogs: [], eof: false },
      })
      mockGetChannelInfo.mockResolvedValueOnce({
        statusCode: 0,
        body: {
          chatInfo: {
            chatId: makeLong(100),
            type: 11,
            activeMembersCount: 2,
            newMessageCount: 0,
            invalidNewMessageCount: false,
            lastLogId: makeLong(999),
            lastSeenLogId: makeLong(0),
            displayMembers: [],
            chatMetas: [],
            pushAlert: true,
          },
        },
      })
      mockSyncMessages.mockResolvedValueOnce({
        statusCode: 0,
        body: { status: 0, chatLogs: [], isOK: false },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const page = await client.getMessagePage('100', { from: '9', count: 10 })

      expect(page).toEqual({ messages: [], next_cursor: null, complete: false })

      client.close()
    })

    it('uses read-only CHATINFO to paginate a late room missing from the login snapshot', async () => {
      mockLogin.mockResolvedValueOnce({ ...structuredClone(DEFAULT_LOGIN_RESULT), chatDatas: [] })
      mockGetChatLogs.mockResolvedValueOnce({
        statusCode: 0,
        body: { status: 0, chatLogs: [], eof: true },
      })
      mockGetChannelInfo.mockResolvedValueOnce({
        statusCode: 0,
        body: {
          chatInfo: {
            chatId: makeLong(300),
            type: 11,
            activeMembersCount: 2,
            newMessageCount: 1,
            invalidNewMessageCount: false,
            lastLogId: makeLong(12),
            lastSeenLogId: makeLong(0),
            displayMembers: [],
            chatMetas: [],
            pushAlert: true,
          },
        },
      })
      mockSyncMessages.mockResolvedValueOnce({
        statusCode: 0,
        body: {
          status: 0,
          isOK: true,
          chatLogs: [{ logId: makeLong(12), chatId: 300, type: 1, authorId: 42, message: 'late', sendAt: 12 }],
        },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const page = await client.getMessagePage('300', { from: '11', count: 10 })

      expect(page.messages.map((message) => message.log_id)).toEqual(['12'])
      expect(page.next_cursor).toBe('12')
      expect(page.complete).toBe(true)
      expect(mockGetChatInfo).not.toHaveBeenCalled()
      expect(mockSyncMessages.mock.calls[0]?.[2]?.toString()).toBe('11')
      expect(mockSyncMessages.mock.calls[0]?.[3]?.toString()).toBe('12')

      client.close()
    })

    it('falls back to SYNCMSG when MCHATLOGS succeeds with an empty result', async () => {
      const loginResult = structuredClone(DEFAULT_LOGIN_RESULT)
      loginResult.chatDatas[0]!.ll = makeLong(10)
      mockLogin.mockResolvedValueOnce(loginResult)
      mockGetChatLogs.mockResolvedValueOnce({
        body: { status: 0, chatLogs: [], eof: true },
      })
      mockSyncMessages.mockResolvedValueOnce({
        body: {
          status: 0,
          isOK: true,
          chatLogs: [
            { logId: makeLong(10), chatId: 100, type: 1, authorId: 42, message: 'fallback', sendAt: 1700000001 },
          ],
        },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const messages = await client.getMessages('100')

      expect(messages).toHaveLength(1)
      expect(messages[0]?.message).toBe('fallback')
      expect(mockGetChatInfo).not.toHaveBeenCalled()
      expect(mockSyncMessages).toHaveBeenCalledTimes(1)
      expect(mockSyncMessages.mock.calls[0]?.[3]?.toString()).toBe('10')

      client.close()
    })

    it('does not enter or sync a room when the MCHATLOGS cursor is already current', async () => {
      mockGetChatLogs.mockResolvedValueOnce({
        body: { status: 0, chatLogs: [], eof: true },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const messages = await client.getMessages('100', { from: '999' })

      expect(messages).toEqual([])
      expect(mockGetChatInfo).not.toHaveBeenCalled()
      expect(mockSyncMessages).not.toHaveBeenCalled()

      client.close()
    })

    it('uses SYNCMSG without entering the room when the chat-list watermark is ahead of the cursor', async () => {
      const loginResult = structuredClone(DEFAULT_LOGIN_RESULT)
      loginResult.chatDatas[0]!.ll = makeLong(10)
      mockLogin.mockResolvedValueOnce(loginResult)
      mockGetChatLogs.mockResolvedValueOnce({
        body: { status: 0, chatLogs: [], eof: true },
      })
      mockSyncMessages.mockResolvedValueOnce({
        body: {
          status: 0,
          isOK: true,
          chatLogs: [
            { logId: makeLong(10), chatId: 100, type: 1, authorId: 42, message: 'incremental', sendAt: 1700000001 },
          ],
        },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const messages = await client.getMessages('100', { from: '9' })

      expect(messages).toHaveLength(1)
      expect(messages[0]?.message).toBe('incremental')
      expect(mockGetChatInfo).not.toHaveBeenCalled()
      expect(mockSyncMessages.mock.calls[0]?.[2]?.toString()).toBe('9')
      expect(mockSyncMessages.mock.calls[0]?.[3]?.toString()).toBe('10')

      client.close()
    })

    it('uses the last-message log ID when the primary chat-list watermark is missing', async () => {
      const loginResult = structuredClone(DEFAULT_LOGIN_RESULT)
      const chat = loginResult.chatDatas[0]! as Record<string, unknown>
      delete chat.ll
      chat.l = { logId: makeLong(12) }
      mockLogin.mockResolvedValueOnce(loginResult)
      mockGetChatLogs.mockResolvedValueOnce({
        body: { status: 0, chatLogs: [], eof: true },
      })
      mockSyncMessages.mockResolvedValueOnce({
        body: {
          status: 0,
          isOK: true,
          chatLogs: [
            { logId: makeLong(12), chatId: 100, type: 1, authorId: 42, message: 'last-log', sendAt: 1700000001 },
          ],
        },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const messages = await client.getMessages('100', { from: '11' })

      expect(messages).toHaveLength(1)
      expect(messages[0]?.message).toBe('last-log')
      expect(mockGetChatInfo).not.toHaveBeenCalled()
      expect(mockSyncMessages.mock.calls[0]?.[2]?.toString()).toBe('11')
      expect(mockSyncMessages.mock.calls[0]?.[3]?.toString()).toBe('12')

      client.close()
    })

    it('returns empty without entering the room when no chat-list watermark is available', async () => {
      mockLogin.mockResolvedValueOnce({ ...structuredClone(DEFAULT_LOGIN_RESULT), chatDatas: [] })
      mockGetChatLogs.mockResolvedValueOnce({
        body: { status: 0, chatLogs: [], eof: true },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const messages = await client.getMessages('100')

      expect(messages).toEqual([])
      expect(mockGetChatInfo).not.toHaveBeenCalled()
      expect(mockSyncMessages).not.toHaveBeenCalled()

      client.close()
    })

    it('returns formatted messages', async () => {
      mockGetChatLogs.mockResolvedValueOnce({
        body: {
          status: 0,
          chatLogs: [
            { logId: makeLong(10), chatId: 100, type: 1, authorId: 42, message: 'hello', sendAt: 1700000001 },
            { logId: makeLong(11), chatId: 100, type: 1, authorId: 43, message: 'world', sendAt: 1700000002 },
          ],
          eof: true,
        },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const messages = await client.getMessages('100')

      expect(messages).toHaveLength(2)
      expect(messages[0]).toEqual({
        log_id: '10',
        type: 1,
        author_id: 42,
        author_name: null,
        message: 'hello',
        attachment: null,
        sent_at: 1700000001,
      })
      expect(messages[1]).toEqual({
        log_id: '11',
        type: 1,
        author_id: 43,
        author_name: null,
        message: 'world',
        attachment: null,
        sent_at: 1700000002,
      })

      client.close()
    })

    it('resolves author_name for known members from the chat list cache', async () => {
      mockGetChatLogs.mockResolvedValueOnce({
        body: {
          status: 0,
          chatLogs: [
            { logId: makeLong(1), chatId: 100, type: 1, authorId: 1, message: 'from Alice', sendAt: 100 },
            { logId: makeLong(2), chatId: 100, type: 1, authorId: 2, message: 'from Bob', sendAt: 200 },
            { logId: makeLong(3), chatId: 100, type: 1, authorId: 99, message: 'from a stranger', sendAt: 300 },
          ],
          eof: true,
        },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      // Trigger login so the cache is populated from DEFAULT_LOGIN_RESULT
      await client.getChats()
      const messages = await client.getMessages('100')

      expect(messages[0].author_name).toBe('Alice')
      expect(messages[1].author_name).toBe('Bob')
      expect(messages[2].author_name).toBeNull()

      client.close()
    })

    it('respects count option', async () => {
      const logs = Array.from({ length: 50 }, (_, i) => ({
        logId: makeLong(i + 1),
        chatId: 100,
        type: 1,
        authorId: 1,
        message: `msg-${i}`,
        sendAt: 1700000000 + i,
      }))

      mockGetChatLogs.mockResolvedValueOnce({
        body: { status: 0, chatLogs: logs, eof: true },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const messages = await client.getMessages('100', { count: 5 })

      expect(messages).toHaveLength(5)
      // Should return the LAST 5 (most recent)
      expect(messages[0].message).toBe('msg-45')
      expect(messages[4].message).toBe('msg-49')

      client.close()
    })

    it('sorts messages by sent_at ascending', async () => {
      mockGetChatLogs.mockResolvedValueOnce({
        body: {
          status: 0,
          chatLogs: [
            { logId: makeLong(2), chatId: 100, type: 1, authorId: 1, message: 'second', sendAt: 200 },
            { logId: makeLong(1), chatId: 100, type: 1, authorId: 1, message: 'first', sendAt: 100 },
          ],
          eof: true,
        },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const messages = await client.getMessages('100')

      expect(messages[0].message).toBe('first')
      expect(messages[1].message).toBe('second')

      client.close()
    })

    it('parses chatLog.attachment JSON for photo messages', async () => {
      mockGetChatLogs.mockResolvedValueOnce({
        body: {
          status: 0,
          chatLogs: [
            {
              logId: makeLong(20),
              chatId: 100,
              type: 2,
              authorId: 42,
              message: '사진',
              sendAt: 1700000010,
              attachment: '{"k":"path/to/img.jpg","w":1320,"h":2868,"mt":"image/jpeg"}',
            },
          ],
          eof: true,
        },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const messages = await client.getMessages('100')

      expect(messages[0].attachment).toEqual({
        k: 'path/to/img.jpg',
        w: 1320,
        h: 2868,
        mt: 'image/jpeg',
      })

      client.close()
    })

    it('returns null attachment for malformed JSON', async () => {
      mockGetChatLogs.mockResolvedValueOnce({
        body: {
          status: 0,
          chatLogs: [
            {
              logId: makeLong(21),
              chatId: 100,
              type: 1,
              authorId: 42,
              message: 'broken',
              sendAt: 1700000011,
              attachment: 'not-json',
            },
          ],
          eof: true,
        },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const messages = await client.getMessages('100')

      expect(messages[0].attachment).toBeNull()

      client.close()
    })
  })

  describe('sendMessage', () => {
    it('returns send result on success', async () => {
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

    it('reports failure when statusCode is non-zero', async () => {
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

    it('wraps transport errors as KakaoTalkError', async () => {
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

    it('routes to sendReply with a built reply extra when replyTo is given', async () => {
      // given
      mockSendReply.mockResolvedValueOnce({ statusCode: 0, body: { logId: makeLong(50), sendAt: 1700000100 } })
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })

      // when
      const result = await client.sendMessage('100', 'replying', {
        replyTo: { log_id: '42', author_id: 7, message: 'original', type: 1 },
      })

      // then
      expect(mockSendMessage).not.toHaveBeenCalled()
      expect(mockSendReply).toHaveBeenCalledTimes(1)
      const [, text, extra] = mockSendReply.mock.calls[0] as [unknown, string, Record<string, unknown>]
      expect(text).toBe('replying')
      expect(extra).toEqual({
        attach_only: false,
        attach_type: 1,
        src_logId: '42',
        src_userId: 7,
        src_message: 'original',
        src_type: 1,
        src_mentions: [],
        mentions: [],
      })
      expect(result).toEqual({
        success: true,
        status_code: 0,
        chat_id: '100',
        log_id: '50',
        sent_at: 1700000100,
      })

      client.close()
    })

    it('mirrors the source message type into attach_type/src_type', async () => {
      // given
      mockSendReply.mockResolvedValueOnce({ statusCode: 0, body: { logId: makeLong(51), sendAt: 1700000101 } })
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })

      // when — replying to a photo (type 2)
      await client.sendMessage('100', 'nice pic', {
        replyTo: { log_id: '99', author_id: 3, message: 'photo', type: 2 },
      })

      // then
      const [, , extra] = mockSendReply.mock.calls[0] as [unknown, string, Record<string, unknown>]
      expect(extra.attach_type).toBe(2)
      expect(extra.src_type).toBe(2)

      client.close()
    })
  })

  describe('markRead', () => {
    it('calls session.markRead with parsed chatId/watermark and no linkId for normal chat', async () => {
      // given
      mockMarkRead.mockResolvedValueOnce({ statusCode: 0, body: { status: 0 } })
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })

      // when
      const result = await client.markRead('100', '42')

      // then
      expect(mockMarkRead).toHaveBeenCalledTimes(1)
      const [chatIdArg, watermarkArg, linkIdArg] = mockMarkRead.mock.calls[0] as [
        { toString(): string },
        { toString(): string },
        unknown,
      ]
      expect(chatIdArg.toString()).toBe('100')
      expect(watermarkArg.toString()).toBe('42')
      expect(linkIdArg).toBeUndefined()
      expect(result).toEqual({ success: true, status_code: 0, chat_id: '100', watermark: '42' })

      client.close()
    })

    it('forwards linkId when caller passes it (open chat)', async () => {
      // given
      mockMarkRead.mockResolvedValueOnce({ statusCode: 0, body: { status: 0 } })
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })

      // when
      await client.markRead('200', '999', { linkId: '77777' })

      // then
      const [, , linkIdArg] = mockMarkRead.mock.calls[0] as [unknown, unknown, { toString(): string }]
      expect(linkIdArg).toBeDefined()
      expect(linkIdArg.toString()).toBe('77777')

      client.close()
    })

    it('reports success when body.status is absent (treated as 0)', async () => {
      // given
      mockMarkRead.mockResolvedValueOnce({ statusCode: 0, body: {} })
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })

      // when
      const result = await client.markRead('100', '42')

      // then
      expect(result).toEqual({ success: true, status_code: 0, chat_id: '100', watermark: '42' })

      client.close()
    })

    it('reports failure from body.status (not transport statusCode) - the open-chat-missing-link case', async () => {
      // given
      mockMarkRead.mockResolvedValueOnce({ statusCode: 0, body: { status: -500 } })
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })

      // when
      const result = await client.markRead('100', '42')

      // then
      expect(result).toEqual({ success: false, status_code: -500, chat_id: '100', watermark: '42' })

      client.close()
    })

    it('throws (so executeWithReconnect retries) on transport-level statusCode != 0', async () => {
      // given - simulates LocoConnection.handleClose synthetic packet
      mockMarkRead.mockRejectedValue(new Error('NOTIREAD failed: statusCode=-1'))
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })

      // when / then
      try {
        await client.markRead('100', '42')
        throw new Error('expected to throw')
      } catch (e) {
        expect(e).toBeInstanceOf(KakaoTalkError)
        expect((e as KakaoTalkError).code).toBe('mark_read_failed')
      }

      client.close()
    })

    it('treats synthetic disconnect packet (statusCode: -1) as transport failure (throws)', async () => {
      // given
      mockMarkRead.mockResolvedValueOnce({ statusCode: -1, body: { error: 'connection closed' } })
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })

      // when / then
      try {
        await client.markRead('100', '42')
        throw new Error('expected to throw')
      } catch (e) {
        expect(e).toBeInstanceOf(KakaoTalkError)
        expect((e as KakaoTalkError).code).toBe('mark_read_failed')
      }

      client.close()
    })

    it('throws KakaoTalkError(invalid_chat_id) for non-numeric chatId', async () => {
      // given
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })

      // when / then
      try {
        await client.markRead('not-a-number', '42')
        throw new Error('expected to throw')
      } catch (e) {
        expect(e).toBeInstanceOf(KakaoTalkError)
        expect((e as KakaoTalkError).code).toBe('invalid_chat_id')
      }

      client.close()
    })

    it('throws KakaoTalkError(invalid_log_id) for non-numeric logId', async () => {
      // given
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })

      // when / then
      try {
        await client.markRead('100', 'not-a-number')
        throw new Error('expected to throw')
      } catch (e) {
        expect(e).toBeInstanceOf(KakaoTalkError)
        expect((e as KakaoTalkError).code).toBe('invalid_log_id')
      }

      client.close()
    })

    it('throws KakaoTalkError(invalid_link_id) for non-numeric linkId', async () => {
      // given
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })

      // when / then
      try {
        await client.markRead('100', '42', { linkId: 'not-a-number' })
        throw new Error('expected to throw')
      } catch (e) {
        expect(e).toBeInstanceOf(KakaoTalkError)
        expect((e as KakaoTalkError).code).toBe('invalid_link_id')
      }

      client.close()
    })

    it('wraps transport errors as KakaoTalkError(mark_read_failed)', async () => {
      // given
      mockMarkRead.mockRejectedValue(new Error('Socket closed'))
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })

      // when / then
      try {
        await client.markRead('100', '42')
        throw new Error('expected to throw')
      } catch (e) {
        expect(e).toBeInstanceOf(KakaoTalkError)
        expect((e as KakaoTalkError).code).toBe('mark_read_failed')
      }

      client.close()
    })
  })

  describe('leaveChat', () => {
    it('calls session.leaveChat with parsed chatId and returns success', async () => {
      mockLeaveChat.mockResolvedValueOnce({ statusCode: 0, body: {} })
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })

      const result = await client.leaveChat('100')

      expect(result).toEqual({ success: true, status_code: 0, chat_id: '100' })
      expect(mockLeaveChat).toHaveBeenCalledWith(expect.objectContaining({ low: 100, high: 0 }))

      client.close()
    })

    it('treats synthetic disconnect packet (statusCode: -1) as transport failure (throws)', async () => {
      mockLeaveChat.mockResolvedValueOnce({ statusCode: -1, body: { error: 'connection closed' } })
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })

      try {
        await client.leaveChat('100')
        throw new Error('expected to throw')
      } catch (e) {
        expect(e).toBeInstanceOf(KakaoTalkError)
        expect((e as KakaoTalkError).code).toBe('leave_chat_failed')
      }

      client.close()
    })

    it('evicts the departed chat from getChats cache', async () => {
      mockLeaveChat.mockResolvedValueOnce({ statusCode: 0, body: {} })
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })

      const before = await client.getChats()
      expect(before).toHaveLength(2)

      await client.leaveChat('100')

      const after = await client.getChats()
      expect(after).toHaveLength(1)
      expect(after[0].chat_id).toBe('200')

      client.close()
    })

    it('reconnects and retries leaveChat after silent disconnect (full executeWithReconnect path)', async () => {
      const closeHandlers: Array<() => void> = []
      mockOnClose.mockImplementation((handler: () => void) => {
        closeHandlers.push(handler)
      })

      mockLeaveChat.mockImplementationOnce(() => {
        const handler = closeHandlers[0]
        if (handler) handler()
        return Promise.resolve({ statusCode: -1, body: { error: 'connection closed' } })
      })
      mockLeaveChat.mockResolvedValueOnce({ statusCode: 0, body: {} })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const result = await client.leaveChat('100')

      expect(result.success).toBe(true)
      expect(mockLeaveChat).toHaveBeenCalledTimes(2)
      expect(mockLogin).toHaveBeenCalledTimes(2)

      client.close()
    })

    it('throws KakaoTalkError(invalid_chat_id) for non-numeric chatId', async () => {
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })

      try {
        await client.leaveChat('not-a-number')
        throw new Error('expected to throw')
      } catch (e) {
        expect(e).toBeInstanceOf(KakaoTalkError)
        expect((e as KakaoTalkError).code).toBe('invalid_chat_id')
      }

      client.close()
    })

    it('wraps transport errors as KakaoTalkError(leave_chat_failed)', async () => {
      mockLeaveChat.mockRejectedValue(new Error('Socket closed'))
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })

      try {
        await client.leaveChat('100')
        throw new Error('expected to throw')
      } catch (e) {
        expect(e).toBeInstanceOf(KakaoTalkError)
        expect((e as KakaoTalkError).code).toBe('leave_chat_failed')
      }

      client.close()
    })
  })

  describe('sendTyping', () => {
    it('forwards parsed chatId to session.sendTyping and reports success on statusCode 0', async () => {
      mockSendTyping.mockResolvedValueOnce({ statusCode: 0, body: {} })
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })

      const result = await client.sendTyping('12345')

      expect(mockSendTyping).toHaveBeenCalledTimes(1)
      const [chatIdArg, linkIdArg] = mockSendTyping.mock.calls[0] as [{ toString(): string }, unknown]
      expect(chatIdArg.toString()).toBe('12345')
      expect(linkIdArg).toBeUndefined()
      expect(result).toEqual({ success: true, status_code: 0, chat_id: '12345' })

      client.close()
    })

    it('passes linkId through when provided (open-chat typing)', async () => {
      mockSendTyping.mockResolvedValueOnce({ statusCode: 0, body: {} })
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })

      await client.sendTyping('12345', { linkId: '77777' })

      const [, linkIdArg] = mockSendTyping.mock.calls[0] as [unknown, { toString(): string }]
      expect(linkIdArg).toBeDefined()
      expect(linkIdArg.toString()).toBe('77777')

      client.close()
    })

    it('throws KakaoTalkError(send_typing_failed) on transport-level failure (non-zero statusCode)', async () => {
      mockSendTyping.mockResolvedValueOnce({ statusCode: -100, body: {} })
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })

      try {
        await client.sendTyping('12345')
        throw new Error('expected to throw')
      } catch (e) {
        expect(e).toBeInstanceOf(KakaoTalkError)
        expect((e as KakaoTalkError).code).toBe('send_typing_failed')
      }

      client.close()
    })

    it('throws KakaoTalkError(send_typing_failed) when the session throws (transport error)', async () => {
      mockSendTyping.mockRejectedValue(new Error('ACTION failed: statusCode=-1'))
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })

      try {
        await client.sendTyping('12345')
        throw new Error('expected to throw')
      } catch (e) {
        expect(e).toBeInstanceOf(KakaoTalkError)
        expect((e as KakaoTalkError).code).toBe('send_typing_failed')
      }

      client.close()
    })

    it('throws KakaoTalkError(invalid_chat_id) for non-numeric chatId', async () => {
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })

      try {
        await client.sendTyping('not-a-number')
        throw new Error('expected to throw')
      } catch (e) {
        expect(e).toBeInstanceOf(KakaoTalkError)
        expect((e as KakaoTalkError).code).toBe('invalid_chat_id')
      }

      client.close()
    })

    it('throws KakaoTalkError(invalid_link_id) for non-numeric linkId', async () => {
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })

      try {
        await client.sendTyping('12345', { linkId: 'not-a-number' })
        throw new Error('expected to throw')
      } catch (e) {
        expect(e).toBeInstanceOf(KakaoTalkError)
        expect((e as KakaoTalkError).code).toBe('invalid_link_id')
      }

      client.close()
    })
  })

  describe('getMembers / getMembersByIds', () => {
    it('returns formatted members from GETMEM with normalized fields', async () => {
      mockGetChannelInfo.mockResolvedValueOnce(memberChannelInfo(2)).mockResolvedValueOnce(memberChannelInfo(2))
      mockGetAllMembers.mockResolvedValue({
        statusCode: 0,
        body: {
          members: [
            {
              userId: makeLong(42),
              nickName: 'Alice',
              type: 100,
              profileImageUrl: 'https://kakao.com/p/alice.jpg',
              fullProfileImageUrl: 'https://kakao.com/p/alice-full.jpg',
              originalProfileImageUrl: 'https://kakao.com/p/alice-orig.jpg',
              statusMessage: 'hi',
              countryIso: 'KR',
            },
            {
              userId: makeLong(43),
              nickName: 'Bob',
              type: 1000,
              pi: 'https://kakao.com/p/bob.jpg',
              fpi: 'https://kakao.com/p/bob-full.jpg',
              opi: 'https://kakao.com/p/bob-orig.jpg',
              opt: 12345,
              pli: makeLong(99),
              mt: 4,
            },
          ],
          token: 0,
        },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const members = await client.getMembers('100')

      expect(members).toHaveLength(2)
      expect(members[0]).toEqual({
        user_id: '42',
        nickname: 'Alice',
        profile_image_url: 'https://kakao.com/p/alice.jpg',
        full_profile_image_url: 'https://kakao.com/p/alice-full.jpg',
        original_profile_image_url: 'https://kakao.com/p/alice-orig.jpg',
        status_message: 'hi',
        country_iso: 'KR',
        user_type: 100,
        open_token: null,
        open_profile_link_id: null,
        open_permission: null,
      })
      expect(members[1]).toEqual({
        user_id: '43',
        nickname: 'Bob',
        profile_image_url: 'https://kakao.com/p/bob.jpg',
        full_profile_image_url: 'https://kakao.com/p/bob-full.jpg',
        original_profile_image_url: 'https://kakao.com/p/bob-orig.jpg',
        status_message: null,
        country_iso: null,
        user_type: 1000,
        open_token: 12345,
        open_profile_link_id: '99',
        open_permission: 4,
      })
      expect(mockGetChatInfo).not.toHaveBeenCalled()

      client.close()
    })

    it('rejects a partial GETMEM snapshot without entering the room', async () => {
      mockGetChannelInfo.mockResolvedValueOnce(memberChannelInfo(3)).mockResolvedValueOnce(memberChannelInfo(3))
      mockGetAllMembers.mockResolvedValue({
        statusCode: 0,
        body: {
          members: [
            {
              userId: makeLong(42),
              nickName: 'Alice',
              type: 100,
              profileImageUrl: 'https://kakao.com/p/alice.jpg',
            },
          ],
          token: 0,
        },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      await expect(client.getMembers('100')).rejects.toMatchObject({
        code: 'get_members_failed',
      })
      expect(mockGetChatInfo).not.toHaveBeenCalled()

      client.close()
    })

    it('returns a stable empty snapshot for a zero-member room without CHATONROOM', async () => {
      mockGetChannelInfo.mockResolvedValue(memberChannelInfo(0))
      mockGetAllMembers.mockResolvedValue({
        statusCode: 0,
        body: { members: [] },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const snapshot = await client.getMemberSnapshot('100')

      expect(snapshot).toMatchObject({
        chat_id: '100',
        active_members: 0,
        complete: true,
        consistency_basis: 'stable_double_read_chatinfo_getmem',
      })
      expect(snapshot.members).toEqual([])
      expect(mockGetAllMembers).toHaveBeenCalledTimes(2)
      expect(mockGetChatInfo).not.toHaveBeenCalled()

      client.close()
    })

    it('returns a stable CHATINFO GETMEM snapshot without CHATONROOM', async () => {
      const visible = [
        {
          userId: makeLong(42),
          nickName: 'Alice',
          type: 100,
        },
      ]
      mockGetChannelInfo
        .mockResolvedValueOnce(memberChannelInfo(2, visible))
        .mockResolvedValueOnce(memberChannelInfo(2, visible))
      mockGetAllMembers.mockResolvedValue({
        statusCode: 0,
        body: {
          members: [
            visible[0],
            {
              userId: makeLong(43),
              nickName: 'Bob',
              type: 100,
            },
          ],
        },
      })

      const client = await new KakaoTalkClient().login({
        oauthToken: 'token',
        userId: 'user1',
        deviceUuid: 'device1',
      })
      const snapshot = await client.getMemberSnapshot('100')

      expect(snapshot).toMatchObject({
        chat_id: '100',
        active_members: 2,
        complete: true,
        consistency_basis: 'stable_double_read_chatinfo_getmem',
      })
      expect(snapshot.members.map((member) => member.user_id)).toEqual(['42', '43'])
      expect(mockGetAllMembers).toHaveBeenCalledTimes(2)
      expect(mockGetChannelInfo).toHaveBeenCalledTimes(2)
      expect(mockGetChatInfo).not.toHaveBeenCalled()

      client.close()
    })

    it('fails closed when active membership changes across the snapshot', async () => {
      mockGetChannelInfo.mockResolvedValueOnce(memberChannelInfo(2)).mockResolvedValueOnce(memberChannelInfo(3))
      mockGetAllMembers.mockResolvedValue({
        statusCode: 0,
        body: {
          members: [
            { userId: makeLong(42), nickName: 'Alice' },
            { userId: makeLong(43), nickName: 'Bob' },
          ],
        },
      })

      const client = await new KakaoTalkClient().login({
        oauthToken: 'token',
        userId: 'user1',
        deviceUuid: 'device1',
      })
      await expect(client.getMemberSnapshot('100')).rejects.toMatchObject({
        code: 'get_member_snapshot_failed',
      })
      expect(mockGetChatInfo).not.toHaveBeenCalled()

      client.close()
    })

    it('fails closed on a same-cardinality hidden member swap', async () => {
      const visible = [{ userId: makeLong(42), nickName: 'Visible' }]
      mockGetChannelInfo
        .mockResolvedValueOnce(memberChannelInfo(2, visible))
        .mockResolvedValueOnce(memberChannelInfo(2, visible))
      mockGetAllMembers
        .mockResolvedValueOnce({
          statusCode: 0,
          body: {
            members: [visible[0], { userId: makeLong(43), nickName: 'Departed' }],
          },
        })
        .mockResolvedValueOnce({
          statusCode: 0,
          body: {
            members: [visible[0], { userId: makeLong(44), nickName: 'Joined' }],
          },
        })

      const client = await new KakaoTalkClient().login({
        oauthToken: 'token',
        userId: 'user1',
        deviceUuid: 'device1',
      })
      await expect(client.getMemberSnapshot('100')).rejects.toMatchObject({
        code: 'get_member_snapshot_failed',
      })

      client.close()
    })

    it('fails closed on malformed CHATINFO member identity', async () => {
      mockGetChannelInfo.mockResolvedValueOnce(memberChannelInfo(1, [{ userId: {}, nickName: 'Malformed' }]))

      const client = await new KakaoTalkClient().login({
        oauthToken: 'token',
        userId: 'user1',
        deviceUuid: 'device1',
      })
      await expect(client.getMemberSnapshot('100')).rejects.toMatchObject({
        code: 'get_member_snapshot_failed',
      })
      expect(mockGetAllMembers).not.toHaveBeenCalled()

      client.close()
    })

    it('fails closed on malformed GETMEM member identity', async () => {
      mockGetChannelInfo.mockResolvedValueOnce(memberChannelInfo(1))
      mockGetAllMembers.mockResolvedValueOnce({
        statusCode: 0,
        body: {
          members: [{ userId: '42', nickName: 'Malformed string id' }],
        },
      })

      const client = await new KakaoTalkClient().login({
        oauthToken: 'token',
        userId: 'user1',
        deviceUuid: 'device1',
      })
      await expect(client.getMemberSnapshot('100')).rejects.toMatchObject({
        code: 'get_member_snapshot_failed',
      })

      client.close()
    })

    it('fails closed on duplicate GETMEM identity without CHATONROOM', async () => {
      mockGetChannelInfo.mockResolvedValueOnce(memberChannelInfo(2))
      mockGetAllMembers.mockResolvedValue({
        statusCode: 0,
        body: {
          members: [
            { userId: makeLong(42), nickName: 'Alice' },
            { userId: makeLong(42), nickName: 'Duplicate' },
          ],
        },
      })

      const client = await new KakaoTalkClient().login({
        oauthToken: 'token',
        userId: 'user1',
        deviceUuid: 'device1',
      })
      await expect(client.getMemberSnapshot('100')).rejects.toMatchObject({
        code: 'get_member_snapshot_failed',
      })
      expect(mockGetChatInfo).not.toHaveBeenCalled()

      client.close()
    })

    it('fails closed on CHATINFO chat id mismatch before GETMEM', async () => {
      mockGetChannelInfo.mockResolvedValueOnce(memberChannelInfo(1, [], 101))

      const client = await new KakaoTalkClient().login({
        oauthToken: 'token',
        userId: 'user1',
        deviceUuid: 'device1',
      })
      await expect(client.getMemberSnapshot('100')).rejects.toMatchObject({
        code: 'get_member_snapshot_failed',
      })
      expect(mockGetAllMembers).not.toHaveBeenCalled()
      expect(mockGetChatInfo).not.toHaveBeenCalled()

      client.close()
    })

    it('normalizes missing user_type to null and treats pli=0 as absent', async () => {
      mockGetChannelInfo.mockResolvedValueOnce(memberChannelInfo(3)).mockResolvedValueOnce(memberChannelInfo(3))
      mockGetAllMembers.mockResolvedValue({
        statusCode: 0,
        body: {
          members: [
            { userId: makeLong(1), nickName: 'NoType' },
            { userId: makeLong(2), nickName: 'ZeroPli', type: 1000, pli: makeLong(0) },
            { userId: makeLong(3), nickName: 'NumericZeroPli', type: 1000, pli: 0 },
          ],
        },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const members = await client.getMembers('100')

      expect(members[0].user_type).toBeNull()
      expect(members[0].open_profile_link_id).toBeNull()
      expect(members[1].user_type).toBe(1000)
      expect(members[1].open_profile_link_id).toBeNull()
      expect(members[2].open_profile_link_id).toBeNull()

      client.close()
    })

    it('wraps GETMEM failures as KakaoTalkError get_members_failed', async () => {
      mockGetChannelInfo.mockResolvedValueOnce(memberChannelInfo(1))
      mockGetAllMembers.mockRejectedValueOnce(new Error('Network error'))

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      try {
        await client.getMembers('100')
        expect.unreachable('should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(KakaoTalkError)
        expect((e as KakaoTalkError).code).toBe('get_members_failed')
      }

      client.close()
    })

    it('throws on synthetic disconnect packet from GETMEM (statusCode != 0)', async () => {
      mockGetChannelInfo.mockResolvedValueOnce(memberChannelInfo(1))
      mockGetAllMembers.mockResolvedValueOnce({
        statusCode: -1,
        body: { error: 'connection closed' },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      try {
        await client.getMembers('100')
        expect.unreachable('should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(KakaoTalkError)
        expect((e as KakaoTalkError).code).toBe('get_members_failed')
      }

      client.close()
    })

    it('throws on GETMEM body.status nonzero', async () => {
      mockGetChannelInfo.mockResolvedValueOnce(memberChannelInfo(1))
      mockGetAllMembers.mockResolvedValueOnce({
        statusCode: 0,
        body: { status: -500 },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      try {
        await client.getMembers('100')
        expect.unreachable('should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(KakaoTalkError)
        expect((e as KakaoTalkError).code).toBe('get_members_failed')
      }

      client.close()
    })

    it('getMembersByIds passes parsed Long IDs to MEMBER request', async () => {
      mockGetMembersByIds.mockResolvedValueOnce({
        statusCode: 0,
        body: {
          chatId: makeLong(100),
          members: [{ userId: makeLong(42), nickName: 'Alice', type: 100 }],
        },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const members = await client.getMembersByIds('100', ['42', '43', '99'])

      expect(members).toHaveLength(1)
      expect(members[0].nickname).toBe('Alice')
      expect(mockGetMembersByIds).toHaveBeenCalledTimes(1)

      // Verify the actual LOCO call args, not just the call count: chatId is a
      // Long-shaped { low, high } and memberIds is a list of Longs in the order
      // the SDK consumer passed them. Guards against accidentally sending raw
      // strings or losing IDs — both fail silently server-side.
      const [chatIdArg, memberIdsArg] = mockGetMembersByIds.mock.calls[0] as [
        { low: number; high: number },
        Array<{ low: number; high: number }>,
      ]
      expect(chatIdArg).toMatchObject({ low: 100, high: 0 })
      expect(memberIdsArg).toHaveLength(3)
      expect(memberIdsArg[0]).toMatchObject({ low: 42, high: 0 })
      expect(memberIdsArg[1]).toMatchObject({ low: 43, high: 0 })
      expect(memberIdsArg[2]).toMatchObject({ low: 99, high: 0 })

      client.close()
    })

    it('wraps MEMBER failures as KakaoTalkError get_members_failed', async () => {
      mockGetMembersByIds.mockRejectedValueOnce(new Error('Network error'))

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      try {
        await client.getMembersByIds('100', ['42'])
        expect.unreachable('should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(KakaoTalkError)
        expect((e as KakaoTalkError).code).toBe('get_members_failed')
      }

      client.close()
    })

    it('throws on synthetic disconnect packet from MEMBER (statusCode != 0)', async () => {
      mockGetMembersByIds.mockResolvedValueOnce({
        statusCode: -1,
        body: { error: 'connection closed' },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      try {
        await client.getMembersByIds('100', ['42'])
        expect.unreachable('should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(KakaoTalkError)
        expect((e as KakaoTalkError).code).toBe('get_members_failed')
      }

      client.close()
    })

    it('throws on MEMBER body.status nonzero', async () => {
      mockGetMembersByIds.mockResolvedValueOnce({
        statusCode: 0,
        body: { status: -500 },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      try {
        await client.getMembersByIds('100', ['42'])
        expect.unreachable('should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(KakaoTalkError)
        expect((e as KakaoTalkError).code).toBe('get_members_failed')
      }

      client.close()
    })

    it('getMembers throws KakaoTalkError invalid_chat_id without contacting LOCO', async () => {
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      try {
        await client.getMembers('not-a-number')
        expect.unreachable('should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(KakaoTalkError)
        expect((e as KakaoTalkError).code).toBe('invalid_chat_id')
      }
      expect(mockGetAllMembers).not.toHaveBeenCalled()
      expect(mockGetChannelInfo).not.toHaveBeenCalled()
      expect(mockGetChatInfo).not.toHaveBeenCalled()
      expect(mockLogin).not.toHaveBeenCalled()

      client.close()
    })

    it('getMembersByIds throws invalid_chat_id for bad chatId without contacting LOCO', async () => {
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      try {
        await client.getMembersByIds('not-a-number', ['42'])
        expect.unreachable('should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(KakaoTalkError)
        expect((e as KakaoTalkError).code).toBe('invalid_chat_id')
      }
      expect(mockGetMembersByIds).not.toHaveBeenCalled()
      expect(mockLogin).not.toHaveBeenCalled()

      client.close()
    })

    it('getMembersByIds throws invalid_user_id for bad userId without contacting LOCO', async () => {
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      try {
        await client.getMembersByIds('100', ['42', 'bogus', '99'])
        expect.unreachable('should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(KakaoTalkError)
        expect((e as KakaoTalkError).code).toBe('invalid_user_id')
      }
      expect(mockGetMembersByIds).not.toHaveBeenCalled()
      expect(mockLogin).not.toHaveBeenCalled()

      client.close()
    })

    it('getMembersByIds returns [] without contacting LOCO when userIds is empty', async () => {
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const result = await client.getMembersByIds('100', [])

      expect(result).toEqual([])
      expect(mockGetMembersByIds).not.toHaveBeenCalled()
      expect(mockLogin).not.toHaveBeenCalled()

      client.close()
    })

    it('reconnects and retries getMembers after silent disconnect (full executeWithReconnect path)', async () => {
      // Earlier tests verify assertLocoOk throws on a synthetic-disconnect packet,
      // but they don't exercise the reconnect path: executeWithReconnect only
      // retries when the underlying socket also closed (state.session !== this.state.session).
      // This test fires the captured onClose callback before the rejection so the
      // client's state is nulled, then verifies the operation is retried against
      // a fresh session and the second response is returned to the caller.
      const closeHandlers: Array<() => void> = []
      mockOnClose.mockImplementation((handler: () => void) => {
        closeHandlers.push(handler)
      })

      mockGetAllMembers.mockImplementationOnce(() => {
        // Fire the close handler captured during the first session's setup —
        // simulates the LOCO TCP socket closing while the GETMEM is in flight.
        // executeWithReconnect sees state.session !== this.state.session and retries.
        const handler = closeHandlers[0]
        if (handler) handler()
        return Promise.resolve({ statusCode: -1, body: { error: 'connection closed' } })
      })
      mockGetAllMembers.mockResolvedValue({
        statusCode: 0,
        body: { members: [{ userId: makeLong(42), nickName: 'Alice', type: 100 }] },
      })
      mockGetChannelInfo
        .mockResolvedValueOnce(memberChannelInfo(1))
        .mockResolvedValueOnce(memberChannelInfo(1))
        .mockResolvedValueOnce(memberChannelInfo(1))

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      const members = await client.getMembers('100')

      expect(members).toHaveLength(1)
      expect(members[0].nickname).toBe('Alice')
      expect(mockGetAllMembers).toHaveBeenCalledTimes(3)
      expect(mockGetChatInfo).not.toHaveBeenCalled()
      // Login fires twice: once for the initial connect, once for the reconnect
      // after the captured onClose handler invalidated this.state.
      expect(mockLogin).toHaveBeenCalledTimes(2)

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

    it('returns profile data on success', async () => {
      mockFetch
        .mockResolvedValueOnce(
          makeJsonResponse({
            profile: {
              nickName: 'Test User',
              profileImageUrl: 'https://example.com/profile.jpg',
              originalProfileImageUrl: 'https://example.com/original.jpg',
              statusMessage: 'Hello world',
            },
          }),
        )
        .mockResolvedValueOnce(makeJsonResponse({ accountDisplayId: 'testuser123' }))

      const client = await new KakaoTalkClient().login({
        oauthToken: 'mytoken',
        userId: 'user42',
        deviceUuid: 'device1',
      })
      const profile = await client.getProfile()

      expect(profile.user_id).toBe('user42')
      expect(profile.nickname).toBe('Test User')
      expect(profile.profile_image_url).toBe('https://example.com/profile.jpg')
      expect(profile.original_profile_image_url).toBe('https://example.com/original.jpg')
      expect(profile.status_message).toBe('Hello world')
      expect(profile.account_display_id).toBe('testuser123')

      client.close()
    })

    it('throws not_authenticated when not logged in', async () => {
      const client = new KakaoTalkClient()
      try {
        await client.getProfile()
        expect.unreachable('should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(KakaoTalkError)
        expect((e as KakaoTalkError).code).toBe('not_authenticated')
      }
    })

    it('throws profile_request_failed when profile HTTP request fails', async () => {
      mockFetch
        .mockResolvedValueOnce(makeJsonResponse({}, 401))
        .mockResolvedValueOnce(makeJsonResponse({ accountDisplayId: null }))

      const client = await new KakaoTalkClient().login({
        oauthToken: 'mytoken',
        userId: 'user42',
        deviceUuid: 'device1',
      })
      try {
        await client.getProfile()
        expect.unreachable('should have thrown')
      } catch (e) {
        expect(e).toBeInstanceOf(KakaoTalkError)
        expect((e as KakaoTalkError).code).toBe('profile_request_failed')
      }

      client.close()
    })

    it('returns null account_display_id when more_settings request fails', async () => {
      mockFetch
        .mockResolvedValueOnce(
          makeJsonResponse({
            profile: {
              nickName: 'Test User',
              profileImageUrl: null,
              originalProfileImageUrl: null,
              statusMessage: null,
            },
          }),
        )
        .mockResolvedValueOnce(makeJsonResponse({}, 500))

      const client = await new KakaoTalkClient().login({
        oauthToken: 'mytoken',
        userId: 'user42',
        deviceUuid: 'device1',
      })
      const profile = await client.getProfile()

      expect(profile.user_id).toBe('user42')
      expect(profile.nickname).toBe('Test User')
      expect(profile.account_display_id).toBeNull()

      client.close()
    })
  })

  describe('session lifecycle', () => {
    it('lazy init: does not call login until first method call', async () => {
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      expect(mockLogin).not.toHaveBeenCalled()
      client.close()
    })

    it('calls login on first method call', async () => {
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      await client.getChats()
      expect(mockLogin).toHaveBeenCalledTimes(1)
      client.close()
    })

    it('reuses session across multiple calls', async () => {
      mockGetChatLogs.mockResolvedValue({
        body: { status: 0, chatLogs: [], eof: true },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      await client.getChats()
      await client.getMessages('100')

      expect(mockLogin).toHaveBeenCalledTimes(1)

      client.close()
    })

    it('concurrent calls share a single login', async () => {
      // Make login take some time
      mockLogin.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(DEFAULT_LOGIN_RESULT), 50)))
      mockGetChatLogs.mockResolvedValue({
        body: { status: 0, chatLogs: [], eof: true },
      })

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      await Promise.all([client.getChats(), client.getMessages('100')])

      expect(mockLogin).toHaveBeenCalledTimes(1)

      client.close()
    })

    it('retries login after failure', async () => {
      mockLogin.mockRejectedValueOnce(new Error('Connection refused')).mockResolvedValueOnce(DEFAULT_LOGIN_RESULT)

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })

      // First call fails
      await expect(client.getChats()).rejects.toThrow(KakaoTalkError)

      // Second call retries and succeeds
      const chats = await client.getChats()
      expect(chats).toHaveLength(2)
      expect(mockLogin).toHaveBeenCalledTimes(2)

      client.close()
    })

    it('close cleans up session state', async () => {
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      await client.getChats()

      client.close()
      expect(mockClose).toHaveBeenCalledTimes(1)
    })

    it('methods throw client_closed after close', async () => {
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

    it('close is idempotent', async () => {
      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      client.close()
      expect(() => client.close()).not.toThrow()
    })

    it('login failure closes the session to prevent socket leak', async () => {
      mockLogin.mockRejectedValue(new Error('Auth failed'))

      const client = await new KakaoTalkClient().login({ oauthToken: 'token', userId: 'user1', deviceUuid: 'device1' })
      await expect(client.getChats()).rejects.toThrow()

      // LocoSession.close() should have been called to clean up
      expect(mockClose).toHaveBeenCalledTimes(1)

      client.close()
    })
  })
})
