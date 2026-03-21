import { afterEach, describe, expect, mock, test } from 'bun:test'

import { SlackListener } from '@/platforms/slack/listener'
import type { SlackRTMMessageEvent, SlackRTMReactionEvent } from '@/platforms/slack/types'

type WsHandler = (...args: any[]) => void

let mockWsInstance: MockWs

class MockWs {
  static OPEN = 1
  static CLOSED = 3
  readyState = MockWs.OPEN

  private handlers = new Map<string, WsHandler[]>()
  sent: string[] = []

  constructor(_url: string, _options?: any) {
    mockWsInstance = this
  }

  on(event: string, handler: WsHandler) {
    const list = this.handlers.get(event) ?? []
    list.push(handler)
    this.handlers.set(event, list)
  }

  send(data: string) {
    this.sent.push(data)
  }

  close() {
    this.readyState = MockWs.CLOSED
    setTimeout(() => this.emit('close'), 0)
  }

  emit(event: string, ...args: any[]) {
    for (const handler of this.handlers.get(event) ?? []) {
      handler(...args)
    }
  }

  simulateOpen() {
    this.emit('open')
  }

  simulateMessage(data: Record<string, unknown>) {
    this.emit('message', Buffer.from(JSON.stringify(data)))
  }

  simulateClose() {
    this.readyState = MockWs.CLOSED
    this.emit('close')
  }
}

mock.module('ws', () => ({ default: MockWs, __esModule: true }))

function createMockClient(overrides: Record<string, any> = {}) {
  return {
    rtmConnect: mock(() =>
      Promise.resolve({
        url: 'wss://fake.slack.com/ws',
        cookie: 'fake-cookie',
        self: { id: 'U_SELF' },
        team: { id: 'T_TEAM' },
      }),
    ),
    ...overrides,
  } as any
}

