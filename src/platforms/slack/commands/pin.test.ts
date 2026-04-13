import { beforeEach, describe, expect, mock, test } from 'bun:test'

import { SlackClient } from '@/platforms/slack/client'
import type { SlackPin } from '@/platforms/slack/types'

describe('Pin Commands', () => {
  let mockClient: Partial<SlackClient>

  beforeEach(() => {
    mockClient = {
      pinMessage: mock(async () => {}),
      unpinMessage: mock(async () => {}),
      listPins: mock(
        async (): Promise<SlackPin[]> => [
          {
            channel: 'C001',
            message: {
              ts: '1234567890.123456',
              text: 'Pinned message',
              user: 'U001',
              type: 'message',
            },
            date_created: 1234567890,
            created_by: 'U001',
          },
        ],
      ),
    }
  })

  describe('pin add', () => {
    test('pins a message successfully', async () => {
      await (mockClient as SlackClient).pinMessage('C001', '1234567890.123456')
      expect(mockClient.pinMessage).toHaveBeenCalledWith('C001', '1234567890.123456')
    })

    test('throws error when API fails', async () => {
      mockClient.pinMessage = mock(async () => {
        throw new Error('already_pinned')
      })
      await expect((mockClient as SlackClient).pinMessage('C001', '123.456')).rejects.toThrow('already_pinned')
    })
  })

  describe('pin remove', () => {
    test('unpins a message successfully', async () => {
      await (mockClient as SlackClient).unpinMessage('C001', '1234567890.123456')
      expect(mockClient.unpinMessage).toHaveBeenCalledWith('C001', '1234567890.123456')
    })

    test('throws error when API fails', async () => {
      mockClient.unpinMessage = mock(async () => {
        throw new Error('no_pin')
      })
      await expect((mockClient as SlackClient).unpinMessage('C001', '123.456')).rejects.toThrow('no_pin')
    })
  })

  describe('pin list', () => {
    test('lists pinned messages', async () => {
      const pins = await (mockClient as SlackClient).listPins('C001')
      expect(pins).toHaveLength(1)
      expect(pins[0].message.text).toBe('Pinned message')
      expect(pins[0].created_by).toBe('U001')
    })

    test('throws error when API fails', async () => {
      mockClient.listPins = mock(async () => {
        throw new Error('channel_not_found')
      })
      await expect((mockClient as SlackClient).listPins('C001')).rejects.toThrow('channel_not_found')
    })
  })
})
