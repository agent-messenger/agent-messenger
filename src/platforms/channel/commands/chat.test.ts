import { beforeEach, describe, expect, mock, test } from 'bun:test'

const mockListUserChats = mock(() =>
  Promise.resolve([
    {
      id: 'chat-1',
      channelId: 'ws-1',
      state: 'opened',
      assigneeId: 'mgr-1',
      createdAt: 1000,
      updatedAt: 2000,
    },
  ]),
)

const mockGetUserChat = mock(() =>
  Promise.resolve({
    id: 'chat-1',
    channelId: 'ws-1',
    state: 'opened',
    assigneeId: 'mgr-1',
    createdAt: 1000,
    updatedAt: 2000,
  }),
)

mock.module('./shared', () => ({
  getClient: async () => ({
    listUserChats: mockListUserChats,
    getUserChat: mockGetUserChat,
  }),
  getCurrentWorkspaceId: async () => 'ws-1',
}))

import { getAction, listAction } from './chat'

describe('chat commands', () => {
  beforeEach(() => {
    mockListUserChats.mockReset()
    mockListUserChats.mockImplementation(() =>
      Promise.resolve([
        {
          id: 'chat-1',
          channelId: 'ws-1',
          state: 'opened',
          assigneeId: 'mgr-1',
          createdAt: 1000,
          updatedAt: 2000,
        },
      ]),
    )
    mockGetUserChat.mockReset()
    mockGetUserChat.mockImplementation(() =>
      Promise.resolve({
        id: 'chat-1',
        channelId: 'ws-1',
        state: 'opened',
        assigneeId: 'mgr-1',
        createdAt: 1000,
        updatedAt: 2000,
      }),
    )
  })

  test('listAction lists user chats with the requested state filter', async () => {
    const result = await listAction({ state: 'closed', limit: '5' })

    expect(mockListUserChats).toHaveBeenCalledWith('ws-1', { state: 'closed', limit: 5 })
    expect(result.chats).toEqual([
      {
        id: 'chat-1',
        channel_id: 'ws-1',
        state: 'opened',
        assignee_id: 'mgr-1',
        created_at: 1000,
        updated_at: 2000,
      },
    ])
  })

  test('getAction gets a specific user chat', async () => {
    const result = await getAction('chat-1')

    expect(mockGetUserChat).toHaveBeenCalledWith('ws-1', 'chat-1')
    expect(result).toEqual({
      id: 'chat-1',
      channel_id: 'ws-1',
      state: 'opened',
      assignee_id: 'mgr-1',
      created_at: 1000,
      updated_at: 2000,
    })
  })
})
