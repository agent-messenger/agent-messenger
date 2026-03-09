import { afterEach, beforeEach, expect, spyOn, test } from 'bun:test'

import { DiscordClient } from '../client'
import { DiscordCredentialManager } from '../credential-manager'

let clientSearchMembersSpy: ReturnType<typeof spyOn>
let credManagerLoadSpy: ReturnType<typeof spyOn>

beforeEach(() => {
  clientSearchMembersSpy = spyOn(DiscordClient.prototype, 'searchMembers').mockResolvedValue([
    {
      user: {
        id: 'user-1',
        username: 'alice',
        global_name: 'Alice Smith',
        avatar: 'avatar-hash-1',
        bot: false,
      },
      nick: 'AliceNick',
      roles: ['role-1', 'role-2'],
      joined_at: '2024-01-15T10:00:00Z',
      deaf: false,
      mute: false,
      flags: 0,
    },
    {
      user: {
        id: 'user-2',
        username: 'alice_bot',
        global_name: 'Alice Bot',
        avatar: 'avatar-hash-2',
        bot: true,
      },
      nick: undefined,
      roles: ['role-3'],
      joined_at: '2024-02-20T15:30:00Z',
      deaf: false,
      mute: false,
      flags: 0,
    },
  ])

  credManagerLoadSpy = spyOn(DiscordCredentialManager.prototype, 'load').mockResolvedValue({
    token: 'test-token',
    current_server: 'guild-1',
    servers: {
      'guild-1': { server_id: 'guild-1', server_name: 'Test Guild' },
    },
  })
})

afterEach(() => {
  clientSearchMembersSpy?.mockRestore()
  credManagerLoadSpy?.mockRestore()
})

test('search: returns members matching query', async () => {
  const client = new DiscordClient('test-token')
  const members = await client.searchMembers('guild-1', 'alice', 10)

  expect(members).toBeDefined()
  expect(members).toHaveLength(2)
  expect(members[0].user.username).toBe('alice')
  expect(members[1].user.username).toBe('alice_bot')
})

test('search: includes member metadata', async () => {
  const client = new DiscordClient('test-token')
  const members = await client.searchMembers('guild-1', 'alice', 10)

  const member = members[0]

  expect(member.user).toBeDefined()
  expect(member.user.id).toBe('user-1')
  expect(member.user.username).toBe('alice')
  expect(member.user.global_name).toBe('Alice Smith')
  expect(member.nick).toBe('AliceNick')
  expect(member.roles).toEqual(['role-1', 'role-2'])
  expect(member.joined_at).toBe('2024-01-15T10:00:00Z')
  expect(member.deaf).toBe(false)
  expect(member.mute).toBe(false)
  expect(member.flags).toBe(0)
})

test('search: respects limit parameter', async () => {
  const client = new DiscordClient('test-token')

  await client.searchMembers('guild-1', 'alice', 5)

  expect(clientSearchMembersSpy).toHaveBeenCalledWith('guild-1', 'alice', 5)
})

test('search: uses default limit of 10', async () => {
  const client = new DiscordClient('test-token')

  const members = await client.searchMembers('guild-1', 'alice')

  expect(members).toHaveLength(2)
})
