import { afterEach, describe, expect, mock, it } from 'bun:test'

import type { LineRawEvent } from '@/platforms/line/client'
import { LineListener } from '@/platforms/line/listener'
import type { LinePushGenericEvent, LinePushMessageEvent } from '@/platforms/line/types'

const mockGetProfile = mock(() => Promise.resolve({ mid: 'u123', display_name: 'Test User' }))

let mockInternalClientInstance: MockEventSource

class MockEventSource {
  private queue: LineRawEvent[] = []
  private resolveNext: ((value: IteratorResult<LineRawEvent>) => void) | null = null
  private streamError: Error | null = null
  private done = false

  async *streamEvents(signal: AbortSignal): AsyncGenerator<LineRawEvent, void, unknown> {
    signal.addEventListener('abort', () => {
      const err = new Error('The operation was aborted')
      err.name = 'AbortError'
      this.fail(err)
    })

    while (!this.done) {
      if (this.streamError) {
        const err = this.streamError
        this.streamError = null
        throw err
      }
      if (this.queue.length > 0) {
        yield this.queue.shift()!
        continue
      }
      const next = await new Promise<IteratorResult<LineRawEvent>>((resolve) => {
        this.resolveNext = resolve
      })
      if (next.done) return
      if (this.streamError) {
        const err = this.streamError
        this.streamError = null
        throw err
      }
      yield next.value
    }
  }

  private push(event: LineRawEvent): void {
    if (this.resolveNext) {
      const resolve = this.resolveNext
      this.resolveNext = null
      resolve({ value: event, done: false })
    } else {
      this.queue.push(event)
    }
  }

  private fail(error: Error): void {
    this.streamError = error
    if (this.resolveNext) {
      const resolve = this.resolveNext
      this.resolveNext = null
      resolve({ value: undefined as never, done: false })
    }
  }

  simulateMessage(message: unknown): void {
    this.push({ kind: 'message', message: message as never })
  }

  simulateEvent(op: unknown): void {
    this.push({ kind: 'event', op: op as never })
  }

