import { beforeEach, describe, expect, mock, test } from 'bun:test'

import { SlackClient } from '@/platforms/slack/client'
import type { SlackUsergroup } from '@/platforms/slack/types'

const sampleUsergroup: SlackUsergroup = {
  id: 'S0616NG6M',
  team_id: 'T0ABC1234',
  name: 'Marketing Team',
  handle: 'marketing-team',
  description: 'Marketing gurus, PR experts and product advocates.',
  is_external: false,
  is_usergroup: true,
  date_create: 1446746793,
  date_update: 1446746793,
  date_delete: 0,
  auto_type: null,
  created_by: 'U060R4BJ4',
  updated_by: 'U060R4BJ4',
  deleted_by: null,
  prefs: { channels: [], groups: [] },
  users: ['U060R4BJ4', 'U060RNRCZ'],
  user_count: 2,
}

describe('Usergroup Commands', () => {
  let mockClient: Partial<SlackClient>

  beforeEach(() => {
    mockClient = {
      listUsergroups: mock(async (): Promise<SlackUsergroup[]> => [sampleUsergroup]),
      createUsergroup: mock(async () => sampleUsergroup),
      updateUsergroup: mock(async () => sampleUsergroup),
      enableUsergroup: mock(async () => sampleUsergroup),
      disableUsergroup: mock(async () => ({ ...sampleUsergroup, date_delete: 1700000000 })),
      listUsergroupMembers: mock(async (): Promise<string[]> => ['U060R4BJ4', 'U060RNRCZ']),
      updateUsergroupMembers: mock(async () => sampleUsergroup),
    }
  })

  describe('usergroup list', () => {
    test('lists all user groups', async () => {
      const usergroups = await (mockClient as SlackClient).listUsergroups()
      expect(usergroups).toHaveLength(1)
      expect(usergroups[0].name).toBe('Marketing Team')
      expect(usergroups[0].handle).toBe('marketing-team')
    })

    test('throws error when API fails', async () => {
      mockClient.listUsergroups = mock(async () => {
        throw new Error('invalid_auth')
      })
      await expect((mockClient as SlackClient).listUsergroups()).rejects.toThrow('invalid_auth')
    })
  })

  describe('usergroup create', () => {
    test('creates a user group successfully', async () => {
      const result = await (mockClient as SlackClient).createUsergroup('Marketing Team', {
        handle: 'marketing-team',
        description: 'Marketing gurus, PR experts and product advocates.',
      })
      expect(result.id).toBe('S0616NG6M')
      expect(result.name).toBe('Marketing Team')
    })

    test('throws error when API fails', async () => {
      mockClient.createUsergroup = mock(async () => {
        throw new Error('name_already_exists')
      })
      await expect((mockClient as SlackClient).createUsergroup('Duplicate')).rejects.toThrow('name_already_exists')
    })
  })

  describe('usergroup update', () => {
    test('updates a user group successfully', async () => {
      const result = await (mockClient as SlackClient).updateUsergroup('S0616NG6M', {
        name: 'Marketing Team',
        handle: 'marketing-team',
      })
      expect(result.id).toBe('S0616NG6M')
      expect(result.name).toBe('Marketing Team')
    })

    test('throws error when API fails', async () => {
      mockClient.updateUsergroup = mock(async () => {
        throw new Error('no_such_subteam')
      })
      await expect((mockClient as SlackClient).updateUsergroup('S999', { name: 'Nope' })).rejects.toThrow(
        'no_such_subteam',
      )
    })
  })

  describe('usergroup enable', () => {
    test('enables a user group successfully', async () => {
      const result = await (mockClient as SlackClient).enableUsergroup('S0616NG6M')
      expect(result.id).toBe('S0616NG6M')
      expect(result.date_delete).toBe(0)
    })

    test('throws error when API fails', async () => {
      mockClient.enableUsergroup = mock(async () => {
        throw new Error('no_such_subteam')
      })
      await expect((mockClient as SlackClient).enableUsergroup('S999')).rejects.toThrow('no_such_subteam')
    })
  })

  describe('usergroup disable', () => {
    test('disables a user group successfully', async () => {
      const result = await (mockClient as SlackClient).disableUsergroup('S0616NG6M')
      expect(result.id).toBe('S0616NG6M')
      expect(result.date_delete).toBeGreaterThan(0)
    })

    test('throws error when API fails', async () => {
      mockClient.disableUsergroup = mock(async () => {
        throw new Error('no_such_subteam')
      })
      await expect((mockClient as SlackClient).disableUsergroup('S999')).rejects.toThrow('no_such_subteam')
    })
  })

  describe('usergroup members', () => {
    test('lists members of a user group', async () => {
      const users = await (mockClient as SlackClient).listUsergroupMembers('S0616NG6M')
      expect(users).toHaveLength(2)
      expect(users).toContain('U060R4BJ4')
      expect(users).toContain('U060RNRCZ')
    })

    test('throws error when API fails', async () => {
      mockClient.listUsergroupMembers = mock(async () => {
        throw new Error('no_such_subteam')
      })
      await expect((mockClient as SlackClient).listUsergroupMembers('S999')).rejects.toThrow('no_such_subteam')
    })
  })

  describe('usergroup members-update', () => {
    test('updates members of a user group', async () => {
      const result = await (mockClient as SlackClient).updateUsergroupMembers('S0616NG6M', ['U060R4BJ4', 'U060RNRCZ'])
      expect(result.id).toBe('S0616NG6M')
      expect(result.users).toHaveLength(2)
    })

    test('throws error when no users provided', async () => {
      mockClient.updateUsergroupMembers = mock(async () => {
        throw new Error('no_users_provided')
      })
      await expect((mockClient as SlackClient).updateUsergroupMembers('S0616NG6M', [])).rejects.toThrow(
        'no_users_provided',
      )
    })
  })
})
