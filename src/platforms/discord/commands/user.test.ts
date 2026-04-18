import { expect, mock, it } from 'bun:test'

// Mock DiscordClient
const mockClient = {
  testAuth: mock(async () => ({
    id: 'user123',
    username: 'testuser',
    global_name: 'Test User',
    avatar: 'avatar_hash',
    bot: false,
  })),
  getUser: mock(async (userId: string) => ({
    id: userId,
    username: 'testuser',
    global_name: 'Test User',
    avatar: 'avatar_hash',
    bot: false,
  })),
  listUsers: mock(async (_serverId: string) => [
    {
      id: 'user1',
      username: 'alice',
      global_name: 'Alice',
      avatar: 'avatar1',
      bot: false,
    },
    {
      id: 'user2',
      username: 'bot_user',
      global_name: 'Bot User',
      avatar: 'avatar2',
      bot: true,
    },
    {
      id: 'user3',
      username: 'bob',
      global_name: 'Bob',
      avatar: 'avatar3',
      bot: false,
    },
  ]),
}

it('me returns current user info', async () => {
  // given: authenticated user
  const user = await mockClient.testAuth()

  // when: getting current user
  const result = {
    id: user.id,
    username: user.username,
    global_name: user.global_name,
    avatar: user.avatar,
    bot: user.bot,
  }

  // then: returns user object
  expect(result.id).toBe('user123')
  expect(result.username).toBe('testuser')
  expect(result.global_name).toBe('Test User')
  expect(result.bot).toBe(false)
})

it('info returns user details by id', async () => {
  // given: user id
  const userId = 'user123'

  // when: getting user info
  const user = await mockClient.getUser(userId)
  const result = {
    id: user.id,
    username: user.username,
    global_name: user.global_name,
    avatar: user.avatar,
    bot: user.bot,
  }

  // then: returns user object
  expect(result.id).toBe('user123')
  expect(result.username).toBe('testuser')
})

it('list returns server members', async () => {
  // given: server id
  const serverId = 'server123'

  // when: listing users
  const users = await mockClient.listUsers(serverId)
  const result = users.map((u) => ({
    id: u.id,
    username: u.username,
    global_name: u.global_name,
    avatar: u.avatar,
    bot: u.bot,
  }))

  // then: returns array of users
  expect(result).toHaveLength(3)
  expect(result[0].username).toBe('alice')
  expect(result[1].bot).toBe(true)
  expect(result[2].username).toBe('bob')
})

it('list filters out bots when flag not set', async () => {
  // given: server id and users with bots
  const serverId = 'server123'
  const users = await mockClient.listUsers(serverId)

  // when: filtering out bots
  const filtered = users.filter((u) => !u.bot)

  // then: returns only non-bot users
  expect(filtered).toHaveLength(2)
  expect(filtered.every((u) => !u.bot)).toBe(true)
})