  simulateListenError(error: Error): void {
    this.fail(error)
  }
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

const mockLogin = mock((): Promise<void> => {
  mockInternalClientInstance = new MockEventSource()
  return Promise.resolve()
})

function createMockLineClient() {
  return {
    login: mockLogin,
    getProfile: mockGetProfile,
    streamEvents: (signal: AbortSignal) => mockInternalClientInstance.streamEvents(signal),
  } as any
}

describe('LineListener', () => {
  let listener: LineListener

  afterEach(() => {
    listener?.stop()
    mockLogin.mockReset()
    mockLogin.mockImplementation((): Promise<void> => {
      mockInternalClientInstance = new MockEventSource()
      return Promise.resolve()
    })
    mockGetProfile.mockReset()
    mockGetProfile.mockResolvedValue({ mid: 'u123', display_name: 'Test User' })
  })

  describe('start', () => {
    it('calls login on LineClient', async () => {
      const client = createMockLineClient()
      listener = new LineListener(client)

      await listener.start()

      expect(mockLogin).toHaveBeenCalledTimes(1)
    })

    it('is idempotent', async () => {
      const client = createMockLineClient()
      listener = new LineListener(client)

      await listener.start()
      await listener.start()

      expect(mockLogin).toHaveBeenCalledTimes(1)
    })
  })

  describe('connected event', () => {
    it('emits connected with account_id after successful login', async () => {
      const client = createMockLineClient()
      listener = new LineListener(client)

      const connected: Array<{ account_id: string }> = []
      listener.on('connected', (info) => connected.push(info))

      await listener.start()

      expect(connected.length).toBe(1)
      expect(connected[0].account_id).toBe('u123')
    })
  })

  describe('message events', () => {
    it('emits message with parsed fields on incoming message', async () => {
      const client = createMockLineClient()
      listener = new LineListener(client)

      const messages: LinePushMessageEvent[] = []
      listener.on('message', (event) => messages.push(event))

      await listener.start()
      mockInternalClientInstance.simulateMessage({
        isMyMessage: false,
        from: { type: 'USER', id: 'u456' },
        to: { type: 'USER', id: 'u123' },
        text: 'hello world',
        raw: {
          id: 'msg001',
          contentType: 'NONE',
          createdTime: 1700000000000,
        },
      })
      await flush()

      expect(messages.length).toBe(1)
      expect(messages[0].type).toBe('message')
      expect(messages[0].chat_id).toBe('u456')
      expect(messages[0].message_id).toBe('msg001')
      expect(messages[0].author_id).toBe('u456')
      expect(messages[0].text).toBe('hello world')
      expect(messages[0].content_type).toBe('NONE')
      expect(messages[0].content_metadata).toEqual({})
    })

    it('forwards contentMetadata for non-text messages', async () => {
      const client = createMockLineClient()
      listener = new LineListener(client)

      const messages: LinePushMessageEvent[] = []
      listener.on('message', (event) => messages.push(event))

      await listener.start()
      mockInternalClientInstance.simulateMessage({
        isMyMessage: false,
        from: { type: 'USER', id: 'u456' },
        to: { type: 'USER', id: 'u123' },
        text: null,
        raw: {
          id: 'msg010',
          contentType: 'STICKER',
          createdTime: 1700000007000,
          contentMetadata: { STKID: '123', STKPKGID: '456', STKVER: '1' },
        },
      })
      await flush()

      expect(messages.length).toBe(1)
      expect(messages[0].text).toBeNull()
      expect(messages[0].content_type).toBe('STICKER')
      expect(messages[0].content_metadata).toEqual({ STKID: '123', STKPKGID: '456', STKVER: '1' })
    })

    it('forwards reply_to_message_id for quoted replies', async () => {
      const client = createMockLineClient()
      listener = new LineListener(client)

      const messages: LinePushMessageEvent[] = []
      listener.on('message', (event) => messages.push(event))

      await listener.start()
      mockInternalClientInstance.simulateMessage({
        isMyMessage: false,
        from: { type: 'USER', id: 'u456' },
        to: { type: 'USER', id: 'u123' },
        text: 'sure',
        raw: {
          id: 'msg020',
          contentType: 'NONE',
          createdTime: 1700000008000,
          relatedMessageId: 'msg019',
          messageRelationType: 'REPLY',
        },
      })
      await flush()

      expect(messages[0].reply_to_message_id).toBe('msg019')
    })

    it('falls back to raw text when text is empty for contentType NONE messages', async () => {
      const client = createMockLineClient()
      listener = new LineListener(client)

      const messages: LinePushMessageEvent[] = []
      listener.on('message', (event) => messages.push(event))

      await listener.start()
      mockInternalClientInstance.simulateMessage({
        isMyMessage: false,
        from: { type: 'USER', id: 'u456' },
        to: { type: 'USER', id: 'u123' },
        text: '',
        raw: {
          id: 'msg012',
          contentType: 'NONE',
          text: 'actual text from raw',
          createdTime: 1700000009000,
        },
      })
      await flush()

      expect(messages.length).toBe(1)
      expect(messages[0].text).toBe('actual text from raw')
      expect(messages[0].content_type).toBe('NONE')
    })

    it('forwards LINE decryption errors on message events', async () => {
      const client = createMockLineClient()
      listener = new LineListener(client)

      const messages: LinePushMessageEvent[] = []
      listener.on('message', (event) => messages.push(event))

      await listener.start()
      mockInternalClientInstance.simulateMessage({
        isMyMessage: false,
        from: { type: 'USER', id: 'u456' },
        to: { type: 'USER', id: 'u123' },
        text: null,
        decryption_error: {
          code: 'missing_e2ee_key',
          message: 'LINE message is encrypted with Letter Sealing, but this session has no saved E2EE key material.',
        },
        raw: {
          id: 'msg013',
          contentType: 'NONE',
          createdTime: 1700000010000,
          chunks: ['a', 'b'],
          metadata: { e2eeMark: '2', e2eeVersion: '2' },
        },
      })
      await flush()

      expect(messages.length).toBe(1)
      expect(messages[0].text).toBeNull()
      expect(messages[0].decryption_error?.code).toBe('missing_e2ee_key')
    })

    it('coerces non-string contentMetadata values to strings', async () => {
      const client = createMockLineClient()
      listener = new LineListener(client)

      const messages: LinePushMessageEvent[] = []
      listener.on('message', (event) => messages.push(event))

      await listener.start()
      mockInternalClientInstance.simulateMessage({
        isMyMessage: false,
        from: { type: 'USER', id: 'u456' },
        to: { type: 'USER', id: 'u123' },
        text: null,
        raw: {
          id: 'msg011',
          contentType: 'IMAGE',
          createdTime: 1700000008000,
          contentMetadata: { FILE_SIZE: 2048, PREVIEW_URL: 'https://example.com/p.jpg', EMPTY: null },
        },
      })
      await flush()

      expect(messages.length).toBe(1)
      expect(messages[0].content_metadata).toEqual({
        FILE_SIZE: '2048',
        PREVIEW_URL: 'https://example.com/p.jpg',
      })
    })

    it('uses to.id as chat_id for own messages', async () => {
      const client = createMockLineClient()
      listener = new LineListener(client)

      const messages: LinePushMessageEvent[] = []
      listener.on('message', (event) => messages.push(event))

      await listener.start()
      mockInternalClientInstance.simulateMessage({
        isMyMessage: true,
        from: { type: 'USER', id: 'u123' },
        to: { type: 'USER', id: 'u456' },
        text: 'sent by me',
        raw: { id: 'msg002', contentType: 'NONE', createdTime: 1700000001000 },
      })
      await flush()

      expect(messages.length).toBe(1)
      expect(messages[0].chat_id).toBe('u456')
    })
  })

  describe('line_event catch-all', () => {
    it('emits line_event for every message', async () => {
      const client = createMockLineClient()
      listener = new LineListener(client)

      const events: LinePushGenericEvent[] = []
      listener.on('line_event', (event) => events.push(event))

      await listener.start()
      mockInternalClientInstance.simulateMessage({
        isMyMessage: false,
        from: { type: 'USER', id: 'u456' },
        to: { type: 'USER', id: 'u123' },
        text: 'hi',
        raw: { id: 'msg003', contentType: 'NONE', createdTime: 1700000002000 },
      })
      await flush()

      expect(events.length).toBe(1)
      expect(events[0].type).toBe('message')
    })

    it('emits line_event for raw operation events', async () => {
      const client = createMockLineClient()
      listener = new LineListener(client)

      const events: LinePushGenericEvent[] = []
      listener.on('line_event', (event) => events.push(event))

      await listener.start()
      mockInternalClientInstance.simulateEvent({ type: 'NOTIFIED_READ_MESSAGE', revision: 42 })
      await flush()

      expect(events.length).toBe(1)
      expect(events[0].type).toBe('NOTIFIED_READ_MESSAGE')
      expect(events[0].revision).toBe('42')
    })
  })

  describe('stop', () => {
    it('aborts and prevents reconnection', async () => {
      const client = createMockLineClient()
      listener = new LineListener(client)

      await listener.start()
      listener.stop()

      await new Promise((r) => setTimeout(r, 50))
      expect(mockLogin).toHaveBeenCalledTimes(1)
    })
  })

  describe('reconnection', () => {
    it('reconnects on listen error when still running', async () => {
      const client = createMockLineClient()
      listener = new LineListener(client)

      const disconnected: boolean[] = []
      listener.on('disconnected', () => disconnected.push(true))

      await listener.start()
      const firstInstance = mockInternalClientInstance
      firstInstance.simulateListenError(new Error('connection_dropped'))

      await new Promise((r) => setTimeout(r, 50))
      expect(disconnected.length).toBe(1)

      await new Promise((r) => setTimeout(r, 1500))
      expect(mockLogin.mock.calls.length).toBeGreaterThanOrEqual(2)
    })

    it('emits error and reconnects on login failure', async () => {
      let callCount = 0
      mockLogin.mockImplementation((): Promise<void> => {
        callCount++
        if (callCount === 1) return Promise.reject(new Error('network_error'))
        mockInternalClientInstance = new MockEventSource()
        return Promise.resolve()
      })

      const client = createMockLineClient()
      listener = new LineListener(client)

      const errors: Error[] = []
      listener.on('error', (err) => errors.push(err))

      await listener.start()

      await new Promise((r) => setTimeout(r, 1500))

      expect(errors.length).toBe(1)
      expect(errors[0].message).toBe('network_error')
      expect(mockLogin.mock.calls.length).toBeGreaterThanOrEqual(2)
    })

    it('does not reconnect after stop', async () => {
      const client = createMockLineClient()
      listener = new LineListener(client)

      await listener.start()
      listener.stop()

      mockInternalClientInstance.simulateListenError(new Error('late_error'))

      await new Promise((r) => setTimeout(r, 50))
      expect(mockLogin).toHaveBeenCalledTimes(1)
    })
  })

  describe('on/off/once', () => {
    it('off removes listener', async () => {
      const client = createMockLineClient()
      listener = new LineListener(client)

      const messages: LinePushMessageEvent[] = []
      const handler = (event: LinePushMessageEvent) => messages.push(event)
      listener.on('message', handler)

      await listener.start()
      mockInternalClientInstance.simulateMessage({
        isMyMessage: false,
        from: { type: 'USER', id: 'u456' },
        to: { type: 'USER', id: 'u123' },
        text: 'first',
        raw: { id: 'msg004', contentType: 'NONE', createdTime: 1700000003000 },
      })
      await flush()

      listener.off('message', handler)
      mockInternalClientInstance.simulateMessage({
        isMyMessage: false,
        from: { type: 'USER', id: 'u456' },
        to: { type: 'USER', id: 'u123' },
        text: 'second',
        raw: { id: 'msg005', contentType: 'NONE', createdTime: 1700000004000 },
      })
      await flush()

      expect(messages.length).toBe(1)
      expect(messages[0].text).toBe('first')
    })

    it('once fires only once', async () => {
      const client = createMockLineClient()
      listener = new LineListener(client)

      const messages: LinePushMessageEvent[] = []
      listener.once('message', (event) => messages.push(event))

      await listener.start()
      mockInternalClientInstance.simulateMessage({
        isMyMessage: false,
        from: { type: 'USER', id: 'u456' },
        to: { type: 'USER', id: 'u123' },
        text: 'first',
        raw: { id: 'msg006', contentType: 'NONE', createdTime: 1700000005000 },
      })
      mockInternalClientInstance.simulateMessage({
        isMyMessage: false,
        from: { type: 'USER', id: 'u456' },
        to: { type: 'USER', id: 'u123' },
        text: 'second',
        raw: { id: 'msg007', contentType: 'NONE', createdTime: 1700000006000 },
      })
      await flush()

      expect(messages.length).toBe(1)
      expect(messages[0].text).toBe('first')
    })
  })

  describe('start after stop', () => {
    it('resets reconnect attempts on fresh start', async () => {
      const client = createMockLineClient()
      listener = new LineListener(client)

      await listener.start()
      ;(listener as any).reconnectAttempts = 5
      listener.stop()

      await listener.start()
      expect((listener as any).reconnectAttempts).toBe(0)
    })
  })

  describe('event source consumption', () => {
    it('consumes streamEvents and stops pumping after abort', async () => {
      const streamCalls: AbortSignal[] = []
      const client = {
        login: mockLogin,
        getProfile: mockGetProfile,
        streamEvents: (signal: AbortSignal) => {
          streamCalls.push(signal)
          return mockInternalClientInstance.streamEvents(signal)
        },
      } as any
      listener = new LineListener(client)

      const messages: LinePushMessageEvent[] = []
      listener.on('message', (event) => messages.push(event))

      await listener.start()
      expect(streamCalls.length).toBe(1)

      listener.stop()
      mockInternalClientInstance.simulateMessage({
        isMyMessage: false,
        from: { type: 'USER', id: 'u456' },
        to: { type: 'USER', id: 'u123' },
        text: 'after stop',
        raw: { id: 'msg100', contentType: 'NONE', createdTime: 1700000010000 },
      })
      await flush()

      expect(messages.length).toBe(0)
    })
  })
})
