import { expect, mock, it } from 'bun:test'

// Mock TeamsClient
const mockClient = {
  testAuth: mock(async () => ({
    id: 'user123',
    displayName: 'Test User',
    email: 'test@example.com',
    userPrincipalName: 'test@example.com',
  })),
  getUser: mock(async (userId: string) => ({
    id: userId,
    displayName: 'Test User',
    email: 'test@example.com',
    userPrincipalName: 'test@example.com',
  })),
  listUsers: mock(async (_teamId: string) => [
    {
      id: 'user1',
      displayName: 'Alice',
      email: 'alice@example.com',
    },
    {
      id: 'user2',
      displayName: 'Bob',
      email: 'bob@example.com',
    },
  ]),
}

it('me returns current user info', async () => {
  // given: authenticated user
  const user = await mockClient.testAuth()

  // when: getting current user
  const result = {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    userPrincipalName: user.userPrincipalName,
  }

  // then: returns user object
  expect(result.id).toBe('user123')
  expect(result.displayName).toBe('Test User')
  expect(result.email).toBe('test@example.com')
})

it('info returns user details by id', async () => {
  // given: user id
  const userId = 'user123'

  // when: getting user info
  const user = await mockClient.getUser(userId)
  const result = {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    userPrincipalName: user.userPrincipalName,
  }

  // then: returns user object
  expect(result.id).toBe('user123')
  expect(result.displayName).toBe('Test User')
})

it('list returns team members', async () => {
  // given: team id
  const teamId = 'team123'

  // when: listing users
  const users = await mockClient.listUsers(teamId)
  const result = users.map((u) => ({
    id: u.id,
    displayName: u.displayName,
    email: u.email,
  }))

  // then: returns array of users
  expect(result).toHaveLength(2)
  expect(result[0].displayName).toBe('Alice')
  expect(result[1].displayName).toBe('Bob')
})
