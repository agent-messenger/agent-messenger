import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

const originalConsoleLog = console.log

const mockWithKakaoClient = mock(async (_options: unknown, fn: (client: unknown) => Promise<unknown>) => {
  return fn(mockClient)
})

const mockGetChats = mock(() =>
  Promise.resolve([
    { chat_id: 'chat-1', name: 'General', type: 'group', member_count: 5 },
    { chat_id: 'chat-2', name: 'Direct', type: 'direct', member_count: 2 },
  ]),
)

const mockClient = {
  getChats: mockGetChats,
}

mock.module('./shared', () => ({
  withKakaoClient: mockWithKakaoClient,
}))

import { chatCommand } from './chat'

describe('chat commands', () => {
  let consoleLogSpy: ReturnType<typeof mock>

  beforeEach(() => {
    mockWithKakaoClient.mockReset()
    mockGetChats.mockReset()

    mockWithKakaoClient.mockImplementation(async (_options: unknown, fn: (client: unknown) => Promise<unknown>) => {
      return fn(mockClient)
    })
    mockGetChats.mockImplementation(() =>
      Promise.resolve([
        { chat_id: 'chat-1', name: 'General', type: 'group', member_count: 5 },
        { chat_id: 'chat-2', name: 'Direct', type: 'direct', member_count: 2 },
      ]),
    )

    consoleLogSpy = mock((..._args: unknown[]) => {})
    console.log = consoleLogSpy
  })

  afterEach(() => {
    console.log = originalConsoleLog
  })

  describe('list', () => {
    test('lists chat rooms', async () => {
      await chatCommand.parseAsync(['list'], { from: 'user' })

      expect(mockGetChats).toHaveBeenCalled()
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output).toHaveLength(2)
      expect(output[0].chat_id).toBe('chat-1')
      expect(output[0].name).toBe('General')
    })

    test('passes --search option to getChats', async () => {
      await chatCommand.parseAsync(['list', '--search', 'General'], { from: 'user' })

      const call = mockGetChats.mock.calls[0][0] as { all?: boolean; search?: string }
      expect(call.search).toBe('General')
    })

    test('passes --all flag to getChats', async () => {
      await chatCommand.parseAsync(['list', '--all'], { from: 'user' })

      const call = mockGetChats.mock.calls[0][0] as { all?: boolean; search?: string }
      expect(call.all).toBe(true)
    })

    test('passes account option to withKakaoClient', async () => {
      await chatCommand.parseAsync(['list', '--account', 'my-account'], { from: 'user' })

      expect(mockWithKakaoClient).toHaveBeenCalledWith(
        expect.objectContaining({ account: 'my-account' }),
        expect.any(Function),
      )
    })

    test('outputs empty array when no chats', async () => {
      mockGetChats.mockImplementation(() => Promise.resolve([]))

      await chatCommand.parseAsync(['list'], { from: 'user' })

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output).toEqual([])
    })
  })
})
