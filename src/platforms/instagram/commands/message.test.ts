import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'

const originalConsoleLog = console.log
import type { Command } from 'commander'

const mockGetMessages = mock(() => Promise.resolve([{ id: 'msg-1', text: 'Hello' }]))
const mockSendMessage = mock(() => Promise.resolve({ id: 'msg-2', text: 'Sent' }))
const mockSendMessageToUser = mock(() => Promise.resolve({ id: 'msg-3', text: 'Sent to user' }))
const mockSearchMessages = mock(() => Promise.resolve([{ id: 'msg-4', text: 'Found' }]))
const mockSearchUsers = mock(() => Promise.resolve([{ pk: '999', username: 'targetuser' }]))

const mockClient = {
  getMessages: mockGetMessages,
  sendMessage: mockSendMessage,
  sendMessageToUser: mockSendMessageToUser,
  searchMessages: mockSearchMessages,
  searchUsers: mockSearchUsers,
}

mock.module('./shared', () => ({
  withInstagramClient: async (_options: unknown, fn: (client: typeof mockClient) => Promise<unknown>) => {
    return fn(mockClient)
  },
}))

import { messageCommand } from './message'

function resetCommandState(cmd: Command): void {
  for (const sub of cmd.commands) {
    ;(
      sub as unknown as { _optionValues: Record<string, unknown>; _optionValueSources: Record<string, unknown> }
    )._optionValues = {}
    ;(
      sub as unknown as { _optionValues: Record<string, unknown>; _optionValueSources: Record<string, unknown> }
    )._optionValueSources = {}
  }
}

describe('message commands', () => {
  let consoleLogSpy: ReturnType<typeof mock>
  let processExitSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    resetCommandState(messageCommand)

    mockGetMessages.mockReset()
    mockSendMessage.mockReset()
    mockSendMessageToUser.mockReset()
    mockSearchMessages.mockReset()
    mockSearchUsers.mockReset()

    mockGetMessages.mockImplementation(() => Promise.resolve([{ id: 'msg-1', text: 'Hello' }]))
    mockSendMessage.mockImplementation(() => Promise.resolve({ id: 'msg-2', text: 'Sent' }))
    mockSendMessageToUser.mockImplementation(() => Promise.resolve({ id: 'msg-3', text: 'Sent to user' }))
    mockSearchMessages.mockImplementation(() => Promise.resolve([{ id: 'msg-4', text: 'Found' }]))
    mockSearchUsers.mockImplementation(() => Promise.resolve([{ pk: '999', username: 'targetuser' }]))

    consoleLogSpy = mock((..._args: unknown[]) => {})
    console.log = consoleLogSpy
    processExitSpy = spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called')
    })
  })

  afterEach(() => {
    console.log = originalConsoleLog
    processExitSpy.mockRestore()
  })

  describe('list', () => {
    test('lists messages from a thread', async () => {
      await expect(messageCommand.parseAsync(['list', 'thread-123'], { from: 'user' })).rejects.toThrow(
        'process.exit called',
      )

      expect(processExitSpy).toHaveBeenCalledWith(0)
      expect(mockGetMessages).toHaveBeenCalledWith('thread-123', 25)
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output).toEqual([{ id: 'msg-1', text: 'Hello' }])
    })

    test('passes custom limit', async () => {
      await expect(
        messageCommand.parseAsync(['list', 'thread-123', '--limit', '10'], { from: 'user' }),
      ).rejects.toThrow('process.exit called')

      expect(mockGetMessages).toHaveBeenCalledWith('thread-123', 10)
    })
  })

  describe('send', () => {
    test('sends a message to a thread', async () => {
      await expect(messageCommand.parseAsync(['send', 'thread-123', 'Hello world'], { from: 'user' })).rejects.toThrow(
        'process.exit called',
      )

      expect(processExitSpy).toHaveBeenCalledWith(0)
      expect(mockSendMessage).toHaveBeenCalledWith('thread-123', 'Hello world')
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output).toEqual({ id: 'msg-2', text: 'Sent' })
    })
  })

  describe('send-to', () => {
    test('sends a message to a user by username', async () => {
      await expect(messageCommand.parseAsync(['send-to', 'targetuser', 'Hi there'], { from: 'user' })).rejects.toThrow(
        'process.exit called',
      )

      expect(processExitSpy).toHaveBeenCalledWith(0)
      expect(mockSearchUsers).toHaveBeenCalledWith('targetuser')
      expect(mockSendMessageToUser).toHaveBeenCalledWith('999', 'Hi there')
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output).toEqual({ id: 'msg-3', text: 'Sent to user' })
    })

    test('strips @ prefix from username', async () => {
      await expect(messageCommand.parseAsync(['send-to', '@targetuser', 'Hi there'], { from: 'user' })).rejects.toThrow(
        'process.exit called',
      )

      expect(mockSearchUsers).toHaveBeenCalledWith('targetuser')
    })

    test('handles user not found error', async () => {
      mockSearchUsers.mockImplementation(() => Promise.resolve([]))

      try {
        await messageCommand.parseAsync(['send-to', 'unknownuser', 'Hi'], { from: 'user' })
      } catch {
        /* empty */
      }

      expect(mockSendMessageToUser).not.toHaveBeenCalled()
    })
  })

  describe('search', () => {
    test('searches messages by query', async () => {
      await expect(messageCommand.parseAsync(['search', 'hello'], { from: 'user' })).rejects.toThrow(
        'process.exit called',
      )

      expect(processExitSpy).toHaveBeenCalledWith(0)
      expect(mockSearchMessages).toHaveBeenCalledWith('hello', { threadId: undefined, limit: 20 })
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output).toEqual([{ id: 'msg-4', text: 'Found' }])
    })

    test('passes thread option to search', async () => {
      await expect(
        messageCommand.parseAsync(['search', 'hello', '--thread', 'thread-456'], { from: 'user' }),
      ).rejects.toThrow('process.exit called')

      expect(mockSearchMessages).toHaveBeenCalledWith('hello', { threadId: 'thread-456', limit: 20 })
    })

    test('passes limit option to search', async () => {
      await expect(messageCommand.parseAsync(['search', 'hello2', '--limit', '5'], { from: 'user' })).rejects.toThrow(
        'process.exit called',
      )

      expect(mockSearchMessages).toHaveBeenCalledWith('hello2', { threadId: undefined, limit: 5 })
    })
  })

  describe('search-users', () => {
    test('searches users by query', async () => {
      await expect(messageCommand.parseAsync(['search-users', 'target'], { from: 'user' })).rejects.toThrow(
        'process.exit called',
      )

      expect(processExitSpy).toHaveBeenCalledWith(0)
      expect(mockSearchUsers).toHaveBeenCalledWith('target')
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output).toEqual([{ pk: '999', username: 'targetuser' }])
    })
  })
})
