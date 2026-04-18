import { beforeEach, describe, expect, mock, it } from 'bun:test'

const mockListGroups = mock(() =>
  Promise.resolve([
    {
      id: 'grp-1',
      channelId: 'ws-1',
      name: 'Support',
      title: 'Support Team',
      scope: 'public',
      active: true,
      createdAt: 1000,
      updatedAt: 2000,
    },
  ]),
)

const mockGetGroup = mock(() =>
  Promise.resolve({
    id: 'grp-1',
    channelId: 'ws-1',
    name: 'Support',
    title: 'Support Team',
    scope: 'public',
    active: true,
    createdAt: 1000,
    updatedAt: 2000,
  }),
)

const mockGetGroupMessages = mock(() =>
  Promise.resolve([
    {
      id: 'msg-1',
      channelId: 'ws-1',
      chatId: 'grp-1',
      chatType: 'group',
      personType: 'manager',
      personId: 'mgr-1',
      createdAt: 3000,
      plainText: 'Hello group',
      blocks: [{ type: 'text', content: [{ type: 'plain', attrs: { text: 'Hello group' } }] }],
    },
  ]),
)

mock.module('./shared', () => ({
  getClient: async () => ({
    listGroups: mockListGroups,
    getGroup: mockGetGroup,
    getGroupMessages: mockGetGroupMessages,
  }),
  getCurrentWorkspaceId: async () => 'ws-1',
}))

import { getAction, listAction, messagesAction } from './group'

describe('group commands', () => {
  beforeEach(() => {
    mockListGroups.mockReset()
    mockListGroups.mockImplementation(() =>
      Promise.resolve([
        {
          id: 'grp-1',
          channelId: 'ws-1',
          name: 'Support',
          title: 'Support Team',
          scope: 'public',
          active: true,
          createdAt: 1000,
          updatedAt: 2000,
        },
      ]),
    )
    mockGetGroup.mockReset()
    mockGetGroup.mockImplementation(() =>
      Promise.resolve({
        id: 'grp-1',
        channelId: 'ws-1',
        name: 'Support',
        title: 'Support Team',
        scope: 'public',
        active: true,
        createdAt: 1000,
        updatedAt: 2000,
      }),
    )
    mockGetGroupMessages.mockReset()
    mockGetGroupMessages.mockImplementation(() =>
      Promise.resolve([
        {
          id: 'msg-1',
          channelId: 'ws-1',
          chatId: 'grp-1',
          chatType: 'group',
          personType: 'manager',
          personId: 'mgr-1',
          createdAt: 3000,
          plainText: 'Hello group',
          blocks: [{ type: 'text', content: [{ type: 'plain', attrs: { text: 'Hello group' } }] }],
        },
      ]),
    )
  })

  it('listAction lists groups', async () => {
    const result = await listAction({ limit: '3' })

    expect(mockListGroups).toHaveBeenCalledWith('ws-1', { limit: 3 })
    expect(result.groups).toEqual([
      {
        id: 'grp-1',
        channel_id: 'ws-1',
        name: 'Support',
        title: 'Support Team',
        scope: 'public',
        active: true,
        created_at: 1000,
        updated_at: 2000,
      },
    ])
  })

  it('getAction gets a specific group', async () => {
    const result = await getAction('grp-1')

    expect(mockGetGroup).toHaveBeenCalledWith('ws-1', 'grp-1')
    expect(result).toEqual({
      id: 'grp-1',
      channel_id: 'ws-1',
      name: 'Support',
      title: 'Support Team',
      scope: 'public',
      active: true,
      created_at: 1000,
      updated_at: 2000,
    })
  })

  it('messagesAction gets group messages with limit and sort', async () => {
    const result = await messagesAction('grp-1', { limit: '7', sort: 'asc' })

    expect(mockGetGroupMessages).toHaveBeenCalledWith('ws-1', 'grp-1', { limit: 7, sortOrder: 'asc' })
    expect(result.messages).toEqual([
      {
        id: 'msg-1',
        channel_id: 'ws-1',
        chat_id: 'grp-1',
        chat_type: 'group',
        person_type: 'manager',
        person_id: 'mgr-1',
        created_at: 3000,
        plain_text: 'Hello group',
      },
    ])
  })
})
