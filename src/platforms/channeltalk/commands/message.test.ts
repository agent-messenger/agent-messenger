import { beforeEach, describe, expect, mock, it } from 'bun:test'

const mockSendGroupMessage = mock(() =>
  Promise.resolve({
    id: 'msg-group-1',
    channelId: 'ws-1',
    chatId: 'grp-1',
    chatType: 'group',
    personType: 'manager',
    personId: 'mgr-1',
    createdAt: 1000,
    plainText: 'Hello group',
  }),
)

const mockSendUserChatMessage = mock(() =>
  Promise.resolve({
    id: 'msg-user-1',
    channelId: 'ws-1',
    chatId: 'chat-1',
    chatType: 'userChat',
    personType: 'manager',
    personId: 'mgr-1',
    createdAt: 1001,
    plainText: 'Hello user chat',
  }),
)

const mockSendDirectChatMessage = mock(() =>
  Promise.resolve({
    id: 'msg-direct-1',
    channelId: 'ws-1',
    chatId: 'dm-1',
    chatType: 'directChat',
    personType: 'manager',
    personId: 'mgr-1',
    createdAt: 1002,
    plainText: 'Hello direct chat',
  }),
)

const mockGetGroupMessages = mock(() =>
  Promise.resolve([
    {
      id: 'msg-group-list-1',
      channelId: 'ws-1',
      chatId: 'grp-1',
      chatType: 'group',
      personType: 'manager',
      personId: 'mgr-1',
      createdAt: 2000,
      plainText: 'Group message',
      blocks: [{ type: 'text', content: [{ type: 'plain', attrs: { text: 'Group message' } }] }],
    },
  ]),
)

const mockGetUserChatMessages = mock(() =>
  Promise.resolve([
    {
      id: 'msg-user-list-1',
      channelId: 'ws-1',
      chatId: 'chat-1',
      chatType: 'userChat',
      personType: 'manager',
      personId: 'mgr-1',
      createdAt: 2001,
      plainText: 'User chat message',
      blocks: [{ type: 'text', content: [{ type: 'plain', attrs: { text: 'User chat message' } }] }],
    },
  ]),
)

const mockGetDirectChatMessages = mock(() =>
  Promise.resolve([
    {
      id: 'msg-direct-list-1',
      channelId: 'ws-1',
      chatId: 'dm-1',
      chatType: 'directChat',
      personType: 'manager',
      personId: 'mgr-1',
      createdAt: 2002,
      plainText: 'Direct chat message',
      blocks: [{ type: 'text', content: [{ type: 'plain', attrs: { text: 'Direct chat message' } }] }],
    },
  ]),
)

const mockSearchTeamChatMessages = mock(() =>
  Promise.resolve({
    hits: [
      {
        index: 'messages-2026-03',
        score: 'NaN',
        source: {
          id: 'msg-search-1',
          channelId: 'ws-1',
          chatType: 'group',
          chatId: 'grp-1',
          personType: 'manager',
          personId: 'mgr-1',
          createdAt: 3000,
          plainText: 'search result message',
        },
        highlight: {
          plainText: { name: 'plainText', fragments: ['<em>search</em> result message'] },
        },
        searchAfter: [3000, 'msg-search-1'],
      },
    ],
    bots: [],
    sessions: [],
    groups: [],
  }),
)

const mockSearchUserChatMessages = mock(() =>
  Promise.resolve({
    hits: [
      {
        index: 'messages-2026-03',
        score: 'NaN',
        source: {
          id: 'msg-search-2',
          channelId: 'ws-1',
          chatType: 'userChat',
          chatId: 'chat-1',
          personType: 'manager',
          personId: 'mgr-1',
          createdAt: 3001,
          plainText: 'user chat search result',
        },
        highlight: {
          plainText: { name: 'plainText', fragments: ['user chat <em>search</em> result'] },
        },
        searchAfter: [3001, 'msg-search-2'],
      },
    ],
    bots: [],
    sessions: [],
    userChats: [],
  }),
)

