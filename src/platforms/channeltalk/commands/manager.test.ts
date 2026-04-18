import { beforeEach, describe, expect, mock, it } from 'bun:test'

const mockListManagers = mock(() =>
  Promise.resolve([
    {
      id: 'mgr-1',
      channelId: 'ws-1',
      accountId: 'acc-1',
      name: 'Alex',
      email: 'alex@example.com',
      roleId: 'role-1',
      removed: false,
      createdAt: 1000,
    },
  ]),
)

mock.module('./shared', () => ({
  getClient: async () => ({
    listManagers: mockListManagers,
  }),
  getCurrentWorkspaceId: async () => 'ws-1',
}))

import { listAction } from './manager'

describe('manager commands', () => {
  beforeEach(() => {
    mockListManagers.mockReset()
    mockListManagers.mockImplementation(() =>
      Promise.resolve([
        {
          id: 'mgr-1',
          channelId: 'ws-1',
          accountId: 'acc-1',
          name: 'Alex',
          email: 'alex@example.com',
          roleId: 'role-1',
          removed: false,
          createdAt: 1000,
        },
      ]),
    )
  })

  it('listAction lists managers', async () => {
    const result = await listAction({ limit: '12' })

    expect(mockListManagers).toHaveBeenCalledWith('ws-1', { limit: 12 })
    expect(result.managers).toEqual([
      {
        id: 'mgr-1',
        channel_id: 'ws-1',
        account_id: 'acc-1',
        name: 'Alex',
        email: 'alex@example.com',
        role_id: 'role-1',
        removed: false,
        created_at: 1000,
      },
    ])
  })
})
