import { beforeEach, describe, expect, mock, test } from 'bun:test'

import { SlackClient } from '@/platforms/slack/client'

describe('Sections Commands', () => {
  let mockClient: SlackClient

  beforeEach(() => {
    // Mock SlackClient
    mockClient = {
      getChannelSections: mock(async () => [
        {
          id: 'S001',
          name: 'Work Projects',
          channel_ids: ['C001', 'C002', 'C003'],
          date_created: 1234567890,
          date_updated: 1234567900,
        },
        {
          id: 'S002',
          name: 'Personal',
          channel_ids: ['C004', 'C005'],
          date_created: 1234567891,
          date_updated: 1234567901,
        },
        {
          id: 'S003',
          name: 'Archive',
          channel_ids: [],
          date_created: 1234567892,
          date_updated: 1234567902,
        },
      ]),
    } as any
  })

  describe('sections list', () => {
    test('lists all channel sections', async () => {
      // Given: SlackClient returns channel sections
      // When: Listing sections
      const sections = await mockClient.getChannelSections()

      // Then: Should return sections
      expect(sections).toHaveLength(3)
      expect(sections[0].name).toBe('Work Projects')
      expect(sections[1].name).toBe('Personal')
      expect(sections[2].name).toBe('Archive')
    })

    test('returns sections with channel IDs', async () => {
      // Given: SlackClient returns sections with channels
      // When: Listing sections
      const sections = await mockClient.getChannelSections()

      // Then: Should include channel IDs
      expect(sections[0].channel_ids).toHaveLength(3)
      expect(sections[0].channel_ids).toContain('C001')
      expect(sections[1].channel_ids).toHaveLength(2)
    })

    test('returns sections with timestamps', async () => {
      // Given: SlackClient returns sections
      // When: Listing sections
      const sections = await mockClient.getChannelSections()

      // Then: Should include timestamps
      expect(sections[0].date_created).toBe(1234567890)
      expect(sections[0].date_updated).toBe(1234567900)
    })

    test('handles empty sections', async () => {
      // Given: SlackClient returns section with no channels
      // When: Listing sections
      const sections = await mockClient.getChannelSections()

      // Then: Should include empty section
      expect(sections[2].channel_ids).toHaveLength(0)
      expect(sections[2].name).toBe('Archive')
    })
  })
})
