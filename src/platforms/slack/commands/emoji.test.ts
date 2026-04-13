import { beforeEach, describe, expect, mock, test } from 'bun:test'

import { SlackClient } from '@/platforms/slack/client'

describe('Emoji Commands', () => {
  let mockClient: Partial<SlackClient>

  beforeEach(() => {
    mockClient = {
      listEmoji: mock(
        async (): Promise<Record<string, string>> => ({
          party_blob: 'https://example.com/party_blob.gif',
          cool_sunglasses: 'https://example.com/cool_sunglasses.png',
        }),
      ),
    }
  })

  describe('emoji list', () => {
    test('lists custom emoji', async () => {
      const emoji = await (mockClient as SlackClient).listEmoji()
      expect(emoji['party_blob']).toBe('https://example.com/party_blob.gif')
      expect(emoji['cool_sunglasses']).toBe('https://example.com/cool_sunglasses.png')
      expect(Object.keys(emoji)).toHaveLength(2)
    })

    test('throws error when API fails', async () => {
      mockClient.listEmoji = mock(async () => {
        throw new Error('invalid_auth')
      })
      await expect((mockClient as SlackClient).listEmoji()).rejects.toThrow('invalid_auth')
    })
  })
})
