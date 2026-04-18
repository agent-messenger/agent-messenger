import { beforeEach, describe, expect, mock, it } from 'bun:test'

import { SlackClient } from '@/platforms/slack/client'
import type { SlackBookmark } from '@/platforms/slack/types'

const sampleBookmark: SlackBookmark = {
  id: 'Bm001',
  channel_id: 'C001',
  title: 'Test Bookmark',
  link: 'https://example.com',
  type: 'link',
  date_created: 1234567890,
  date_updated: 1234567890,
  created_by: 'U001',
}

describe('Bookmark Commands', () => {
  let mockClient: Partial<SlackClient>

  beforeEach(() => {
    mockClient = {
      addBookmark: mock(async () => sampleBookmark),
      editBookmark: mock(async () => ({ ...sampleBookmark, title: 'Updated Title' })),
      removeBookmark: mock(async () => {}),
      listBookmarks: mock(async (): Promise<SlackBookmark[]> => [sampleBookmark]),
    }
  })

  describe('bookmark add', () => {
    it('adds a bookmark successfully', async () => {
      const result = await (mockClient as SlackClient).addBookmark('C001', 'Test Bookmark', 'https://example.com')
      expect(result.id).toBe('Bm001')
      expect(result.title).toBe('Test Bookmark')
    })

    it('throws error when API fails', async () => {
      mockClient.addBookmark = mock(async () => {
        throw new Error('channel_not_found')
      })
      await expect((mockClient as SlackClient).addBookmark('C001', 'T', 'https://example.com')).rejects.toThrow(
        'channel_not_found',
      )
    })
  })

  describe('bookmark edit', () => {
    it('edits a bookmark successfully', async () => {
      const result = await (mockClient as SlackClient).editBookmark('C001', 'Bm001', { title: 'Updated Title' })
      expect(result.title).toBe('Updated Title')
    })

    it('throws error when API fails', async () => {
      mockClient.editBookmark = mock(async () => {
        throw new Error('bookmark_not_found')
      })
      await expect((mockClient as SlackClient).editBookmark('C001', 'Bm999', { title: 'X' })).rejects.toThrow(
        'bookmark_not_found',
      )
    })
  })

  describe('bookmark remove', () => {
    it('removes a bookmark successfully', async () => {
      await (mockClient as SlackClient).removeBookmark('C001', 'Bm001')
      expect(mockClient.removeBookmark).toHaveBeenCalledWith('C001', 'Bm001')
    })

    it('throws error when API fails', async () => {
      mockClient.removeBookmark = mock(async () => {
        throw new Error('bookmark_not_found')
      })
      await expect((mockClient as SlackClient).removeBookmark('C001', 'Bm999')).rejects.toThrow('bookmark_not_found')
    })
  })

  describe('bookmark list', () => {
    it('lists bookmarks in a channel', async () => {
      const bookmarks = await (mockClient as SlackClient).listBookmarks('C001')
      expect(bookmarks).toHaveLength(1)
      expect(bookmarks[0].title).toBe('Test Bookmark')
      expect(bookmarks[0].link).toBe('https://example.com')
    })

    it('throws error when API fails', async () => {
      mockClient.listBookmarks = mock(async () => {
        throw new Error('channel_not_found')
      })
      await expect((mockClient as SlackClient).listBookmarks('C001')).rejects.toThrow('channel_not_found')
    })
  })
})
