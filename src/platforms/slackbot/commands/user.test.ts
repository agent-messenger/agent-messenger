import { beforeEach, describe, expect, mock, it } from 'bun:test'

const mockListUsers = mock(() =>
  Promise.resolve([
    {
      id: 'U123',
      name: 'alice',
      real_name: 'Alice Smith',
      is_admin: false,
      is_owner: false,
      is_bot: false,
      is_app_user: false,
      profile: { email: 'alice@example.com', title: 'Engineer' },
    },
    {
      id: 'U456',
      name: 'bob',
      real_name: 'Bob Jones',
      is_admin: true,
      is_owner: false,
      is_bot: false,
      is_app_user: false,
      profile: { email: 'bob@example.com', title: 'Manager' },
    },
  ]),
)
const mockGetUserInfo = mock(() =>
  Promise.resolve({
    id: 'U123',
    name: 'alice',
    real_name: 'Alice Smith',
    is_admin: false,
    is_owner: false,
    is_bot: false,
    is_app_user: false,
    profile: {
      email: 'alice@example.com',
      phone: '+1-555-0100',
      title: 'Engineer',
      status_text: 'Working from home',
    },
  }),
)

mock.module('../client', () => ({
  SlackBotClient: class MockSlackBotClient {
    async login(_credentials?: { token: string }) {
      return this
    }
    listUsers = mockListUsers
    getUserInfo = mockGetUserInfo
  },
}))

import { SlackBotClient } from '../client'

describe('user commands', () => {
  beforeEach(() => {
    mockListUsers.mockClear()
    mockGetUserInfo.mockClear()
  })

  describe('listUsers', () => {
    it('returns list of users', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const users = await client.listUsers()

      // then
      expect(users).toHaveLength(2)
      expect(users[0].name).toBe('alice')
      expect(users[1].name).toBe('bob')
    })

    it('includes user metadata', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const users = await client.listUsers()
      const user = users[0]

      // then
      expect(user.id).toBeDefined()
      expect(user.name).toBeDefined()
      expect(user.real_name).toBeDefined()
      expect(user.is_bot).toBe(false)
      expect(user.is_admin).toBe(false)
    })

    it('passes limit option', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      await client.listUsers({ limit: 50 })

      // then
      expect(mockListUsers).toHaveBeenCalledWith({ limit: 50 })
    })
  })

  describe('getUserInfo', () => {
    it('returns user details by ID', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const user = await client.getUserInfo('U123')

      // then
      expect(user.id).toBe('U123')
      expect(user.name).toBe('alice')
      expect(user.real_name).toBe('Alice Smith')
    })

    it('includes profile information', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      const user = await client.getUserInfo('U123')

      // then
      expect(user.profile?.email).toBe('alice@example.com')
      expect(user.profile?.title).toBe('Engineer')
      expect(user.profile?.status_text).toBe('Working from home')
    })

    it('passes the user ID to getUserInfo', async () => {
      // given
      const client = await new SlackBotClient().login({ token: 'xoxb-test-token' })

      // when
      await client.getUserInfo('U456')

      // then
      expect(mockGetUserInfo).toHaveBeenCalledWith('U456')
    })
  })
})