describe('SlackListener', () => {
  let listener: SlackListener

  afterEach(() => {
    listener?.stop()
  })

  describe('start', () => {
    test('calls rtmConnect and opens WebSocket', async () => {
      const client = createMockClient()
      listener = new SlackListener(client)

      await listener.start()
      mockWsInstance.simulateOpen()

      expect(client.rtmConnect).toHaveBeenCalledTimes(1)
    })

    test('is idempotent', async () => {
      const client = createMockClient()
      listener = new SlackListener(client)

      await listener.start()
      await listener.start()

      expect(client.rtmConnect).toHaveBeenCalledTimes(1)
    })
  })

  describe('connected event', () => {
    test('emits connected with self/team on hello', async () => {
      const client = createMockClient()
      listener = new SlackListener(client)

      const connected: any[] = []
      listener.on('connected', (info) => connected.push(info))

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateMessage({ type: 'hello' })

      expect(connected.length).toBe(1)
      expect(connected[0].self.id).toBe('U_SELF')
      expect(connected[0].team.id).toBe('T_TEAM')
    })
  })

  describe('message events', () => {
    test('emits message events', async () => {
      const client = createMockClient()
      listener = new SlackListener(client)

      const messages: SlackRTMMessageEvent[] = []
      listener.on('message', (event) => messages.push(event))

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateMessage({ type: 'hello' })
      mockWsInstance.simulateMessage({
        type: 'message',
        channel: 'C123',
        user: 'U456',
        text: 'hello world',
        ts: '123.456',
      })

      expect(messages.length).toBe(1)
      expect(messages[0].type).toBe('message')
      expect(messages[0].channel).toBe('C123')
      expect(messages[0].text).toBe('hello world')
    })
  })

  describe('reaction events', () => {
    test('emits reaction_added events', async () => {
      const client = createMockClient()
      listener = new SlackListener(client)

      const reactions: SlackRTMReactionEvent[] = []
      listener.on('reaction_added', (event) => reactions.push(event))

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateMessage({
        type: 'reaction_added',
        user: 'U789',
        reaction: 'thumbsup',
        item: { type: 'message', channel: 'C123', ts: '100.001' },
        event_ts: '200.001',
      })

      expect(reactions.length).toBe(1)
      expect(reactions[0].reaction).toBe('thumbsup')
    })
  })

  describe('slack_event catch-all', () => {
    test('emits slack_event for every non-hello event', async () => {
      const client = createMockClient()
      listener = new SlackListener(client)

      const events: any[] = []
      listener.on('slack_event', (event) => events.push(event))

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateMessage({ type: 'hello' })
      mockWsInstance.simulateMessage({ type: 'message', text: 'hi', channel: 'C1', ts: '1' })
      mockWsInstance.simulateMessage({ type: 'user_typing', channel: 'C1', user: 'U1' })

      expect(events.length).toBe(2)
      expect(events[0].type).toBe('message')
      expect(events[1].type).toBe('user_typing')
    })
  })

  describe('ping/pong', () => {
    test('does not treat pong reply as an event', async () => {
      const client = createMockClient()
      listener = new SlackListener(client)

      const events: any[] = []
      listener.on('slack_event', (event) => events.push(event))

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateMessage({ type: 'hello' })
      mockWsInstance.simulateMessage({ reply_to: 1, type: 'pong' })

      expect(events.length).toBe(0)
    })
  })

  describe('stop', () => {
    test('closes WebSocket and prevents reconnection', async () => {
      const client = createMockClient()
      listener = new SlackListener(client)

      await listener.start()
      mockWsInstance.simulateOpen()

      listener.stop()

      await new Promise((r) => setTimeout(r, 50))
      expect(client.rtmConnect).toHaveBeenCalledTimes(1)
    })
  })

  describe('reconnection', () => {
    test('reconnects on WebSocket close when still running', async () => {
      const client = createMockClient()
      listener = new SlackListener(client)

      const disconnected: boolean[] = []
      listener.on('disconnected', () => disconnected.push(true))

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateClose()

      expect(disconnected.length).toBe(1)

      await new Promise((r) => setTimeout(r, 1500))
      expect(client.rtmConnect.mock.calls.length).toBeGreaterThanOrEqual(2)
    })

    test('emits error and reconnects on rtmConnect failure', async () => {
      let callCount = 0
      const client = createMockClient({
        rtmConnect: mock(() => {
          callCount++
          if (callCount === 1) return Promise.reject(new Error('network_error'))
          return Promise.resolve({
            url: 'wss://fake.slack.com/ws',
            cookie: 'fake-cookie',
            self: { id: 'U_SELF' },
            team: { id: 'T_TEAM' },
          })
        }),
      })

      listener = new SlackListener(client)

      const errors: Error[] = []
      listener.on('error', (err) => errors.push(err))

      await listener.start()

      await new Promise((r) => setTimeout(r, 1500))

      expect(errors.length).toBe(1)
      expect(errors[0].message).toBe('network_error')
      expect(client.rtmConnect.mock.calls.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('on/off/once', () => {
    test('off removes listener', async () => {
      const client = createMockClient()
      listener = new SlackListener(client)

      const messages: any[] = []
      const handler = (event: any) => messages.push(event)
      listener.on('message', handler)

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateMessage({ type: 'message', text: 'a', channel: 'C1', ts: '1' })

      listener.off('message', handler)
      mockWsInstance.simulateMessage({ type: 'message', text: 'b', channel: 'C1', ts: '2' })

      expect(messages.length).toBe(1)
      expect(messages[0].text).toBe('a')
    })

    test('once fires only once', async () => {
      const client = createMockClient()
      listener = new SlackListener(client)

      const messages: any[] = []
      listener.once('message', (event) => messages.push(event))

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateMessage({ type: 'message', text: 'first', channel: 'C1', ts: '1' })
      mockWsInstance.simulateMessage({ type: 'message', text: 'second', channel: 'C1', ts: '2' })

      expect(messages.length).toBe(1)
      expect(messages[0].text).toBe('first')
    })
  })
})
