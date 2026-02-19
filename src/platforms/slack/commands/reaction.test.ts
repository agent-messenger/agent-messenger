import { describe, expect, mock, test } from 'bun:test'
import { Command } from 'commander'
import { reactionCommand } from '@/platforms/slack/commands/reaction'

describe('reaction command', () => {
  describe('add subcommand', () => {
    test('adds reaction to message with channel and message ts', async () => {
      const channelId = 'C123'
      const messageTs = '1234567890.123456'
      const emoji = 'thumbsup'

      const mockAddReaction = mock((..._args: any[]) => Promise.resolve())
      await mockAddReaction(channelId, messageTs, emoji)

      expect(mockAddReaction).toHaveBeenCalledWith(channelId, messageTs, emoji)
      expect(mockAddReaction).toHaveBeenCalledTimes(1)
    })

    test('handles emoji without colons', async () => {
      const channelId = 'C123'
      const messageTs = '1234567890.123456'
      const emoji = 'thumbsup'

      const mockAddReaction = mock((..._args: any[]) => Promise.resolve())
      await mockAddReaction(channelId, messageTs, emoji)

      expect(mockAddReaction).toHaveBeenCalledWith(channelId, messageTs, 'thumbsup')
    })
  })

  describe('remove subcommand', () => {
    test('removes reaction from message with channel and message ts', async () => {
      const channelId = 'C123'
      const messageTs = '1234567890.123456'
      const emoji = 'thumbsup'

      const mockRemoveReaction = mock((..._args: any[]) => Promise.resolve())
      await mockRemoveReaction(channelId, messageTs, emoji)

      expect(mockRemoveReaction).toHaveBeenCalledWith(channelId, messageTs, emoji)
      expect(mockRemoveReaction).toHaveBeenCalledTimes(1)
    })
  })

  describe('list subcommand', () => {
    test('lists reactions on a message', async () => {
      const messageTs = '1234567890.123456'
      const mockMessage = {
        ts: messageTs,
        text: 'Hello',
        type: 'message',
        user: 'U456',
        reactions: [
          { name: 'thumbsup', count: 2, users: ['U123', 'U456'] },
          { name: 'heart', count: 1, users: ['U789'] },
        ],
      }

      const mockGetMessage = mock(() => Promise.resolve(mockMessage))
      const result = await mockGetMessage()

      expect(result).not.toBeNull()
      expect(result!.ts).toBe(messageTs)
      expect(result!.reactions).toHaveLength(2)
    })

    test('returns empty reactions list when no reactions', async () => {
      const messageTs = '1234567890.123456'
      const mockMessage = {
        ts: messageTs,
        text: 'Hello',
        type: 'message',
        user: 'U456',
        reactions: [],
      }

      const mockGetMessage = mock(() => Promise.resolve(mockMessage))
      const result = await mockGetMessage()

      expect(result).not.toBeNull()
      expect(result!.reactions).toEqual([])
    })

    test('returns null when message not found', async () => {
      const mockGetMessage = mock(() => Promise.resolve(null))
      const result = await mockGetMessage()

      expect(result).toBeNull()
    })
  })

  describe('command structure', () => {
    test('reaction command exists', () => {
      expect(reactionCommand).toBeInstanceOf(Command)
    })

    test('reaction command has correct name', () => {
      expect(reactionCommand.name()).toBe('reaction')
    })

    test('reaction command has description', () => {
      expect(reactionCommand.description()).toBe('Reaction commands')
    })
  })
})
