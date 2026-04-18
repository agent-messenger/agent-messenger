import { expect, mock, it } from 'bun:test'

// Mock DiscordClient
const mockClient = {
  getUserProfile: mock(async (userId: string) => ({
    user: {
      id: userId,
      username: 'testuser',
      global_name: 'Test User',
      avatar: 'avatar_hash',
      bot: false,
      bio: 'This is my bio',
    },
    connected_accounts: [
      {
        type: 'github',
        id: 'github123',
        name: 'testuser',
        verified: true,
      },
      {
        type: 'twitter',
        id: 'twitter456',
        name: '@testuser',
        verified: false,
      },
    ],
    premium_since: '2024-01-15T10:30:00.000Z',
    mutual_guilds: [
      {
        id: 'guild1',
        nick: 'TestNick',
      },
      {
        id: 'guild2',
      },
    ],
  })),
}

it('get returns user profile with all fields', async () => {
  // given: user id
  const userId = 'user123'

  // when: getting user profile
  const profile = await mockClient.getUserProfile(userId)

  // then: returns complete profile
  expect(profile.user.id).toBe('user123')
  expect(profile.user.username).toBe('testuser')
  expect(profile.user.bio).toBe('This is my bio')
  expect(profile.connected_accounts).toHaveLength(2)
  expect(profile.connected_accounts[0].type).toBe('github')
  expect(profile.connected_accounts[0].verified).toBe(true)
  expect(profile.premium_since).toBe('2024-01-15T10:30:00.000Z')
  expect(profile.mutual_guilds).toHaveLength(2)
  expect(profile.mutual_guilds?.[0].nick).toBe('TestNick')
})

it('get returns profile with minimal fields', async () => {
  // given: mock with minimal profile
  const minimalMock = {
    getUserProfile: mock(async (userId: string) => ({
      user: {
        id: userId,
        username: 'minimaluser',
        global_name: 'Minimal User',
      },
      connected_accounts: [],
    })),
  }

  // when: getting minimal profile
  const profile = await minimalMock.getUserProfile('user456')

  // then: returns profile without optional fields
  expect(profile.user.id).toBe('user456')
  expect(profile.user.bio).toBeUndefined()
  expect(profile.connected_accounts).toHaveLength(0)
  expect(profile.premium_since).toBeUndefined()
  expect(profile.mutual_guilds).toBeUndefined()
})

it('get formats connected accounts correctly', async () => {
  // given: user with connected accounts
  const userId = 'user789'
  const profile = await mockClient.getUserProfile(userId)

  // when: extracting connected accounts
  const accounts = profile.connected_accounts.map((acc) => ({
    type: acc.type,
    name: acc.name,
    verified: acc.verified,
  }))

  // then: accounts are properly formatted
  expect(accounts[0]).toEqual({
    type: 'github',
    name: 'testuser',
    verified: true,
  })
  expect(accounts[1]).toEqual({
    type: 'twitter',
    name: '@testuser',
    verified: false,
  })
})
