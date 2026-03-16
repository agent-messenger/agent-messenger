import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test'

import { SlackClient } from '../client'
import { CredentialManager } from '../credential-manager'
import { countsAction, markAction, threadsAction } from './unread'

let credManagerGetWorkspaceSpy: ReturnType<typeof spyOn>
let clientGetUnreadCountsSpy: ReturnType<typeof spyOn>
let clientGetThreadViewSpy: ReturnType<typeof spyOn>
let clientMarkReadSpy: ReturnType<typeof spyOn>

beforeEach(() => {
  credManagerGetWorkspaceSpy = spyOn(CredentialManager.prototype, 'getWorkspace').mockResolvedValue({
    workspace_id: 'T123',
    workspace_name: 'Test Workspace',
    token: 'xoxc-test',
    cookie: 'test-cookie',
  })

  clientGetUnreadCountsSpy = spyOn(SlackClient.prototype, 'getUnreadCounts').mockResolvedValue({
    channels: [{ id: 'C123', name: 'general', unread_count: 5, mention_count: 2 }],
    total_unread: 5,
    total_mentions: 2,
  })

  clientGetThreadViewSpy = spyOn(SlackClient.prototype, 'getThreadView').mockResolvedValue({
    channel_id: 'C123',
    thread_ts: '1234567890.123456',
    unread_count: 3,
    last_read: '1234567890.123450',
    subscribed: true,
  })

  clientMarkReadSpy = spyOn(SlackClient.prototype, 'markRead').mockResolvedValue(undefined)
})

afterEach(() => {
  credManagerGetWorkspaceSpy?.mockRestore()
  clientGetUnreadCountsSpy?.mockRestore()
  clientGetThreadViewSpy?.mockRestore()
  clientMarkReadSpy?.mockRestore()
})

describe('unread commands', () => {
  describe('getUnreadCounts', () => {
    it('should return unread counts', async () => {
      const mockCounts = {
        channels: [
          { id: 'C123', name: 'general', unread_count: 5, mention_count: 2 },
          { id: 'C456', name: 'random', unread_count: 3, mention_count: 0 },
        ],
        total_unread: 8,
        total_mentions: 2,
      }

      clientGetUnreadCountsSpy.mockResolvedValue(mockCounts)

      const mockClient = new SlackClient('xoxc-test', 'test-cookie')
      const result = await mockClient.getUnreadCounts()

      expect(result).toEqual(mockCounts)
      expect(result.total_unread).toBe(8)
      expect(result.total_mentions).toBe(2)
      expect(result.channels).toHaveLength(2)
    })
  })

  describe('getThreadView', () => {
    it('should return thread subscription details', async () => {
      const mockThreadView = {
        channel_id: 'C123',
        thread_ts: '1234567890.123456',
        unread_count: 3,
        last_read: '1234567890.123450',
        subscribed: true,
      }

      clientGetThreadViewSpy.mockResolvedValue(mockThreadView)

      const mockClient = new SlackClient('xoxc-test', 'test-cookie')
      const result = await mockClient.getThreadView('C123', '1234567890.123456')

      expect(result).toEqual(mockThreadView)
      expect(result.unread_count).toBe(3)
      expect(result.subscribed).toBe(true)
    })
  })

  describe('markRead', () => {
    it('should mark channel as read', async () => {
      const mockClient = new SlackClient('xoxc-test', 'test-cookie')
      await mockClient.markRead('C123', '1234567890.123456')

      expect(clientMarkReadSpy).toHaveBeenCalledWith('C123', '1234567890.123456')
    })
  })

  describe('CLI commands', () => {
    it('should handle unread counts command', async () => {
      const mockConsoleLog = mock(() => {})
      const originalLog = console.log
      console.log = mockConsoleLog

      await countsAction({ pretty: false })

      expect(clientGetUnreadCountsSpy).toHaveBeenCalled()
      expect(mockConsoleLog).toHaveBeenCalled()

      console.log = originalLog
    })

    it('should handle unread threads command', async () => {
      const mockConsoleLog = mock(() => {})
      const originalLog = console.log
      console.log = mockConsoleLog

      await threadsAction('C123', '1234567890.123456', { pretty: false })

      expect(clientGetThreadViewSpy).toHaveBeenCalledWith('C123', '1234567890.123456')
      expect(mockConsoleLog).toHaveBeenCalled()

      console.log = originalLog
    })

    it('should handle mark read command', async () => {
      const mockConsoleLog = mock(() => {})
      const originalLog = console.log
      console.log = mockConsoleLog

      await markAction('C123', '1234567890.123456', { pretty: false })

      expect(clientMarkReadSpy).toHaveBeenCalledWith('C123', '1234567890.123456')
      expect(mockConsoleLog).toHaveBeenCalled()

      console.log = originalLog
    })
  })
})
