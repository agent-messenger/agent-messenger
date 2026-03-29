import { afterEach, describe, expect, mock, test } from 'bun:test'

import { LineListener } from '@/platforms/line/listener'
import type { LinePushGenericEvent, LinePushMessageEvent } from '@/platforms/line/types'

const mockGetProfile = mock(() => Promise.resolve({ mid: 'u123', displayName: 'Test User' }))

let mockInternalClientInstance: MockInternalClient

class MockInternalClient {
  handlers: Record<string, ((...args: any[]) => void)[]> = {}
  private listenReject: ((e: Error) => void) | null = null

  on(event: string, handler: (...args: any[]) => void): void {
    if (!this.handlers[event]) this.handlers[event] = []
    this.handlers[event].push(handler)
  }

  listen(opts: { signal?: AbortSignal } = {}): Promise<void> {
    return new Promise((_resolve, reject) => {
      this.listenReject = reject
      opts.signal?.addEventListener('abort', () => {
        const err = new Error('The operation was aborted')
        err.name = 'AbortError'
        reject(err)
      })
    })
  }

  simulateMessage(msg: unknown): void {
    this.handlers['message']?.forEach((h) => h(msg))
  }

  simulateEvent(op: unknown): void {
    this.handlers['event']?.forEach((h) => h(op))
  }

  simulateListenError(error: Error): void {
    this.listenReject?.(error)
  }

  base = {
    talk: { getProfile: mockGetProfile },
  }
}

const mockLogin = mock((): Promise<void> => {
  mockInternalClientInstance = new MockInternalClient()
  return Promise.resolve()
})

function createMockLineClient() {
  return {
    login: mockLogin,
    get client() {
      return mockInternalClientInstance
    },
  } as any
}

describe('LineListener', () => {
  let listener: LineListener

  afterEach(() => {
    listener?.stop()
    mockLogin.mockReset()
    mockLogin.mockImplementation((): Promise<void> => {
      mockInternalClientInstance = new MockInternalClient()
      return Promise.resolve()
    })
    mockGetProfile.mockReset()
    mockGetProfile.mockResolvedValue({ mid: 'u123', displayName: 'Test User' })
  })

  describe('start', () => {
    test('calls login on LineClient', async () => {
      const client = createMockLineClient()
      listener = new LineListener(client)

      await listener.start()

      expect(mockLogin).toHaveBeenCalledTimes(1)
    })

    test('is idempotent', async () => {
      const client = createMockLineClient()
      listener = new LineListener(client)

      await listener.start()
      await listener.start()

      expect(mockLogin).toHaveBeenCalledTimes(1)
    })
  })

  describe('connected event', () => {
    test('emits connected with account_id after successful login', async () => {
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
    test('emits message with parsed fields on incoming message', async () => {
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

      expect(messages.length).toBe(1)
      expect(messages[0].type).toBe('message')
      expect(messages[0].chat_id).toBe('u456')
      expect(messages[0].message_id).toBe('msg001')
      expect(messages[0].author_id).toBe('u456')
      expect(messages[0].text).toBe('hello world')
      expect(messages[0].content_type).toBe('NONE')
    })

    test('uses to.id as chat_id for own messages', async () => {
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

      expect(messages.length).toBe(1)
      expect(messages[0].chat_id).toBe('u456')
    })
  })

  describe('line_event catch-all', () => {
    test('emits line_event for every message', async () => {
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

      expect(events.length).toBe(1)
      expect(events[0].type).toBe('message')
    })

    test('emits line_event for raw operation events', async () => {
      const client = createMockLineClient()
      listener = new LineListener(client)

      const events: LinePushGenericEvent[] = []
      listener.on('line_event', (event) => events.push(event))

      await listener.start()
      mockInternalClientInstance.simulateEvent({ type: 'NOTIFIED_READ_MESSAGE', revision: 42 })

      expect(events.length).toBe(1)
      expect(events[0].type).toBe('NOTIFIED_READ_MESSAGE')
      expect(events[0].revision).toBe('42')
    })
  })

  describe('stop', () => {
    test('aborts and prevents reconnection', async () => {
      const client = createMockLineClient()
      listener = new LineListener(client)

      await listener.start()
      listener.stop()

      await new Promise((r) => setTimeout(r, 50))
      expect(mockLogin).toHaveBeenCalledTimes(1)
    })
  })

  describe('reconnection', () => {
    test('reconnects on listen error when still running', async () => {
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

    test('emits error and reconnects on login failure', async () => {
      let callCount = 0
      mockLogin.mockImplementation((): Promise<void> => {
        callCount++
        if (callCount === 1) return Promise.reject(new Error('network_error'))
        mockInternalClientInstance = new MockInternalClient()
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

    test('does not reconnect after stop', async () => {
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
    test('off removes listener', async () => {
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

      listener.off('message', handler)
      mockInternalClientInstance.simulateMessage({
        isMyMessage: false,
        from: { type: 'USER', id: 'u456' },
        to: { type: 'USER', id: 'u123' },
        text: 'second',
        raw: { id: 'msg005', contentType: 'NONE', createdTime: 1700000004000 },
      })

      expect(messages.length).toBe(1)
      expect(messages[0].text).toBe('first')
    })

    test('once fires only once', async () => {
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

      expect(messages.length).toBe(1)
      expect(messages[0].text).toBe('first')
    })
  })

  describe('start after stop', () => {
    test('resets reconnect attempts on fresh start', async () => {
      const client = createMockLineClient()
      listener = new LineListener(client)

      await listener.start()
      ;(listener as any).reconnectAttempts = 5
      listener.stop()

      await listener.start()
      expect((listener as any).reconnectAttempts).toBe(0)
    })
  })
})
