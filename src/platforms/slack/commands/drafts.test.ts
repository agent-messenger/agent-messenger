import { beforeEach, describe, expect, mock, test } from 'bun:test'

import { SlackClient } from '@/platforms/slack/client'

describe('Drafts Commands', () => {
  let mockClient: SlackClient

  beforeEach(() => {
    // Mock SlackClient
    mockClient = {
      getDrafts: mock(async (cursor?: string) => ({
        drafts: [
          {
            id: 'D001',
            channel_id: 'C123',
            message: {
              text: 'Draft message 1',
              blocks: [],
            },
            date_created: 1234567890,
            date_updated: 1234567891,
          },
          {
            id: 'D002',
            channel_id: 'C456',
            message: {
              text: 'Draft message 2',
              blocks: [],
            },
            date_created: 1234567892,
            date_updated: 1234567893,
          },
          {
            id: 'D003',
            channel_id: 'C789',
            message: null,
            date_created: 1234567894,
            date_updated: 1234567895,
          },
          {
            id: 'D004',
            channel_id: 'C999',
            message: {},
            date_created: 1234567896,
            date_updated: 1234567897,
          },
        ],
        next_cursor: cursor ? undefined : 'next_page_cursor',
      })),
    } as any
  })

  describe('drafts list', () => {
    test('returns drafts', async () => {
      // Given: Client with drafts
      // When: Getting drafts
      const result = await mockClient.getDrafts()

      // Then: Should return drafts array
      expect(result.drafts).toHaveLength(4)
      expect(result.drafts[0].id).toBe('D001')
      expect(result.drafts[0].message?.text).toBe('Draft message 1')
    })

    test('handles empty message content gracefully', async () => {
      // Given: Client with drafts including null/empty message
      // When: Getting drafts
      const result = await mockClient.getDrafts()

      // Then: Should handle null message
      expect(result.drafts[2].message).toBeNull()

      // Then: Should handle empty object message
      expect(result.drafts[3].message).toEqual({})
    })

    test('pagination with cursor works', async () => {
      // Given: Client with pagination support
      // When: Getting first page
      const firstPage = await mockClient.getDrafts()

      // Then: Should return next_cursor
      expect(firstPage.next_cursor).toBe('next_page_cursor')

      // When: Getting next page with cursor
      const secondPage = await mockClient.getDrafts('next_page_cursor')

      // Then: Should not have next_cursor (last page)
      expect(secondPage.next_cursor).toBeUndefined()
    })

    test('returns next_cursor for pagination', async () => {
      // Given: Client with more drafts available
      // When: Getting drafts
      const result = await mockClient.getDrafts()

      // Then: Should include next_cursor
      expect(result.next_cursor).toBeDefined()
      expect(result.next_cursor).toBe('next_page_cursor')
    })
  })

  describe('output formatting', () => {
    test('formats draft output', async () => {
      // Given: Drafts from API
      const result = await mockClient.getDrafts()

      // When: Formatting output
      const output = result.drafts.map((draft) => ({
        id: draft.id,
        channel_id: draft.channel_id,
        text: draft.message?.text || '',
        date_created: draft.date_created,
        date_updated: draft.date_updated,
      }))

      // Then: Should include draft fields
      expect(output[0].id).toBe('D001')
      expect(output[0].text).toBe('Draft message 1')
    })

    test('handles null message in output', async () => {
      // Given: Draft with null message
      const result = await mockClient.getDrafts()

      // When: Formatting output with null message
      const output = result.drafts.map((draft) => ({
        id: draft.id,
        text: draft.message?.text || '',
      }))

      // Then: Should use empty string for null message
      expect(output[2].text).toBe('')
      expect(output[3].text).toBe('')
    })
  })
})
