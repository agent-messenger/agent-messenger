import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'

const originalConsoleLog = console.log
import type { Command } from 'commander'

const mockListChats = mock(() =>
  Promise.resolve([
    { id: 'thread-1', title: 'Alice', last_message: 'Hi' },
    { id: 'thread-2', title: 'Bob', last_message: 'Hey' },
  ]),
)

const mockSearchChats = mock(() =>
  Promise.resolve([{ id: 'thread-1', title: 'Alice', last_message: 'Hi' }]),
)

const mockClient = {
  listChats: mockListChats,
  searchChats: mockSearchChats,
}

mock.module('./shared', () => ({
  withInstagramClient: async (_options: unknown, fn: (client: typeof mockClient) => Promise<unknown>) => {
    return fn(mockClient)
  },
}))

import { chatCommand } from './chat'

function resetCommandState(cmd: Command): void {
  for (const sub of cmd.commands) {
    (sub as unknown as { _optionValues: Record<string, unknown>; _optionValueSources: Record<string, unknown> })._optionValues = {}
    ;(sub as unknown as { _optionValues: Record<string, unknown>; _optionValueSources: Record<string, unknown> })._optionValueSources = {}
  }
}

describe('chat commands', () => {
  let consoleLogSpy: ReturnType<typeof mock>
  let processExitSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    resetCommandState(chatCommand)

    mockListChats.mockReset()
    mockSearchChats.mockReset()

    mockListChats.mockImplementation(() =>
      Promise.resolve([
        { id: 'thread-1', title: 'Alice', last_message: 'Hi' },
        { id: 'thread-2', title: 'Bob', last_message: 'Hey' },
      ]),
    )
    mockSearchChats.mockImplementation(() =>
      Promise.resolve([{ id: 'thread-1', title: 'Alice', last_message: 'Hi' }]),
    )

    consoleLogSpy = mock((..._args: unknown[]) => {}); console.log = consoleLogSpy
    processExitSpy = spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called')
    })
  })

  afterEach(() => {
    console.log = originalConsoleLog
    processExitSpy.mockRestore()
  })

  describe('list', () => {
    test('lists DM conversations', async () => {
      await expect(
        chatCommand.parseAsync(['list'], { from: 'user' }),
      ).rejects.toThrow('process.exit called')

      expect(processExitSpy).toHaveBeenCalledWith(0)
      expect(mockListChats).toHaveBeenCalledWith(20)
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output).toHaveLength(2)
      expect(output[0].id).toBe('thread-1')
      expect(output[1].id).toBe('thread-2')
    })

    test('passes custom limit', async () => {
      await expect(
        chatCommand.parseAsync(['list', '--limit', '5'], { from: 'user' }),
      ).rejects.toThrow('process.exit called')

      expect(mockListChats).toHaveBeenCalledWith(5)
    })
  })

  describe('search', () => {
    test('searches DM conversations by query', async () => {
      await expect(
        chatCommand.parseAsync(['search', 'Alice'], { from: 'user' }),
      ).rejects.toThrow('process.exit called')

      expect(processExitSpy).toHaveBeenCalledWith(0)
      expect(mockSearchChats).toHaveBeenCalledWith('Alice', 20)
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output).toHaveLength(1)
      expect(output[0].id).toBe('thread-1')
    })

    test('passes custom limit to search', async () => {
      await expect(
        chatCommand.parseAsync(['search', 'Alice', '--limit', '10'], { from: 'user' }),
      ).rejects.toThrow('process.exit called')

      expect(mockSearchChats).toHaveBeenCalledWith('Alice', 10)
    })

    test('returns empty array when no results', async () => {
      mockSearchChats.mockImplementation(() => Promise.resolve([]))

      await expect(
        chatCommand.parseAsync(['search', 'nobody'], { from: 'user' }),
      ).rejects.toThrow('process.exit called')

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output).toEqual([])
    })
  })
})
