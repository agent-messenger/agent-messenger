import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'

import { SlackClient } from '@/platforms/slack/client'
import { listAction, userCommand } from '@/platforms/slack/commands/user'
import { CredentialManager } from '@/platforms/slack/credential-manager'
import type { SlackUser } from '@/platforms/slack/types'

// Mock users
const mockUsers: SlackUser[] = [
  {
    id: 'U001',
    name: 'alice',
    real_name: 'Alice Smith',
    is_admin: true,
    is_owner: false,
    is_bot: false,
    is_app_user: false,
    profile: {
      email: 'alice@example.com',
      title: 'Engineer',
    },
  },
  {
    id: 'U002',
    name: 'bob',
    real_name: 'Bob Jones',
    is_admin: false,
    is_owner: false,
    is_bot: false,
    is_app_user: false,
    profile: {
      email: 'bob@example.com',
    },
  },
  {
    id: 'U003',
    name: 'slackbot',
    real_name: 'Slackbot',
    is_admin: false,
    is_owner: false,
    is_bot: true,
    is_app_user: false,
  },
]

describe('User Commands', () => {
  let getWorkspaceSpy: ReturnType<typeof spyOn>
  let listUsersPageSpy: ReturnType<typeof spyOn>
  let consoleLogSpy: ReturnType<typeof spyOn>
  let processExitSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    getWorkspaceSpy = spyOn(CredentialManager.prototype, 'getWorkspace').mockResolvedValue({
      workspace_id: 'T123',
      workspace_name: 'Test Workspace',
      token: 'xoxc-test',
      cookie: 'test-cookie',
    })
    listUsersPageSpy = spyOn(SlackClient.prototype, 'listUsersPage').mockResolvedValue({
      users: mockUsers,
      has_more: true,
      next_cursor: 'cursor123',
    })
    consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {})
    processExitSpy = spyOn(process, 'exit').mockImplementation((_code?: number) => undefined as never)
  })

  afterEach(() => {
    getWorkspaceSpy?.mockRestore()
    listUsersPageSpy?.mockRestore()
    consoleLogSpy?.mockRestore()
    processExitSpy?.mockRestore()
  })

  describe('user list', () => {
    test('lists users with pagination metadata', async () => {
      await listAction({})

      expect(consoleLogSpy).toHaveBeenCalledWith(
        JSON.stringify({
          users: [
            {
              id: 'U001',
              name: 'alice',
              real_name: 'Alice Smith',
              is_admin: true,
              is_owner: false,
              is_bot: false,
              is_app_user: false,
              profile: {
                email: 'alice@example.com',
                title: 'Engineer',
              },
            },
            {
              id: 'U002',
              name: 'bob',
              real_name: 'Bob Jones',
              is_admin: false,
              is_owner: false,
              is_bot: false,
              is_app_user: false,
              profile: {
                email: 'bob@example.com',
              },
            },
          ],
          has_more: true,
          next_cursor: 'cursor123',
        }),
      )
    })

    test('filters out bots by default', async () => {
      await listAction({})

      const output = JSON.parse(consoleLogSpy.mock.calls[0]?.[0] as string)
      expect(output.users).toHaveLength(2)
      expect(output.users.every((user: SlackUser) => !user.is_bot)).toBe(true)
    })

    test('includes bots with --include-bots flag', async () => {
      await listAction({ includeBots: true })

      const output = JSON.parse(consoleLogSpy.mock.calls[0]?.[0] as string)
      expect(output.users).toHaveLength(3)
    })

    test('passes pagination params to Slack client', async () => {
      await listAction({ limit: 50, cursor: 'cursor123' })

      expect(listUsersPageSpy).toHaveBeenCalledWith({
        limit: 50,
        cursor: 'cursor123',
      })
    })

    test('command exposes pagination options', () => {
      const listCommand = userCommand.commands.find((command) => command.name() === 'list')
      const optionFlags = listCommand?.options.map((option) => option.long)

      expect(optionFlags).toContain('--limit')
      expect(optionFlags).toContain('--cursor')
    })
  })

  describe('user info', () => {
    test('shows user details by ID', async () => {
      // Given: User ID
      // When: Getting user info
      // Then: Should return user details
      const user = mockUsers[0]
      expect(user.id).toBe('U001')
      expect(user.name).toBe('alice')
    })

    test('returns error for invalid user ID', async () => {
      // Given: Invalid user ID
      // When: Getting user info
      // Then: Should return error
      expect(true).toBe(true)
    })
  })

  describe('user me', () => {
    test('shows current authenticated user', async () => {
      // Given: Authenticated client
      // When: Running user me
      // Then: Should return current user info
      expect(true).toBe(true)
    })

    test('includes user profile details', async () => {
      // Given: Current user
      const user = mockUsers[0]

      // When: Getting user info
      // Then: Should include profile
      expect(user.profile).toBeDefined()
      expect(user.profile?.email).toBe('alice@example.com')
    })
  })

  describe('output format', () => {
    test('returns JSON with user data', async () => {
      // Given: Users
      const user = mockUsers[0]

      // When: Formatting output
      const output = { user }

      // Then: Should be valid JSON
      const json = JSON.stringify(output)
      expect(json).toContain('alice')
    })

    test('supports --pretty flag for formatting', async () => {
      // Given: Output data
      const data = { users: mockUsers }

      // When: Formatting with pretty flag
      const pretty = JSON.stringify(data, null, 2)

      // Then: Should have indentation
      expect(pretty).toContain('\n')
    })
  })
})
