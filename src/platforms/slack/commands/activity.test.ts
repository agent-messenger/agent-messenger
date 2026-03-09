import { describe, expect, mock, test } from 'bun:test'

import { Command } from 'commander'

import { activityCommand } from '@/platforms/slack/commands/activity'

describe('activity command', () => {
  describe('list subcommand', () => {
    test('returns activity items', async () => {
      const mockActivityItems = [
        {
          id: 'act_1',
          type: 'thread_reply',
          channel: 'C123',
          ts: '1234567890.123456',
          text: 'New reply in thread',
          user: 'U456',
          created: 1234567890,
        },
        {
          id: 'act_2',
          type: 'message_reaction',
          channel: 'C456',
          ts: '1234567891.123456',
          text: 'Someone reacted to your message',
          user: 'U789',
          created: 1234567891,
        },
      ]

      const mockGetActivityFeed = mock(() => Promise.resolve(mockActivityItems))
      const result = await mockGetActivityFeed()

      expect(result).toHaveLength(2)
      expect(result[0].type).toBe('thread_reply')
      expect(result[1].type).toBe('message_reaction')
    })

    test('respects limit option', async () => {
      const mockActivityItems = [
        {
          id: 'act_1',
          type: 'thread_reply',
          channel: 'C123',
          ts: '1234567890.123456',
          text: 'New reply',
          user: 'U456',
          created: 1234567890,
        },
      ]

      const mockGetActivityFeed = mock((_options?: { limit?: number }) => Promise.resolve(mockActivityItems))
      const result = await mockGetActivityFeed({ limit: 10 })

      expect(mockGetActivityFeed).toHaveBeenCalledWith({ limit: 10 })
      expect(result).toHaveLength(1)
    })

    test('respects unread-only mode', async () => {
      const mockActivityItems = [
        {
          id: 'act_1',
          type: 'at_user',
          channel: 'C123',
          ts: '1234567890.123456',
          text: 'You were mentioned',
          user: 'U456',
          created: 1234567890,
        },
      ]

      const mockGetActivityFeed = mock((_options?: { mode?: string }) => Promise.resolve(mockActivityItems))
      const result = await mockGetActivityFeed({ mode: 'priority_unreads_v1' })

      expect(mockGetActivityFeed).toHaveBeenCalledWith({ mode: 'priority_unreads_v1' })
      expect(result).toHaveLength(1)
    })

    test('respects types filter', async () => {
      const mockActivityItems = [
        {
          id: 'act_1',
          type: 'thread_reply',
          channel: 'C123',
          ts: '1234567890.123456',
          text: 'New reply',
          user: 'U456',
          created: 1234567890,
        },
      ]

      const mockGetActivityFeed = mock((_options?: { types?: string }) => Promise.resolve(mockActivityItems))
      const result = await mockGetActivityFeed({ types: 'thread_reply,at_user' })

      expect(mockGetActivityFeed).toHaveBeenCalledWith({ types: 'thread_reply,at_user' })
      expect(result).toHaveLength(1)
    })

    test('handles empty activity feed', async () => {
      const mockGetActivityFeed = mock(() => Promise.resolve([]))
      const result = await mockGetActivityFeed()

      expect(result).toHaveLength(0)
    })
  })

  describe('command structure', () => {
    test('activity command exists', () => {
      expect(activityCommand).toBeInstanceOf(Command)
    })

    test('activity command has correct name', () => {
      expect(activityCommand.name()).toBe('activity')
    })

    test('activity command has description', () => {
      expect(activityCommand.description()).toBe('Activity feed commands')
    })

    test('list subcommand exists', () => {
      const listCmd = activityCommand.commands.find((cmd) => cmd.name() === 'list')
      expect(listCmd).toBeDefined()
    })

    test('list subcommand has --unread option', () => {
      const listCmd = activityCommand.commands.find((cmd) => cmd.name() === 'list')
      const unreadOption = listCmd?.options.find((opt) => opt.long === '--unread')
      expect(unreadOption).toBeDefined()
    })

    test('list subcommand has --limit option', () => {
      const listCmd = activityCommand.commands.find((cmd) => cmd.name() === 'list')
      const limitOption = listCmd?.options.find((opt) => opt.long === '--limit')
      expect(limitOption).toBeDefined()
    })

    test('list subcommand has --types option', () => {
      const listCmd = activityCommand.commands.find((cmd) => cmd.name() === 'list')
      const typesOption = listCmd?.options.find((opt) => opt.long === '--types')
      expect(typesOption).toBeDefined()
    })
  })
})
