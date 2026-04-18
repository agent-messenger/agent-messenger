import { afterEach, beforeEach, describe, expect, mock, spyOn, it } from 'bun:test'

const mockListMessages = mock(() =>
  Promise.resolve([
    { id: 1, text: 'Hello', sender_id: 'user-1', date: 1000 },
    { id: 2, text: 'World', sender_id: 'user-2', date: 2000 },
  ]),
)

const mockSendMessage = mock(() => Promise.resolve({ id: 3, text: 'Sent message', sender_id: 'user-1', date: 3000 }))

const mockClient = {
  listMessages: mockListMessages,
  sendMessage: mockSendMessage,
}

mock.module('./shared', () => ({
  withTelegramClient: async (_opts: unknown, fn: (client: typeof mockClient) => Promise<unknown>) => fn(mockClient),
}))

import { messageCommand } from './message'

describe('message commands', () => {
  let consoleSpy: ReturnType<typeof spyOn>
  let processExitSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    mockListMessages.mockReset()
    mockListMessages.mockImplementation(() =>
      Promise.resolve([
        { id: 1, text: 'Hello', sender_id: 'user-1', date: 1000 },
        { id: 2, text: 'World', sender_id: 'user-2', date: 2000 },
      ]),
    )
    mockSendMessage.mockReset()
    mockSendMessage.mockImplementation(() =>
      Promise.resolve({ id: 3, text: 'Sent message', sender_id: 'user-1', date: 3000 }),
    )
    consoleSpy = spyOn(console, 'log').mockImplementation(() => {})
    processExitSpy = spyOn(process, 'exit').mockImplementation((() => {}) as (code?: number) => never)
  })

  afterEach(() => {
    consoleSpy.mockRestore()
    processExitSpy.mockRestore()
  })

  describe('list subcommand', () => {
    it('calls listMessages with chat reference and default limit', async () => {
      await messageCommand.parseAsync(['list', 'chat-123'], { from: 'user' })

      expect(mockListMessages).toHaveBeenCalledWith('chat-123', 20)
    })

    it('calls listMessages with custom limit', async () => {
      await messageCommand.parseAsync(['list', 'chat-123', '--limit', '10'], { from: 'user' })

      expect(mockListMessages).toHaveBeenCalledWith('chat-123', 10)
    })

    it('outputs JSON to console', async () => {
      await messageCommand.parseAsync(['list', 'chat-123'], { from: 'user' })

      expect(consoleSpy).toHaveBeenCalled()
      const output = consoleSpy.mock.calls[0][0] as string
      const parsed = JSON.parse(output)
      expect(parsed).toBeArray()
      expect(parsed).toHaveLength(2)
    })
  })

  describe('send subcommand', () => {
    it('calls sendMessage with chat reference and text', async () => {
      await messageCommand.parseAsync(['send', 'chat-123', 'Hello there'], { from: 'user' })

      expect(mockSendMessage).toHaveBeenCalledWith('chat-123', 'Hello there')
    })

    it('outputs JSON to console', async () => {
      await messageCommand.parseAsync(['send', 'chat-123', 'Hello there'], { from: 'user' })

      expect(consoleSpy).toHaveBeenCalled()
      const output = consoleSpy.mock.calls[0][0] as string
      const parsed = JSON.parse(output)
      expect(parsed).toBeObject()
      expect(parsed.id).toBe(3)
    })
  })
})
