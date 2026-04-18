import { beforeEach, describe, expect, mock, it } from 'bun:test'

const mockListBots = mock(() =>
  Promise.resolve([
    {
      id: 'bot-1',
      channelId: 'ws-1',
      name: 'Support Bot',
      avatarUrl: 'https://example.com/bot.png',
    },
  ]),
)

mock.module('./shared', () => ({
  getClient: async () => ({
    listBots: mockListBots,
  }),
  getCurrentWorkspaceId: async () => 'ws-1',
}))

import { listAction } from './bot'

describe('bot commands', () => {
  beforeEach(() => {
    mockListBots.mockReset()
    mockListBots.mockImplementation(() =>
      Promise.resolve([
        {
          id: 'bot-1',
          channelId: 'ws-1',
          name: 'Support Bot',
          avatarUrl: 'https://example.com/bot.png',
        },
      ]),
    )
  })

  it('listAction lists bots', async () => {
    const result = await listAction({ limit: '8' })

    expect(mockListBots).toHaveBeenCalledWith('ws-1', { limit: 8 })
    expect(result.bots).toEqual([
      {
        id: 'bot-1',
        channel_id: 'ws-1',
        name: 'Support Bot',
        avatar_url: 'https://example.com/bot.png',
      },
    ])
  })
})
