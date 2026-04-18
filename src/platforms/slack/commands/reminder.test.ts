import { beforeEach, describe, expect, mock, it } from 'bun:test'

import { SlackClient } from '@/platforms/slack/client'
import type { SlackReminder } from '@/platforms/slack/types'

const sampleReminder: SlackReminder = {
  id: 'Rm001',
  creator: 'U001',
  text: 'Do something important',
  user: 'U001',
  recurring: false,
  time: 1700000000,
  complete_ts: 0,
}

describe('Reminder Commands', () => {
  let mockClient: Partial<SlackClient>

  beforeEach(() => {
    mockClient = {
      addReminder: mock(async () => sampleReminder),
      listReminders: mock(async (): Promise<SlackReminder[]> => [sampleReminder]),
      completeReminder: mock(async () => {}),
      deleteReminder: mock(async () => {}),
    }
  })

  describe('reminder add', () => {
    it('adds a reminder successfully', async () => {
      const result = await (mockClient as SlackClient).addReminder('Do something important', 1700000000)
      expect(result.id).toBe('Rm001')
      expect(result.text).toBe('Do something important')
    })

    it('throws error when API fails', async () => {
      mockClient.addReminder = mock(async () => {
        throw new Error('invalid_time')
      })
      await expect((mockClient as SlackClient).addReminder('Do something', 1700000000)).rejects.toThrow('invalid_time')
    })
  })

  describe('reminder list', () => {
    it('lists all reminders', async () => {
      const reminders = await (mockClient as SlackClient).listReminders()
      expect(reminders).toHaveLength(1)
      expect(reminders[0].text).toBe('Do something important')
      expect(reminders[0].recurring).toBe(false)
    })

    it('throws error when API fails', async () => {
      mockClient.listReminders = mock(async () => {
        throw new Error('invalid_auth')
      })
      await expect((mockClient as SlackClient).listReminders()).rejects.toThrow('invalid_auth')
    })
  })

  describe('reminder complete', () => {
    it('completes a reminder successfully', async () => {
      await (mockClient as SlackClient).completeReminder('Rm001')
      expect(mockClient.completeReminder).toHaveBeenCalledWith('Rm001')
    })

    it('throws error when API fails', async () => {
      mockClient.completeReminder = mock(async () => {
        throw new Error('reminder_not_found')
      })
      await expect((mockClient as SlackClient).completeReminder('Rm999')).rejects.toThrow('reminder_not_found')
    })
  })

  describe('reminder delete', () => {
    it('deletes a reminder successfully', async () => {
      await (mockClient as SlackClient).deleteReminder('Rm001')
      expect(mockClient.deleteReminder).toHaveBeenCalledWith('Rm001')
    })

    it('throws error when API fails', async () => {
      mockClient.deleteReminder = mock(async () => {
        throw new Error('reminder_not_found')
      })
      await expect((mockClient as SlackClient).deleteReminder('Rm999')).rejects.toThrow('reminder_not_found')
    })
  })
})
