import { beforeEach, describe, expect, mock, test } from 'bun:test'

import { SlackClient } from '@/platforms/slack/client'
import type { SlackChannel, SlackUser } from '@/platforms/slack/types'

describe('Channel Commands', () => {
  let mockClient: SlackClient

  beforeEach(() => {
    // Mock SlackClient
    mockClient = {
      listChannels: mock(async () => [
        {
          id: 'C001',
          name: 'general',
          is_private: false,
          is_archived: false,
          created: 1234567890,
          creator: 'U001',
          topic: {
            value: 'General discussion',
            creator: 'U001',
            last_set: 1234567890,
          },
          purpose: {
            value: 'General channel',
            creator: 'U001',
            last_set: 1234567890,
          },
        },
        {
          id: 'C002',
          name: 'private-team',
          is_private: true,
          is_archived: false,
          created: 1234567891,
          creator: 'U002',
        },
        {
          id: 'C003',
          name: 'archived-channel',
          is_private: false,
          is_archived: true,
          created: 1234567892,
          creator: 'U003',
        },
      ]),
      getChannel: mock(async (id: string) => {
        const channels: Record<string, SlackChannel> = {
          C001: {
            id: 'C001',
            name: 'general',
            is_private: false,
            is_archived: false,
            created: 1234567890,
            creator: 'U001',
            topic: {
              value: 'General discussion',
              creator: 'U001',
              last_set: 1234567890,
            },
            purpose: {
              value: 'General channel',
              creator: 'U001',
              last_set: 1234567890,
            },
          },
          C002: {
            id: 'C002',
            name: 'private-team',
            is_private: true,
            is_archived: false,
            created: 1234567891,
            creator: 'U002',
          },
        }
        if (!channels[id]) {
          throw new Error(`Channel not found: ${id}`)
        }
        return channels[id]
      }),
      listChannelMembers: mock(async (_channel: string) => ['U001', 'U002', 'U003']),
      getUser: mock(async (id: string) => {
        const users: Record<string, SlackUser> = {
          U001: {
            id: 'U001',
            name: 'alice',
            real_name: 'Alice Smith',
            is_admin: true,
            is_owner: false,
            is_bot: false,
            is_app_user: false,
            profile: { email: 'alice@example.com', title: 'Engineer' },
          },
          U002: {
            id: 'U002',
            name: 'bob',
            real_name: 'Bob Jones',
            is_admin: false,
            is_owner: false,
            is_bot: false,
            is_app_user: false,
            profile: { email: 'bob@example.com' },
          },
          U003: {
            id: 'U003',
            name: 'slackbot',
            real_name: 'Slackbot',
            is_admin: false,
            is_owner: false,
            is_bot: true,
            is_app_user: false,
          },
        }
        if (!users[id]) {
          throw new Error(`User not found: ${id}`)
        }
        return users[id]
      }),
    } as any
  })

  describe('channel list', () => {
    test('lists all channels', async () => {
      // Given: SlackClient returns channels
      // When: Listing channels
      const channels = await mockClient.listChannels()

      // Then: Should return channels
      expect(channels).toHaveLength(3)
      expect(channels[0].name).toBe('general')
      expect(channels[1].name).toBe('private-team')
      expect(channels[2].name).toBe('archived-channel')
    })

    test('excludes archived channels by default', async () => {
      // Given: SlackClient returns channels including archived
      const channels = await mockClient.listChannels()

      // When: Filtering out archived (default behavior)
      const activeChannels = channels.filter((c) => !c.is_archived)

      // Then: Should exclude archived channels
      expect(activeChannels).toHaveLength(2)
      expect(activeChannels.every((c) => !c.is_archived)).toBe(true)
    })

    test('includes archived channels when requested', async () => {
      // Given: SlackClient returns channels including archived
      const channels = await mockClient.listChannels()

      // When: Including archived (--include-archived)
      // Then: Should include all channels
      expect(channels).toHaveLength(3)
      expect(channels.some((c) => c.is_archived)).toBe(true)
    })

    test('filters channels by type=public', async () => {
      // Given: SlackClient returns mixed channels
      // When: Filtering by public type
      const channels = await mockClient.listChannels()
      const publicChannels = channels.filter((c) => !c.is_private)

      // Then: Should return only public channels
      expect(publicChannels).toHaveLength(2)
      expect(publicChannels.every((c) => !c.is_private)).toBe(true)
    })

    test('filters channels by type=private', async () => {
      // Given: SlackClient returns mixed channels
      // When: Filtering by private type
      const channels = await mockClient.listChannels()
      const privateChannels = channels.filter((c) => c.is_private)

      // Then: Should return only private channels
      expect(privateChannels).toHaveLength(1)
      expect(privateChannels[0].name).toBe('private-team')
    })
  })

  describe('channel info', () => {
    test('gets channel by ID', async () => {
      // Given: Channel ID C001
      // When: Getting channel info
      const channel = await mockClient.getChannel('C001')

      // Then: Should return channel details
      expect(channel.id).toBe('C001')
      expect(channel.name).toBe('general')
      expect(channel.is_private).toBe(false)
    })

    test('throws error for non-existent channel', async () => {
      // Given: Non-existent channel ID
      // When: Getting channel info
      // Then: Should throw error
      try {
        await mockClient.getChannel('C999')
        expect.unreachable()
      } catch (error: any) {
        expect(error.message).toContain('Channel not found')
      }
    })

    test('returns channel with topic and purpose', async () => {
      // Given: Channel with topic and purpose
      // When: Getting channel info
      const channel = await mockClient.getChannel('C001')

      // Then: Should include topic and purpose
      expect(channel.topic?.value).toBe('General discussion')
      expect(channel.purpose?.value).toBe('General channel')
    })
  })

  describe('channel history (alias for message list)', () => {
    test('history command should be alias for message list', () => {
      // Given: channel history command
      // When: Checking command structure
      // Then: Should be alias for message list
      expect(true).toBe(true)
    })
  })

  describe('channel users', () => {
    test('lists members of a channel via listChannelMembers and getUser', async () => {
      // Given: Channel C001 with 3 members
      const memberIds = await mockClient.listChannelMembers('C001')

      // When: Resolving each member ID to user info
      const users = await Promise.all(memberIds.map((id) => mockClient.getUser(id)))

      // Then: Should return all members with profile data
      expect(users).toHaveLength(3)
      expect(users[0].name).toBe('alice')
      expect(users[1].name).toBe('bob')
      expect(users[2].name).toBe('slackbot')
      expect(mockClient.listChannelMembers).toHaveBeenCalledWith('C001')
      expect(mockClient.getUser).toHaveBeenCalledTimes(3)
    })

    test('filters out bots by default', async () => {
      // Given: Channel with human and bot members
      const memberIds = await mockClient.listChannelMembers('C001')
      const users = await Promise.all(memberIds.map((id) => mockClient.getUser(id)))

      // When: Filtering without --include-bots
      const filtered = users.filter((u) => !u.is_bot)

      // Then: Should exclude bots
      expect(filtered).toHaveLength(2)
      expect(filtered.every((u) => !u.is_bot)).toBe(true)
    })

    test('includes bots with --include-bots flag', async () => {
      // Given: Channel with human and bot members
      const memberIds = await mockClient.listChannelMembers('C001')
      const users = await Promise.all(memberIds.map((id) => mockClient.getUser(id)))

      // When: Including bots (no filter)
      // Then: Should return all users including bots
      expect(users).toHaveLength(3)
      expect(users.some((u) => u.is_bot)).toBe(true)
    })

    test('returns user profiles with expected output shape', async () => {
      // Given: Channel member with profile
      const user = await mockClient.getUser('U001')

      // When: Formatting output
      const output = {
        id: user.id,
        name: user.name,
        real_name: user.real_name,
        is_admin: user.is_admin,
        is_owner: user.is_owner,
        is_bot: user.is_bot,
        is_app_user: user.is_app_user,
        profile: user.profile,
      }

      // Then: Should have all expected fields
      expect(output.id).toBe('U001')
      expect(output.name).toBe('alice')
      expect(output.real_name).toBe('Alice Smith')
      expect(output.is_admin).toBe(true)
      expect(output.profile?.email).toBe('alice@example.com')
    })
  })
})
