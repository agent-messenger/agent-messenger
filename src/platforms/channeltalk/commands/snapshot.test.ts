import { beforeEach, describe, expect, mock, test } from 'bun:test'

const mockGetChannel = mock(() => Promise.resolve({ id: 'ws-1', name: 'Workspace One' }))
const mockListManagers = mock(() =>
  Promise.resolve([
    {
      id: 'mgr-1',
      channelId: 'ws-1',
      accountId: 'acct-1',
      name: 'Alice',
      email: 'alice@example.com',
      roleId: 'role-1',
    },
  ]),
)
const mockListBots = mock(() =>
  Promise.resolve([{ id: 'bot-1', channelId: 'ws-1', name: 'Support Bot', avatarUrl: 'https://example.com/bot.png' }]),
)
const mockListGroups = mock(() =>
  Promise.resolve([
    { id: 'grp-1', channelId: 'ws-1', name: 'Support' },
    { id: 'grp-2', channelId: 'ws-1', name: 'Sales' },
  ]),
)
const mockGetGroupMessages = mock((_: string, groupId: string) =>
  Promise.resolve([
    {
      id: `${groupId}-msg-1`,
      channelId: 'ws-1',
      chatId: groupId,
      chatType: 'group',
      personType: 'manager',
      personId: 'mgr-1',
      createdAt: 1000,
      plainText: `Message for ${groupId}`,
      blocks: [{ type: 'text', content: [{ type: 'plain', attrs: { text: `Message for ${groupId}` } }] }],
    },
  ]),
)
const mockListUserChats = mock((_: string, params?: { state?: string; limit?: number }) => {
  switch (params?.state) {
    case 'opened':
      return Promise.resolve([
        { id: 'chat-1', channelId: 'ws-1', state: 'opened', assigneeId: 'mgr-1', createdAt: 100, updatedAt: 200 },
        { id: 'chat-2', channelId: 'ws-1', state: 'opened', assigneeId: 'mgr-2', createdAt: 110, updatedAt: 210 },
      ])
    case 'snoozed':
      return Promise.resolve([
        { id: 'chat-3', channelId: 'ws-1', state: 'snoozed', assigneeId: 'mgr-1', createdAt: 120, updatedAt: 220 },
      ])
    case 'closed':
      return Promise.resolve([
        { id: 'chat-4', channelId: 'ws-1', state: 'closed', assigneeId: 'mgr-2', createdAt: 130, updatedAt: 230 },
      ])
    default:
      return Promise.resolve([])
  }
})

mock.module('./shared', () => ({
  getClient: async () => ({
    getChannel: mockGetChannel,
    listManagers: mockListManagers,
    listBots: mockListBots,
    listGroups: mockListGroups,
    getGroupMessages: mockGetGroupMessages,
    listUserChats: mockListUserChats,
  }),
  getCurrentWorkspaceId: async () => 'ws-1',
}))

import { snapshotAction } from './snapshot'

describe('snapshot command', () => {
  beforeEach(() => {
    mockGetChannel.mockClear()
    mockListManagers.mockClear()
    mockListBots.mockClear()
    mockListGroups.mockClear()
    mockGetGroupMessages.mockClear()
    mockListUserChats.mockClear()
  })

  test('returns workspace, managers, bots, groups, and user chats', async () => {
    const result = await snapshotAction()

    expect(result.error).toBeUndefined()
    expect(result).toEqual({
      workspace: { id: 'ws-1', name: 'Workspace One' },
      managers: [
        {
          id: 'mgr-1',
          name: 'Alice',
          email: 'alice@example.com',
          account_id: 'acct-1',
          role_id: 'role-1',
        },
      ],
      bots: [
        {
          id: 'bot-1',
          name: 'Support Bot',
          avatar_url: 'https://example.com/bot.png',
        },
      ],
      groups: [
        {
          id: 'grp-1',
          name: 'Support',
          recent_messages: [
            {
              id: 'grp-1-msg-1',
              person_type: 'manager',
              plain_text: 'Message for grp-1',
              created_at: 1000,
            },
          ],
        },
        {
          id: 'grp-2',
          name: 'Sales',
          recent_messages: [
            {
              id: 'grp-2-msg-1',
              person_type: 'manager',
              plain_text: 'Message for grp-2',
              created_at: 1000,
            },
          ],
        },
      ],
      user_chats: {
        total: 4,
        by_state: {
          opened: 2,
          snoozed: 1,
          closed: 1,
        },
        recent: [
          {
            id: 'chat-1',
            state: 'opened',
            assignee_id: 'mgr-1',
            created_at: 100,
            updated_at: 200,
          },
          {
            id: 'chat-2',
            state: 'opened',
            assignee_id: 'mgr-2',
            created_at: 110,
            updated_at: 210,
          },
        ],
      },
    })
  })

  test('groups-only skips user chats', async () => {
    const result = await snapshotAction({ groupsOnly: true })

    expect(result.workspace).toEqual({ id: 'ws-1', name: 'Workspace One' })
    expect(result.groups).toHaveLength(2)
    expect(result.user_chats).toBeUndefined()
    expect(result.managers).toBeUndefined()
    expect(result.bots).toBeUndefined()
    expect(mockListUserChats).not.toHaveBeenCalled()
  })

  test('chats-only skips groups', async () => {
    const result = await snapshotAction({ chatsOnly: true, limit: 1 })

    expect(result.workspace).toEqual({ id: 'ws-1', name: 'Workspace One' })
    expect(result.groups).toBeUndefined()
    expect(result.user_chats).toEqual({
      total: 4,
      by_state: {
        opened: 2,
        snoozed: 1,
        closed: 1,
      },
      recent: [
        {
          id: 'chat-1',
          state: 'opened',
          assignee_id: 'mgr-1',
          created_at: 100,
          updated_at: 200,
        },
      ],
    })
    expect(mockListGroups).not.toHaveBeenCalled()
    expect(mockGetGroupMessages).not.toHaveBeenCalled()
  })

  test('includes recent messages for each group with requested limit', async () => {
    const result = await snapshotAction({ groupsOnly: true, limit: 3 })

    expect(mockGetGroupMessages).toHaveBeenCalledWith('ws-1', 'grp-1', { limit: 3, sortOrder: 'desc' })
    expect(mockGetGroupMessages).toHaveBeenCalledWith('ws-1', 'grp-2', { limit: 3, sortOrder: 'desc' })
    expect(result.groups?.[0].recent_messages[0]).toEqual({
      id: 'grp-1-msg-1',
      person_type: 'manager',
      plain_text: 'Message for grp-1',
      created_at: 1000,
    })
  })
})
