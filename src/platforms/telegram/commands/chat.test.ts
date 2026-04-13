import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'

const mockListChats = mock(() =>
  Promise.resolve([
    { id: 'chat-1', title: 'General', type: 'supergroup', unread_count: 0 },
    { id: 'chat-2', title: 'Random', type: 'group', unread_count: 5 },
  ]),
)

const mockSearchChats = mock(() =>
  Promise.resolve([{ id: 'chat-1', title: 'General', type: 'supergroup', unread_count: 0 }]),
)

const mockGetChat = mock(() => Promise.resolve({ id: 'chat-1', title: 'General', type: 'supergroup', unread_count: 0 }))

const mockClient = {
  listChats: mockListChats,
  searchChats: mockSearchChats,
  getChat: mockGetChat,
}

mock.module('./shared', () => ({
  withTelegramClient: async (_opts: unknown, fn: (client: typeof mockClient) => Promise<unknown>) => fn(mockClient),
}))

import { chatCommand } from './chat'

describe('chat commands', () => {
  let consoleSpy: ReturnType<typeof spyOn>
  let processExitSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    mockListChats.mockReset()
    mockListChats.mockImplementation(() =>
      Promise.resolve([
        { id: 'chat-1', title: 'General', type: 'supergroup', unread_count: 0 },
        { id: 'chat-2', title: 'Random', type: 'group', unread_count: 5 },
      ]),
    )
    mockSearchChats.mockReset()
    mockSearchChats.mockImplementation(() =>
      Promise.resolve([{ id: 'chat-1', title: 'General', type: 'supergroup', unread_count: 0 }]),
    )
    mockGetChat.mockReset()
    mockGetChat.mockImplementation(() =>
      Promise.resolve({ id: 'chat-1', title: 'General', type: 'supergroup', unread_count: 0 }),
    )
    consoleSpy = spyOn(console, 'log').mockImplementation(() => {})
    processExitSpy = spyOn(process, 'exit').mockImplementation((() => {}) as (code?: number) => never)
  })

  afterEach(() => {
    consoleSpy.mockRestore()
    processExitSpy.mockRestore()
  })

  describe('list subcommand', () => {
    test('calls listChats with default limit', async () => {
      await chatCommand.parseAsync(['list'], { from: 'user' })

      expect(mockListChats).toHaveBeenCalledWith(20)
    })

    test('calls listChats with custom limit', async () => {
      await chatCommand.parseAsync(['list', '--limit', '5'], { from: 'user' })

      expect(mockListChats).toHaveBeenCalledWith(5)
    })

    test('outputs JSON array to console', async () => {
      await chatCommand.parseAsync(['list'], { from: 'user' })

      expect(consoleSpy).toHaveBeenCalled()
      const output = consoleSpy.mock.calls[0][0] as string
      const parsed = JSON.parse(output)
      expect(parsed).toBeArray()
      expect(parsed).toHaveLength(2)
    })
  })

  describe('search subcommand', () => {
    test('calls searchChats with query and default limit', async () => {
      await chatCommand.parseAsync(['search', 'General'], { from: 'user' })

      expect(mockSearchChats).toHaveBeenCalledWith('General', 20)
    })

    test('calls searchChats with query and custom limit', async () => {
      await chatCommand.parseAsync(['search', 'General', '--limit', '3'], { from: 'user' })

      expect(mockSearchChats).toHaveBeenCalledWith('General', 3)
    })

    test('outputs JSON array to console', async () => {
      await chatCommand.parseAsync(['search', 'General'], { from: 'user' })

      expect(consoleSpy).toHaveBeenCalled()
      const output = consoleSpy.mock.calls[0][0] as string
      const parsed = JSON.parse(output)
      expect(parsed).toBeArray()
      expect(parsed).toHaveLength(1)
    })
  })

  describe('get subcommand', () => {
    test('calls getChat with chat reference', async () => {
      await chatCommand.parseAsync(['get', 'chat-1'], { from: 'user' })

      expect(mockGetChat).toHaveBeenCalledWith('chat-1')
    })

    test('outputs JSON object to console', async () => {
      await chatCommand.parseAsync(['get', 'chat-1'], { from: 'user' })

      expect(consoleSpy).toHaveBeenCalled()
      const output = consoleSpy.mock.calls[0][0] as string
      const parsed = JSON.parse(output)
      expect(parsed).toBeObject()
      expect(parsed.id).toBe('chat-1')
    })
  })
})
