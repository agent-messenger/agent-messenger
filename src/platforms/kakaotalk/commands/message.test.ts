import { afterEach, beforeEach, describe, expect, mock, it } from 'bun:test'

const originalConsoleLog = console.log

const mockWithKakaoClient = mock(async (_options: unknown, fn: (client: unknown) => Promise<unknown>) => {
  return fn(mockClient)
})

const mockGetMessages = mock(() =>
  Promise.resolve([{ log_id: '1', message: 'Hello', sender_id: 'user-1', created_at: 1000 }]),
)

const mockSendMessage = mock(() => Promise.resolve({ log_id: '2', message: 'Hi there', created_at: 2000 }))

const mockMarkRead = mock(() =>
  Promise.resolve({ success: true, status_code: 0, chat_id: 'chat-123', watermark: '42' }),
)

const mockGetMembersByIds = mock((_chatId: string, _ids: string[]) =>
  Promise.resolve([{ user_id: '7467363552057858123', nickname: 'Alice' }]),
)

const originalExit = process.exit

const mockClient = {
  getMessages: mockGetMessages,
  sendMessage: mockSendMessage,
  markRead: mockMarkRead,
  getMembersByIds: mockGetMembersByIds,
}

mock.module('./shared', () => ({
  withKakaoClient: mockWithKakaoClient,
}))

import { messageCommand } from './message'