mock.module('./shared', () => ({
  getClient: async () => ({
    sendGroupMessage: mockSendGroupMessage,
    sendUserChatMessage: mockSendUserChatMessage,
    sendDirectChatMessage: mockSendDirectChatMessage,
    getGroupMessages: mockGetGroupMessages,
    getUserChatMessages: mockGetUserChatMessages,
    getDirectChatMessages: mockGetDirectChatMessages,
    searchTeamChatMessages: mockSearchTeamChatMessages,
    searchUserChatMessages: mockSearchUserChatMessages,
  }),
  getCurrentWorkspaceId: async () => 'ws-1',
}))

import { getAction, listAction, searchAction, sendAction } from './message'

describe('message commands', () => {
  beforeEach(() => {
    mockSendGroupMessage.mockReset()
    mockSendGroupMessage.mockImplementation(() =>
      Promise.resolve({
        id: 'msg-group-1',
        channelId: 'ws-1',
        chatId: 'grp-1',
        chatType: 'group',
        personType: 'manager',
        personId: 'mgr-1',
        createdAt: 1000,
        plainText: 'Hello group',
      }),
    )
    mockSendUserChatMessage.mockReset()
    mockSendUserChatMessage.mockImplementation(() =>
      Promise.resolve({
        id: 'msg-user-1',
        channelId: 'ws-1',
        chatId: 'chat-1',
        chatType: 'userChat',
        personType: 'manager',
        personId: 'mgr-1',
        createdAt: 1001,
        plainText: 'Hello user chat',
      }),
    )
    mockSendDirectChatMessage.mockReset()
    mockSendDirectChatMessage.mockImplementation(() =>
      Promise.resolve({
        id: 'msg-direct-1',
        channelId: 'ws-1',
        chatId: 'dm-1',
        chatType: 'directChat',
        personType: 'manager',
        personId: 'mgr-1',
        createdAt: 1002,
        plainText: 'Hello direct chat',
      }),
    )
    mockGetGroupMessages.mockReset()
    mockGetGroupMessages.mockImplementation(() =>
      Promise.resolve([
        {
          id: 'msg-group-list-1',
          channelId: 'ws-1',
          chatId: 'grp-1',
          chatType: 'group',
          personType: 'manager',
          personId: 'mgr-1',
          createdAt: 2000,
          plainText: 'Group message',
          blocks: [{ type: 'text', content: [{ type: 'plain', attrs: { text: 'Group message' } }] }],
        },
      ]),
    )
    mockGetUserChatMessages.mockReset()
    mockGetUserChatMessages.mockImplementation(() =>
      Promise.resolve([
        {
          id: 'msg-user-list-1',
          channelId: 'ws-1',
          chatId: 'chat-1',
          chatType: 'userChat',
          personType: 'manager',
          personId: 'mgr-1',
          createdAt: 2001,
          plainText: 'User chat message',
          blocks: [{ type: 'text', content: [{ type: 'plain', attrs: { text: 'User chat message' } }] }],
        },
      ]),
    )
    mockGetDirectChatMessages.mockReset()
    mockGetDirectChatMessages.mockImplementation(() =>
      Promise.resolve([
        {
          id: 'msg-direct-list-1',
          channelId: 'ws-1',
          chatId: 'dm-1',
          chatType: 'directChat',
          personType: 'manager',
          personId: 'mgr-1',
          createdAt: 2002,
          plainText: 'Direct chat message',
          blocks: [{ type: 'text', content: [{ type: 'plain', attrs: { text: 'Direct chat message' } }] }],
        },
      ]),
    )
    mockSearchTeamChatMessages.mockReset()
    mockSearchTeamChatMessages.mockImplementation(() =>
      Promise.resolve({
        hits: [
          {
            index: 'messages-2026-03',
            score: 'NaN',
            source: {
              id: 'msg-search-1',
              channelId: 'ws-1',
              chatType: 'group',
              chatId: 'grp-1',
              personType: 'manager',
              personId: 'mgr-1',
              createdAt: 3000,
              plainText: 'search result message',
            },
            highlight: {
              plainText: { name: 'plainText', fragments: ['<em>search</em> result message'] },
            },
            searchAfter: [3000, 'msg-search-1'],
          },
        ],
        bots: [],
        sessions: [],
        groups: [],
      }),
    )
    mockSearchUserChatMessages.mockReset()
    mockSearchUserChatMessages.mockImplementation(() =>
      Promise.resolve({
        hits: [
          {
            index: 'messages-2026-03',
            score: 'NaN',
            source: {
              id: 'msg-search-2',
              channelId: 'ws-1',
              chatType: 'userChat',
              chatId: 'chat-1',
              personType: 'manager',
              personId: 'mgr-1',
              createdAt: 3001,
              plainText: 'user chat search result',
            },
            highlight: {
              plainText: { name: 'plainText', fragments: ['user chat <em>search</em> result'] },
            },
            searchAfter: [3001, 'msg-search-2'],
          },
        ],
        bots: [],
        sessions: [],
        userChats: [],
      }),
    )
  })

  it('sendAction sends a group message with wrapped blocks', async () => {
    const result = await sendAction('group', 'grp-1', 'Hello group')

    expect(mockSendGroupMessage).toHaveBeenCalledWith('ws-1', 'grp-1', [{ type: 'text', value: 'Hello group' }])
    expect(result).toMatchObject({
      id: 'msg-group-1',
      channel_id: 'ws-1',
      chat_id: 'grp-1',
      chat_type: 'group',
      plain_text: 'Hello group',
    })
  })

  it('sendAction sends a user chat message with wrapped blocks', async () => {
    const result = await sendAction('user-chat', 'chat-1', 'Hello user chat')

    expect(mockSendUserChatMessage).toHaveBeenCalledWith('ws-1', 'chat-1', [{ type: 'text', value: 'Hello user chat' }])
    expect(result).toMatchObject({
      id: 'msg-user-1',
      channel_id: 'ws-1',
      chat_id: 'chat-1',
      chat_type: 'userChat',
      plain_text: 'Hello user chat',
    })
  })

  it('sendAction sends a direct chat message with wrapped blocks', async () => {
    const result = await sendAction('direct-chat', 'dm-1', 'Hello direct chat')

    expect(mockSendDirectChatMessage).toHaveBeenCalledWith('ws-1', 'dm-1', [
      { type: 'text', value: 'Hello direct chat' },
    ])
    expect(result).toMatchObject({
      id: 'msg-direct-1',
      channel_id: 'ws-1',
      chat_id: 'dm-1',
      chat_type: 'directChat',
      plain_text: 'Hello direct chat',
    })
  })

  it('listAction lists group messages with limit and sort options', async () => {
    const result = await listAction('group', 'grp-1', { limit: '10', sort: 'asc' })

    expect(mockGetGroupMessages).toHaveBeenCalledWith('ws-1', 'grp-1', { limit: 10, sortOrder: 'asc' })
    expect(result.messages).toEqual([
      {
        id: 'msg-group-list-1',
        channel_id: 'ws-1',
        chat_id: 'grp-1',
        chat_type: 'group',
        person_type: 'manager',
        person_id: 'mgr-1',
        created_at: 2000,
        plain_text: 'Group message',
      },
    ])
  })

  it('listAction lists user chat messages', async () => {
    const result = await listAction('user-chat', 'chat-1')

    expect(mockGetUserChatMessages).toHaveBeenCalledWith('ws-1', 'chat-1', { limit: 25, sortOrder: 'desc' })
    expect(result.messages?.[0]).toMatchObject({
      id: 'msg-user-list-1',
      chat_id: 'chat-1',
      plain_text: 'User chat message',
    })
  })

  it('listAction lists direct chat messages', async () => {
    const result = await listAction('direct-chat', 'dm-1')

    expect(mockGetDirectChatMessages).toHaveBeenCalledWith('ws-1', 'dm-1', { limit: 25, sortOrder: 'desc' })
    expect(result.messages?.[0]).toMatchObject({
      id: 'msg-direct-list-1',
      chat_id: 'dm-1',
      plain_text: 'Direct chat message',
    })
  })

  it('getAction returns specific message by ID', async () => {
    const result = await getAction('group', 'grp-1', 'msg-group-list-1')

    expect(result.error).toBeUndefined()
    expect(result.id).toBe('msg-group-list-1')
  })

  it('getAction returns error when message not found', async () => {
    const result = await getAction('group', 'grp-1', 'nonexistent')

    expect(result.error).toBeDefined()
    expect(result.error).toContain('not found')
  })

  it('searchAction searches team chat messages by default', async () => {
    const result = await searchAction('search')

    expect(mockSearchTeamChatMessages).toHaveBeenCalledWith('ws-1', 'search', { limit: undefined })
    expect(result.results).toEqual([
      {
        id: 'msg-search-1',
        channel_id: 'ws-1',
        chat_type: 'group',
        chat_id: 'grp-1',
        person_type: 'manager',
        person_id: 'mgr-1',
        created_at: 3000,
        plain_text: 'search result message',
        highlight: ['<em>search</em> result message'],
      },
    ])
  })

  it('searchAction searches user chat messages with scope option', async () => {
    const result = await searchAction('search', { scope: 'user-chat' })

    expect(mockSearchUserChatMessages).toHaveBeenCalledWith('ws-1', 'search', { limit: undefined })
    expect(result.results).toEqual([
      {
        id: 'msg-search-2',
        channel_id: 'ws-1',
        chat_type: 'userChat',
        chat_id: 'chat-1',
        person_type: 'manager',
        person_id: 'mgr-1',
        created_at: 3001,
        plain_text: 'user chat search result',
        highlight: ['user chat <em>search</em> result'],
      },
    ])
  })

  it('searchAction passes limit parameter', async () => {
    await searchAction('test', { limit: '5' })

    expect(mockSearchTeamChatMessages).toHaveBeenCalledWith('ws-1', 'test', { limit: 5 })
  })

  it('searchAction returns error on failure', async () => {
    mockSearchTeamChatMessages.mockImplementation(() => Promise.reject(new Error('Network error')))

    const result = await searchAction('test')

    expect(result.error).toBe('Network error')
    expect(result.results).toBeUndefined()
  })

  it('searchAction returns error for invalid scope', async () => {
    const result = await searchAction('test', { scope: 'invalid' })

    expect(result.error).toContain('Invalid --scope value')
    expect(result.error).toContain('invalid')
    expect(result.results).toBeUndefined()
  })

  it('searchAction handles zero hits', async () => {
    mockSearchTeamChatMessages.mockImplementation(() =>
      Promise.resolve({ hits: [], bots: [], sessions: [], groups: [] }),
    )

    const result = await searchAction('no-match')

    expect(result.results).toEqual([])
    expect(result.error).toBeUndefined()
  })

  it('searchAction handles missing highlight plainText key', async () => {
    mockSearchTeamChatMessages.mockImplementation(() =>
      Promise.resolve({
        hits: [
          {
            index: 'messages-2026-03',
            score: 'NaN',
            source: {
              id: 'msg-no-highlight',
              channelId: 'ws-1',
              chatType: 'group',
              chatId: 'grp-1',
              personType: 'manager',
              personId: 'mgr-1',
              createdAt: 4000,
              plainText: 'some message',
            },
            highlight: {},
            searchAfter: [4000, 'msg-no-highlight'],
          },
        ],
        bots: [],
        sessions: [],
        groups: [],
      }),
    )

    const result = await searchAction('test')

    expect(result.results?.[0]?.highlight).toBeUndefined()
    expect(result.results?.[0]?.plain_text).toBe('some message')
  })

  it('searchAction uses extractText for block-only messages', async () => {
    mockSearchTeamChatMessages.mockImplementation(() =>
      Promise.resolve({
        hits: [
          {
            index: 'messages-2026-03',
            score: 'NaN',
            source: {
              id: 'msg-blocks-only',
              channelId: 'ws-1',
              chatType: 'group',
              chatId: 'grp-1',
              personType: 'manager',
              personId: 'mgr-1',
              createdAt: 5000,
              blocks: [{ type: 'text', value: 'block content' }],
            },
            highlight: {
              plainText: { name: 'plainText', fragments: ['<em>block</em> content'] },
            },
            searchAfter: [5000, 'msg-blocks-only'],
          },
        ],
        bots: [],
        sessions: [],
        groups: [],
      }),
    )

    const result = await searchAction('block')

    expect(result.results?.[0]?.plain_text).toBe('block content')
  })
})
