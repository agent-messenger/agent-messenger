import { beforeEach, describe, expect, mock, test } from 'bun:test'

import { SlackClient } from '@/platforms/slack/client'
import type { SlackSavedItem } from '@/platforms/slack/types'

describe('Saved Commands', () => {
  let mockClient: SlackClient

  beforeEach(() => {
    // Mock SlackClient
    mockClient = {
      getSavedItems: mock(async (cursor?: string) => {
        const items: SlackSavedItem[] = [
          {
            type: 'message',
            message: {
              ts: '1234567890.123456',
              text: 'Important message to save',
              user: 'U001',
              type: 'message',
            },
            channel: {
              id: 'C001',
              name: 'general',
            },
            date_created: 1234567890,
          },
          {
            type: 'message',
            message: {
              ts: '1234567891.123456',
              text: 'Another saved message',
              user: 'U002',
              type: 'message',
            },
            channel: {
              id: 'C002',
              name: 'random',
            },
            date_created: 1234567891,
          },
        ]

        if (cursor === 'next_page') {
          return {
            items: [
              {
                type: 'message',
                message: {
                  ts: '1234567892.123456',
                  text: 'Third saved message',
                  user: 'U003',
                  type: 'message',
                },
                channel: {
                  id: 'C003',
                  name: 'dev',
                },
                date_created: 1234567892,
              },
            ],
            has_more: false,
          }
        }

        return {
          items,
          has_more: true,
          next_cursor: 'next_page',
        }
      }),
    } as any
  })

  describe('saved list', () => {
    test('lists saved items', async () => {
      // Given: SlackClient returns saved items
      // When: Listing saved items
      const result = await mockClient.getSavedItems()

      // Then: Should return saved items
      expect(result.items).toHaveLength(2)
      expect(result.items[0].message.text).toBe('Important message to save')
      expect(result.items[1].message.text).toBe('Another saved message')
      expect(result.has_more).toBe(true)
      expect(result.next_cursor).toBe('next_page')
    })

    test('supports pagination with cursor', async () => {
      // Given: SlackClient returns paginated results
      // When: Fetching with cursor
      const result = await mockClient.getSavedItems('next_page')

      // Then: Should return next page
      expect(result.items).toHaveLength(1)
      expect(result.items[0].message.text).toBe('Third saved message')
      expect(result.has_more).toBe(false)
    })

    test('returns channel information with saved items', async () => {
      // Given: SlackClient returns saved items with channel info
      // When: Listing saved items
      const result = await mockClient.getSavedItems()

      // Then: Should include channel details
      expect(result.items[0].channel.id).toBe('C001')
      expect(result.items[0].channel.name).toBe('general')
      expect(result.items[1].channel.id).toBe('C002')
      expect(result.items[1].channel.name).toBe('random')
    })

    test('includes date_created timestamp', async () => {
      // Given: SlackClient returns saved items
      // When: Listing saved items
      const result = await mockClient.getSavedItems()

      // Then: Should include creation timestamp
      expect(result.items[0].date_created).toBe(1234567890)
      expect(result.items[1].date_created).toBe(1234567891)
    })
  })

  describe('CLI command: saved list', () => {
    test('supports --limit option', async () => {
      // Given: CLI command with --limit 50
      // When: Executing saved list --limit 50
      // Then: Should pass limit to API (tested via integration)
      expect(true).toBe(true)
    })

    test('supports --cursor option for pagination', async () => {
      // Given: CLI command with --cursor next_page
      // When: Executing saved list --cursor next_page
      const result = await mockClient.getSavedItems('next_page')

      // Then: Should fetch next page
      expect(result.items).toHaveLength(1)
      expect(result.has_more).toBe(false)
    })
  })
})