describe('message commands', () => {
  let consoleLogSpy: ReturnType<typeof mock>

  beforeEach(() => {
    mockWithKakaoClient.mockReset()
    mockGetMessages.mockReset()
    mockSendMessage.mockReset()
    mockMarkRead.mockReset()
    mockGetMembersByIds.mockReset()

    mockWithKakaoClient.mockImplementation(async (_options: unknown, fn: (client: unknown) => Promise<unknown>) => {
      return fn(mockClient)
    })
    mockGetMessages.mockImplementation(() =>
      Promise.resolve([{ log_id: '1', message: 'Hello', sender_id: 'user-1', created_at: 1000 }]),
    )
    mockSendMessage.mockImplementation(() => Promise.resolve({ log_id: '2', message: 'Hi there', created_at: 2000 }))
    mockMarkRead.mockImplementation(() =>
      Promise.resolve({ success: true, status_code: 0, chat_id: 'chat-123', watermark: '42' }),
    )
    mockGetMembersByIds.mockImplementation(() =>
      Promise.resolve([{ user_id: '7467363552057858123', nickname: 'Alice' }]),
    )

    consoleLogSpy = mock((..._args: unknown[]) => {})
    console.log = consoleLogSpy
  })

  afterEach(() => {
    console.log = originalConsoleLog
    process.exit = originalExit
  })

  describe('list', () => {
    it('fetches messages for a chat room with default count', async () => {
      await messageCommand.parseAsync(['list', 'chat-123', '--count', '20'], { from: 'user' })

      expect(mockGetMessages).toHaveBeenCalledWith('chat-123', { count: 20, from: undefined })
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output).toHaveLength(1)
      expect(output[0].log_id).toBe('1')
      expect(output[0].message).toBe('Hello')
    })

    it('respects --count option', async () => {
      await messageCommand.parseAsync(['list', 'chat-123', '--count', '5'], { from: 'user' })

      expect(mockGetMessages).toHaveBeenCalledWith('chat-123', { count: 5, from: undefined })
    })

    it('respects --from option', async () => {
      await messageCommand.parseAsync(['list', 'chat-123', '--count', '20', '--from', '999'], { from: 'user' })

      expect(mockGetMessages).toHaveBeenCalledWith('chat-123', { count: 20, from: '999' })
    })

    it('passes account option to withKakaoClient', async () => {
      await messageCommand.parseAsync(['list', 'chat-123', '--count', '20', '--account', 'my-account'], {
        from: 'user',
      })

      expect(mockWithKakaoClient).toHaveBeenCalledWith(
        expect.objectContaining({ account: 'my-account' }),
        expect.any(Function),
      )
    })
  })

  describe('send', () => {
    it('sends a message to a chat room', async () => {
      await messageCommand.parseAsync(['send', 'chat-123', 'Hello world'], { from: 'user' })

      expect(mockSendMessage).toHaveBeenCalledWith('chat-123', 'Hello world')
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output.log_id).toBe('2')
      expect(output.message).toBe('Hi there')
    })

    it('passes account option to withKakaoClient', async () => {
      await messageCommand.parseAsync(['send', 'chat-123', 'Hi', '--account', 'my-account'], { from: 'user' })

      expect(mockWithKakaoClient).toHaveBeenCalledWith(
        expect.objectContaining({ account: 'my-account' }),
        expect.any(Function),
      )
    })

    it('resolves --reply-to from chat history and sends a quoted reply', async () => {
      // given
      mockGetMessages.mockImplementation(() =>
        Promise.resolve([
          { log_id: '10', type: 1, author_id: 5, author_name: null, message: 'earlier', attachment: null, sent_at: 1 },
          { log_id: '42', type: 2, author_id: 7, author_name: null, message: 'target', attachment: null, sent_at: 2 },
        ]),
      )

      // when
      await messageCommand.parseAsync(['send', 'chat-123', 'replying', '--reply-to', '42'], { from: 'user' })

      // then
      expect(mockGetMessages).toHaveBeenCalledWith('chat-123', { count: 100 })
      expect(mockSendMessage).toHaveBeenCalledWith('chat-123', 'replying', {
        replyTo: { log_id: '42', author_id: 7, message: 'target', type: 2 },
      })
    })

    it('errors when --reply-to log-id is not found in recent history', async () => {
      // given
      mockGetMessages.mockImplementation(() =>
        Promise.resolve([
          { log_id: '10', type: 1, author_id: 5, author_name: null, message: 'earlier', attachment: null, sent_at: 1 },
        ]),
      )
      const exitSpy = mock((_code?: number): never => {
        throw new Error('process.exit called')
      })
      process.exit = exitSpy as unknown as typeof process.exit

      // when / then
      try {
        await messageCommand.parseAsync(['send', 'chat-123', 'replying', '--reply-to', '999'], { from: 'user' })
      } catch {
        // process.exit stub throws to abort the action
      }

      expect(mockSendMessage).not.toHaveBeenCalled()
      expect(exitSpy).toHaveBeenCalled()
    })
  })

  describe('send --mention', () => {
    // Commander keeps parsed option values on the shared command instance, so a
    // repeatable option would accumulate across parseAsync calls without this.
    beforeEach(() => {
      for (const sub of messageCommand.commands) {
        const state = sub as unknown as {
          _optionValues: Record<string, unknown>
          _optionValueSources: Record<string, unknown>
        }
        state._optionValues = {}
        state._optionValueSources = {}
      }
    })

    function stubExit(): ReturnType<typeof mock> {
      const exitSpy = mock((_code?: number): never => {
        throw new Error('process.exit called')
      })
      process.exit = exitSpy as unknown as typeof process.exit
      return exitSpy
    }

    it('resolves a bare user id to the member nickname', async () => {
      await messageCommand.parseAsync(['send', 'chat-123', '@Alice hi', '--mention', '7467363552057858123'], {
        from: 'user',
      })

      expect(mockGetMembersByIds).toHaveBeenCalledWith('chat-123', ['7467363552057858123'])
      expect(mockSendMessage).toHaveBeenCalledWith('chat-123', '@Alice hi', {
        mentions: [{ user_id: '7467363552057858123', name: 'Alice' }],
      })
    })

    it('uses an explicit <user-id>:<name> without a member lookup and accepts repeats', async () => {
      await messageCommand.parseAsync(
        ['send', 'chat-123', '@Bob and @Carol: dinner?', '--mention', '1:Bob', '--mention', '2:Carol'],
        { from: 'user' },
      )

      expect(mockGetMembersByIds).not.toHaveBeenCalled()
      expect(mockSendMessage).toHaveBeenCalledWith('chat-123', '@Bob and @Carol: dinner?', {
        mentions: [
          { user_id: '1', name: 'Bob' },
          { user_id: '2', name: 'Carol' },
        ],
      })
    })

    it('combines with --reply-to', async () => {
      mockGetMessages.mockImplementation(() =>
        Promise.resolve([
          { log_id: '42', type: 1, author_id: 7, author_name: null, message: 'target', attachment: null, sent_at: 2 },
        ]),
      )

      await messageCommand.parseAsync(['send', 'chat-123', '@Bob ok', '--reply-to', '42', '--mention', '7:Bob'], {
        from: 'user',
      })

      expect(mockSendMessage).toHaveBeenCalledWith('chat-123', '@Bob ok', {
        replyTo: { log_id: '42', author_id: 7, message: 'target', type: 1 },
        mentions: [{ user_id: '7', name: 'Bob' }],
      })
    })

    it('errors without sending when the nickname cannot be resolved', async () => {
      mockGetMembersByIds.mockImplementation(() => Promise.resolve([]))
      const exitSpy = stubExit()

      try {
        await messageCommand.parseAsync(['send', 'chat-123', '@Alice hi', '--mention', '99'], { from: 'user' })
      } catch {
        // process.exit stub throws to abort the action
      }

      expect(mockSendMessage).not.toHaveBeenCalled()
      expect(exitSpy).toHaveBeenCalled()
    })

    it('errors without sending on a malformed --mention value', async () => {
      const exitSpy = stubExit()

      try {
        await messageCommand.parseAsync(['send', 'chat-123', '@Alice hi', '--mention', 'alice'], { from: 'user' })
      } catch {
        // process.exit stub throws to abort the action
      }

      expect(mockGetMembersByIds).not.toHaveBeenCalled()
      expect(mockSendMessage).not.toHaveBeenCalled()
      expect(exitSpy).toHaveBeenCalled()
    })
  })

  describe('mark-read', () => {
    it('calls markRead with chat-id and log-id, no opts for normal chat', async () => {
      await messageCommand.parseAsync(['mark-read', 'chat-123', '42'], { from: 'user' })

      expect(mockMarkRead).toHaveBeenCalledWith('chat-123', '42', undefined)
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output).toEqual({ success: true, status_code: 0, chat_id: 'chat-123', watermark: '42' })
    })

    it('forwards --link-id when provided (open chat)', async () => {
      await messageCommand.parseAsync(['mark-read', 'chat-123', '42', '--link-id', '77777'], { from: 'user' })

      expect(mockMarkRead).toHaveBeenCalledWith('chat-123', '42', { linkId: '77777' })
    })

    it('--pretty prints pretty-formatted JSON (consistent with list/send)', async () => {
      await messageCommand.parseAsync(['mark-read', 'chat-123', '42', '--pretty'], { from: 'user' })

      const printed = consoleLogSpy.mock.calls[0][0] as string
      expect(printed).toContain('\n')
      expect(JSON.parse(printed)).toEqual({
        success: true,
        status_code: 0,
        chat_id: 'chat-123',
        watermark: '42',
      })
    })

    it('exits non-zero when result.success is false (e.g. open chat missing --link-id)', async () => {
      const exitSpy = mock((_code?: number): never => {
        throw new Error('process.exit called')
      })
      process.exit = exitSpy as unknown as typeof process.exit
      mockMarkRead.mockImplementationOnce(() =>
        Promise.resolve({ success: false, status_code: -500, chat_id: 'chat-123', watermark: '42' }),
      )

      try {
        await messageCommand.parseAsync(['mark-read', 'chat-123', '42'], { from: 'user' })
      } catch {
        // process.exit stub throws to abort the action
      }

      expect(exitSpy).toHaveBeenCalledWith(1)
    })

    it('exits zero on success', async () => {
      const exitSpy = mock((_code?: number): never => {
        throw new Error('process.exit called')
      })
      process.exit = exitSpy as unknown as typeof process.exit

      await messageCommand.parseAsync(['mark-read', 'chat-123', '42'], { from: 'user' })

      expect(exitSpy).not.toHaveBeenCalled()
    })

    it('passes account option to withKakaoClient', async () => {
      await messageCommand.parseAsync(['mark-read', 'chat-123', '42', '--account', 'my-account'], { from: 'user' })

      expect(mockWithKakaoClient).toHaveBeenCalledWith(
        expect.objectContaining({ account: 'my-account' }),
        expect.any(Function),
      )
    })
  })
})
