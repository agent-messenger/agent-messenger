import { afterEach, beforeEach, expect, spyOn, it } from 'bun:test'

import { DiscordClient } from '../client'
import { DiscordCredentialManager } from '../credential-manager'
import { meAction } from './member'

let clientGetMyGuildMemberSpy: ReturnType<typeof spyOn>
let clientListRolesSpy: ReturnType<typeof spyOn>
let clientSearchMembersSpy: ReturnType<typeof spyOn>
let consoleLogSpy: ReturnType<typeof spyOn>
let credManagerLoadSpy: ReturnType<typeof spyOn>

beforeEach(() => {
  clientGetMyGuildMemberSpy = spyOn(DiscordClient.prototype, 'getMyGuildMember').mockResolvedValue({
    user: {
      id: 'user-1',
      username: 'alice',
      global_name: 'Alice Smith',
      avatar: 'avatar-hash-1',
      bot: false,
    },
    nick: 'AliceNick',
    roles: ['role-low', 'role-missing', 'role-high'],
    joined_at: '2024-01-15T10:00:00Z',
    deaf: false,
    mute: false,
    flags: 0,
  })
  clientListRolesSpy = spyOn(DiscordClient.prototype, 'listRoles').mockResolvedValue([
    {
      id: 'role-low',
      name: 'Member',
      color: 0,
      hoist: false,
      position: 1,
      permissions: '1024',
      managed: false,
      mentionable: false,
    },
    {
      id: 'role-high',
      name: 'Admin',
      color: 16711680,
      hoist: true,
      position: 10,
      permissions: '8',
      managed: false,
      mentionable: true,
    },
  ])
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
  consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  clientGetMyGuildMemberSpy?.mockRestore()
  clientListRolesSpy?.mockRestore()
  clientSearchMembersSpy?.mockRestore()
  consoleLogSpy?.mockRestore()
  credManagerLoadSpy?.mockRestore()
})

it('search: returns members matching query', async () => {
  const client = await new DiscordClient().login({ token: 'test-token' })
  const members = await client.searchMembers('guild-1', 'alice', 10)

  expect(members).toBeDefined()
  expect(members).toHaveLength(2)
  expect(members[0].user.username).toBe('alice')
  expect(members[1].user.username).toBe('alice_bot')
})

it('search: includes member metadata', async () => {
  const client = await new DiscordClient().login({ token: 'test-token' })
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

it('search: respects limit parameter', async () => {
  const client = await new DiscordClient().login({ token: 'test-token' })

  await client.searchMembers('guild-1', 'alice', 5)

  expect(clientSearchMembersSpy).toHaveBeenCalledWith('guild-1', 'alice', 5)
})

it('search: uses default limit of 10', async () => {
  const client = await new DiscordClient().login({ token: 'test-token' })

  const members = await client.searchMembers('guild-1', 'alice')

  expect(members).toHaveLength(2)
})

it("me: returns the current user's member object", async () => {
  await meAction(undefined, {})

  const output = JSON.parse(consoleLogSpy.mock.calls.at(-1)?.[0] as string)
  expect(output).toMatchObject({
    user: {
      id: 'user-1',
      username: 'alice',
      global_name: 'Alice Smith',
      avatar: 'avatar-hash-1',
      bot: false,
    },
    nick: 'AliceNick',
    joined_at: '2024-01-15T10:00:00Z',
    deaf: false,
    mute: false,
    flags: 0,
  })
  expect(clientGetMyGuildMemberSpy).toHaveBeenCalledWith('guild-1')
  expect(clientListRolesSpy).toHaveBeenCalledWith('guild-1')
})

it('me: returns roles resolved to names (not raw IDs)', async () => {
  await meAction('guild-2', {})

  const output = JSON.parse(consoleLogSpy.mock.calls.at(-1)?.[0] as string)
  expect(output.roles.map((role: { name: string }) => role.name)).toEqual(['Admin', 'Member'])
  expect(output.roles).not.toContain('role-high')
  expect(clientGetMyGuildMemberSpy).toHaveBeenCalledWith('guild-2')
})

it('me: roles are sorted by position descending', async () => {
  await meAction(undefined, {})

  const output = JSON.parse(consoleLogSpy.mock.calls.at(-1)?.[0] as string)
  expect(output.roles.map((role: { position: number }) => role.position)).toEqual([10, 1])
})

it('me: role IDs with no matching role definition are dropped', async () => {
  await meAction(undefined, {})

  const output = JSON.parse(consoleLogSpy.mock.calls.at(-1)?.[0] as string)
  expect(output.roles).toHaveLength(2)
  expect(output.roles.map((role: { id: string }) => role.id)).not.toContain('role-missing')
})

it('me: breaks equal-position ties by snowflake, ranking the smaller ID higher', async () => {
  // given two roles sharing a position whose IDs collide once coerced to Number
  clientGetMyGuildMemberSpy.mockResolvedValue({
    user: { id: 'user-1', username: 'alice', global_name: 'Alice Smith', avatar: 'avatar-hash-1', bot: false },
    nick: null,
    roles: ['1234567890123456789', '1234567890123456788'],
    joined_at: '2024-01-15T10:00:00Z',
    deaf: false,
    mute: false,
    flags: 0,
  })
  clientListRolesSpy.mockResolvedValue([
    {
      id: '1234567890123456789',
      name: 'Newer',
      color: 0,
      position: 5,
      hoist: false,
      managed: false,
      mentionable: false,
      permissions: '0',
    },
    {
      id: '1234567890123456788',
      name: 'Older',
      color: 0,
      position: 5,
      hoist: false,
      managed: false,
      mentionable: false,
      permissions: '0',
    },
  ])

  await meAction(undefined, {})

  const output = JSON.parse(consoleLogSpy.mock.calls.at(-1)?.[0] as string)
  expect(output.roles.map((role: { name: string }) => role.name)).toEqual(['Older', 'Newer'])
})

it('me: ranks by position before falling back to the snowflake', async () => {
  clientGetMyGuildMemberSpy.mockResolvedValue({
    user: { id: 'user-1', username: 'alice', global_name: 'Alice Smith', avatar: 'avatar-hash-1', bot: false },
    nick: null,
    roles: ['100', '200'],
    joined_at: '2024-01-15T10:00:00Z',
    deaf: false,
    mute: false,
    flags: 0,
  })
  clientListRolesSpy.mockResolvedValue([
    {
      id: '100',
      name: 'Low',
      color: 0,
      position: 1,
      hoist: false,
      managed: false,
      mentionable: false,
      permissions: '0',
    },
    {
      id: '200',
      name: 'High',
      color: 0,
      position: 9,
      hoist: false,
      managed: false,
      mentionable: false,
      permissions: '0',
    },
  ])

  await meAction(undefined, {})

  const output = JSON.parse(consoleLogSpy.mock.calls.at(-1)?.[0] as string)
  expect(output.roles.map((role: { name: string }) => role.name)).toEqual(['High', 'Low'])
})

it('me: preserves the raw role IDs even when a definition is unresolvable', async () => {
  await meAction(undefined, {})

  const output = JSON.parse(consoleLogSpy.mock.calls.at(-1)?.[0] as string)
  expect(output.role_ids).toEqual(['role-low', 'role-missing', 'role-high'])
})
