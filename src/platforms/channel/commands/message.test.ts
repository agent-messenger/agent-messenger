import { beforeEach, describe, expect, mock, test } from 'bun:test'

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

mock.module('./shared', () => ({
  getClient: async () => ({
    sendGroupMessage: mockSendGroupMessage,
    sendUserChatMessage: mockSendUserChatMessage,
    sendDirectChatMessage: mockSendDirectChatMessage,
    getGroupMessages: mockGetGroupMessages,
    getUserChatMessages: mockGetUserChatMessages,
    getDirectChatMessages: mockGetDirectChatMessages,
  }),
  getCurrentWorkspaceId: async () => 'ws-1',
}))

import { listAction, sendAction } from './message'

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
  })

  test('sendAction sends a group message with wrapped blocks', async () => {
    const result = await sendAction('group', 'grp-1', 'Hello group')

    expect(mockSendGroupMessage).toHaveBeenCalledWith('ws-1', 'grp-1', [
      { type: 'text', content: [{ type: 'plain', attrs: { text: 'Hello group' } }] },
    ])
    expect(result).toMatchObject({
      id: 'msg-group-1',
      channel_id: 'ws-1',
      chat_id: 'grp-1',
      chat_type: 'group',
      plain_text: 'Hello group',
    })
  })

  test('sendAction sends a user chat message with wrapped blocks', async () => {
    const result = await sendAction('user-chat', 'chat-1', 'Hello user chat')

    expect(mockSendUserChatMessage).toHaveBeenCalledWith('ws-1', 'chat-1', [
      { type: 'text', content: [{ type: 'plain', attrs: { text: 'Hello user chat' } }] },
    ])
    expect(result).toMatchObject({
      id: 'msg-user-1',
      channel_id: 'ws-1',
      chat_id: 'chat-1',
      chat_type: 'userChat',
      plain_text: 'Hello user chat',
    })
  })

  test('sendAction sends a direct chat message with wrapped blocks', async () => {
    const result = await sendAction('direct-chat', 'dm-1', 'Hello direct chat')

    expect(mockSendDirectChatMessage).toHaveBeenCalledWith('ws-1', 'dm-1', [
      { type: 'text', content: [{ type: 'plain', attrs: { text: 'Hello direct chat' } }] },
    ])
    expect(result).toMatchObject({
      id: 'msg-direct-1',
      channel_id: 'ws-1',
      chat_id: 'dm-1',
      chat_type: 'directChat',
      plain_text: 'Hello direct chat',
    })
  })

  test('listAction lists group messages with limit and sort options', async () => {
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
        plain_text: 'Group message\nGroup message',
      },
    ])
  })

  test('listAction lists user chat messages', async () => {
    const result = await listAction('user-chat', 'chat-1')

    expect(mockGetUserChatMessages).toHaveBeenCalledWith('ws-1', 'chat-1', { limit: 25, sortOrder: 'desc' })
    expect(result.messages?.[0]).toMatchObject({
      id: 'msg-user-list-1',
      chat_id: 'chat-1',
      plain_text: 'User chat message\nUser chat message',
    })
  })

  test('listAction lists direct chat messages', async () => {
    const result = await listAction('direct-chat', 'dm-1')

    expect(mockGetDirectChatMessages).toHaveBeenCalledWith('ws-1', 'dm-1', { limit: 25, sortOrder: 'desc' })
    expect(result.messages?.[0]).toMatchObject({
      id: 'msg-direct-list-1',
      chat_id: 'dm-1',
      plain_text: 'Direct chat message\nDirect chat message',
    })
  })
})
