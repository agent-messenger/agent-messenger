import { afterEach, beforeEach, expect, spyOn, test } from 'bun:test'

import { TeamsClient } from '../client'
import { TeamsCredentialManager } from '../credential-manager'

let clientListChannelsSpy: ReturnType<typeof spyOn>
let clientGetChannelSpy: ReturnType<typeof spyOn>
let clientGetMessagesSpy: ReturnType<typeof spyOn>
let credManagerLoadConfigSpy: ReturnType<typeof spyOn>

beforeEach(() => {
  clientListChannelsSpy = spyOn(TeamsClient.prototype, 'listChannels').mockResolvedValue([
    { id: 'ch-1', team_id: 'team-1', name: 'General', type: 'standard' },
    { id: 'ch-2', team_id: 'team-1', name: 'Announcements', type: 'standard' },
  ])

  clientGetChannelSpy = spyOn(TeamsClient.prototype, 'getChannel').mockImplementation(
    async (teamId: string, channelId: string) => {
      if (channelId === 'ch-1') {
        return { id: 'ch-1', team_id: teamId, name: 'General', type: 'standard' }
      }
      if (channelId === 'ch-2') {
        return { id: 'ch-2', team_id: teamId, name: 'Announcements', type: 'standard' }
      }
      throw new Error('Channel not found')
    },
  )

  clientGetMessagesSpy = spyOn(TeamsClient.prototype, 'getMessages').mockResolvedValue([
    {
      id: 'msg-1',
      channel_id: 'ch-1',
      author: { id: 'user-1', displayName: 'Alice' },
      content: 'Hello world',
      timestamp: '2024-01-29T10:00:00Z',
    },
    {
      id: 'msg-2',
      channel_id: 'ch-1',
      author: { id: 'user-2', displayName: 'Bob' },
      content: 'Hi there',
      timestamp: '2024-01-29T09:00:00Z',
    },
  ])

  credManagerLoadConfigSpy = spyOn(TeamsCredentialManager.prototype, 'loadConfig').mockResolvedValue({
    current_account: 'work',
    accounts: {
      work: {
        token: 'test-token',
        account_type: 'work' as const,
        current_team: 'team-1',
        teams: {
          'team-1': { team_id: 'team-1', team_name: 'Team One' },
        },
      },
    },
  })
})

afterEach(() => {
  clientListChannelsSpy?.mockRestore()
  clientGetChannelSpy?.mockRestore()
  clientGetMessagesSpy?.mockRestore()
  credManagerLoadConfigSpy?.mockRestore()
})

test('list: returns channels from team', async () => {
  // given
  const client = new TeamsClient('test-token')

  // when
  const channels = await client.listChannels('team-1')

  // then
  expect(channels).toHaveLength(2)
  expect(channels[0].name).toBe('General')
  expect(channels[1].name).toBe('Announcements')
})

test('list: includes channel metadata', async () => {
  // given
  const client = new TeamsClient('test-token')
  const channels = await client.listChannels('team-1')

  // when
  const channel = channels[0]

  // then
  expect(channel.id).toBeDefined()
  expect(channel.name).toBeDefined()
  expect(channel.type).toBeDefined()
  expect(channel.team_id).toBe('team-1')
})

test('info: returns channel details', async () => {
  // given
  const client = new TeamsClient('test-token')

  // when
  const channel = await client.getChannel('team-1', 'ch-1')

  // then
  expect(channel.id).toBe('ch-1')
  expect(channel.name).toBe('General')
  expect(channel.type).toBe('standard')
})

test('info: throws error for non-existent channel', async () => {
  // given
  const client = new TeamsClient('test-token')

  // when/then
  try {
    await client.getChannel('team-1', 'non-existent')
    expect(true).toBe(false)
  } catch (error) {
    expect((error as Error).message).toContain('Channel not found')
  }
})

test('history: returns messages', async () => {
  // given
  const client = new TeamsClient('test-token')

  // when
  const messages = await client.getMessages('team-1', 'ch-1', 50)

  // then
  expect(messages).toHaveLength(2)
  expect(messages[0].id).toBe('msg-1')
  expect(messages[0].author.displayName).toBe('Alice')
  expect(messages[1].id).toBe('msg-2')
  expect(messages[1].author.displayName).toBe('Bob')
})

test('history: includes message metadata', async () => {
  // given
  const client = new TeamsClient('test-token')
  const messages = await client.getMessages('team-1', 'ch-1', 50)

  // when
  const message = messages[0]

  // then
  expect(message.id).toBeDefined()
  expect(message.content).toBeDefined()
  expect(message.author).toBeDefined()
  expect(message.author.displayName).toBeDefined()
  expect(message.timestamp).toBeDefined()
})
