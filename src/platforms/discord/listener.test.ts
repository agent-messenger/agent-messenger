import { afterEach, describe, expect, mock, test } from 'bun:test'

import { DiscordListener } from '@/platforms/discord/listener'
import type {
  DiscordGatewayGenericEvent,
  DiscordGatewayMessageCreateEvent,
  DiscordGatewayMessageDeleteEvent,
  DiscordGatewayMessageUpdateEvent,
  DiscordGatewayReactionEvent,
} from '@/platforms/discord/types'

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

  close(code?: number) {
    this.readyState = MockWs.CLOSED
    setTimeout(() => this.emit('close', code ?? 1000), 0)
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

  simulateClose(code?: number) {
    this.readyState = MockWs.CLOSED
    this.emit('close', code ?? 1000)
  }

  simulateHello(interval = 41250) {
    this.simulateMessage({ op: 10, d: { heartbeat_interval: interval } })
  }

  simulateReady(sessionId = 'session_123') {
    this.simulateMessage({
      op: 0,
      t: 'READY',
      s: 1,
      d: {
        session_id: sessionId,
        resume_gateway_url: 'wss://resume.discord.gg',
        user: { id: 'U_SELF', username: 'testbot' },
      },
    })
  }

  simulateDispatch(t: string, d: Record<string, unknown>, s: number) {
    this.simulateMessage({ op: 0, t, s, d })
  }

  simulateHeartbeatACK() {
    this.simulateMessage({ op: 11 })
  }

  simulateReconnect() {
    this.simulateMessage({ op: 7 })
  }

  simulateInvalidSession(resumable: boolean) {
    this.simulateMessage({ op: 9, d: resumable })
  }
}

mock.module('ws', () => ({ default: MockWs, __esModule: true }))

function createMockClient(overrides: Record<string, any> = {}) {
  return {
    gatewayConnect: mock(() => Promise.resolve({ token: 'fake-token' })),
    ...overrides,
  } as any
}

describe('DiscordListener', () => {
  let listener: DiscordListener

  afterEach(() => {
    listener?.stop()
  })

  describe('start', () => {
    test('calls gatewayConnect and opens WebSocket', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      await listener.start()
      mockWsInstance.simulateOpen()

      expect(client.gatewayConnect).toHaveBeenCalledTimes(1)
    })

    test('is idempotent', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      await listener.start()
      await listener.start()

      expect(client.gatewayConnect).toHaveBeenCalledTimes(1)
    })
  })

  describe('connected event', () => {
    test('emits connected with user/sessionId on READY', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      const connected: any[] = []
      listener.on('connected', (info) => connected.push(info))

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      mockWsInstance.simulateReady()

      expect(connected.length).toBe(1)
      expect(connected[0].user.id).toBe('U_SELF')
      expect(connected[0].sessionId).toBe('session_123')
    })
  })

  describe('identify', () => {
    test('sends Identify after Hello', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()

      const sentMessages = mockWsInstance.sent.map((s) => JSON.parse(s))
      const identifyMsg = sentMessages.find((m) => m.op === 2)

      expect(identifyMsg).toBeDefined()
      expect(identifyMsg.d.token).toBe('fake-token')
    })

    test('sends Identify with custom intents', async () => {
      const client = createMockClient()
      const customIntents = 1 << 9
      listener = new DiscordListener(client, { intents: customIntents })

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()

      const sentMessages = mockWsInstance.sent.map((s) => JSON.parse(s))
      const identifyMsg = sentMessages.find((m) => m.op === 2)

      expect(identifyMsg).toBeDefined()
      expect(identifyMsg.d.intents).toBe(customIntents)
    })
  })

  describe('message events', () => {
    test('emits message_create events', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      const messages: DiscordGatewayMessageCreateEvent[] = []
      listener.on('message_create', (event) => messages.push(event))

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      mockWsInstance.simulateReady()
      mockWsInstance.simulateDispatch(
        'MESSAGE_CREATE',
        {
          id: 'msg_1',
          channel_id: 'C123',
          author: { id: 'U456', username: 'user' },
          content: 'hello world',
          timestamp: '2024-01-01T00:00:00Z',
        },
        2,
      )

      expect(messages.length).toBe(1)
      expect(messages[0].content).toBe('hello world')
      expect(messages[0].channel_id).toBe('C123')
    })

    test('emits message_update events', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      const updates: DiscordGatewayMessageUpdateEvent[] = []
      listener.on('message_update', (event) => updates.push(event))

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      mockWsInstance.simulateReady()
      mockWsInstance.simulateDispatch(
        'MESSAGE_UPDATE',
        { id: 'msg_1', channel_id: 'C123', content: 'edited', edited_timestamp: '2024-01-01T00:01:00Z' },
        2,
      )

      expect(updates.length).toBe(1)
      expect(updates[0].id).toBe('msg_1')
      expect(updates[0].content).toBe('edited')
    })

    test('emits message_delete events', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      const deletes: DiscordGatewayMessageDeleteEvent[] = []
      listener.on('message_delete', (event) => deletes.push(event))

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      mockWsInstance.simulateReady()
      mockWsInstance.simulateDispatch('MESSAGE_DELETE', { id: 'msg_1', channel_id: 'C123' }, 2)

      expect(deletes.length).toBe(1)
      expect(deletes[0].id).toBe('msg_1')
    })
  })

  describe('reaction events', () => {
    test('emits message_reaction_add events', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      const reactions: DiscordGatewayReactionEvent[] = []
      listener.on('message_reaction_add', (event) => reactions.push(event))

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      mockWsInstance.simulateReady()
      mockWsInstance.simulateDispatch(
        'MESSAGE_REACTION_ADD',
        {
          user_id: 'U789',
          channel_id: 'C123',
          message_id: 'msg_1',
          emoji: { name: '👍' },
        },
        2,
      )

      expect(reactions.length).toBe(1)
      expect(reactions[0].user_id).toBe('U789')
      expect(reactions[0].emoji.name).toBe('👍')
    })
  })

  describe('discord_event catch-all', () => {
    test('emits discord_event for every dispatch (not READY)', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      const events: DiscordGatewayGenericEvent[] = []
      listener.on('discord_event', (event) => events.push(event))

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      mockWsInstance.simulateReady()
      mockWsInstance.simulateDispatch(
        'MESSAGE_CREATE',
        { id: 'm1', channel_id: 'C1', content: 'hi', timestamp: 't', author: { id: 'U1', username: 'u' } },
        2,
      )
      mockWsInstance.simulateDispatch('TYPING_START', { user_id: 'U1', channel_id: 'C1', timestamp: 1 }, 3)

      expect(events.length).toBe(2)
      expect(events[0].type).toBe('MESSAGE_CREATE')
      expect(events[1].type).toBe('TYPING_START')
    })
  })

  describe('heartbeat', () => {
    test('sends heartbeat after Hello (with jitter)', async () => {
      const originalRandom = Math.random
      Math.random = () => 0

      try {
        const client = createMockClient()
        listener = new DiscordListener(client)

        await listener.start()
        mockWsInstance.simulateOpen()
        mockWsInstance.simulateHello(50)

        await new Promise((r) => setTimeout(r, 150))

        const sentMessages = mockWsInstance.sent.map((s) => JSON.parse(s))
        const heartbeats = sentMessages.filter((m) => m.op === 1)

        expect(heartbeats.length).toBeGreaterThanOrEqual(1)
      } finally {
        Math.random = originalRandom
      }
    })

    test('heartbeat ACK not emitted as user event', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      const events: DiscordGatewayGenericEvent[] = []
      listener.on('discord_event', (event) => events.push(event))

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      mockWsInstance.simulateReady()
      mockWsInstance.simulateHeartbeatACK()

      expect(events.length).toBe(0)
    })

    test('zombie connection triggers reconnect (no ACK received)', async () => {
      const originalRandom = Math.random
      Math.random = () => 0

      try {
        const client = createMockClient()
        listener = new DiscordListener(client)

        const disconnected: boolean[] = []
        listener.on('disconnected', () => disconnected.push(true))

        await listener.start()
        mockWsInstance.simulateOpen()
        mockWsInstance.simulateHello(50)

        await new Promise((r) => setTimeout(r, 300))

        expect(disconnected.length).toBeGreaterThanOrEqual(1)
      } finally {
        Math.random = originalRandom
      }
    })
  })

  describe('stop', () => {
    test('closes WebSocket and prevents reconnection', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      await listener.start()
      mockWsInstance.simulateOpen()

      listener.stop()

      await new Promise((r) => setTimeout(r, 50))
      expect(client.gatewayConnect).toHaveBeenCalledTimes(1)
    })
  })

  describe('reconnection', () => {
    test('reconnects on WebSocket close when running', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      const disconnected: boolean[] = []
      listener.on('disconnected', () => disconnected.push(true))

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateClose()

      expect(disconnected.length).toBe(1)

      await new Promise((r) => setTimeout(r, 1500))
      expect(client.gatewayConnect.mock.calls.length).toBeGreaterThanOrEqual(2)
    })

    test('emits error and reconnects on gatewayConnect failure', async () => {
      let callCount = 0
      const client = createMockClient({
        gatewayConnect: mock(() => {
          callCount++
          if (callCount === 1) return Promise.reject(new Error('network_error'))
          return Promise.resolve({ token: 'fake-token' })
        }),
      })

      listener = new DiscordListener(client)

      const errors: Error[] = []
      listener.on('error', (err) => errors.push(err))

      await listener.start()

      await new Promise((r) => setTimeout(r, 1500))

      expect(errors.length).toBe(1)
      expect(errors[0].message).toBe('network_error')
      expect(client.gatewayConnect.mock.calls.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('on/off/once', () => {
    test('off removes listener', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      const messages: DiscordGatewayMessageCreateEvent[] = []
      const handler = (event: DiscordGatewayMessageCreateEvent) => messages.push(event)
      listener.on('message_create', handler)

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      mockWsInstance.simulateReady()
      mockWsInstance.simulateDispatch(
        'MESSAGE_CREATE',
        { id: 'm1', channel_id: 'C1', content: 'a', timestamp: 't', author: { id: 'U1', username: 'u' } },
        2,
      )

      listener.off('message_create', handler)
      mockWsInstance.simulateDispatch(
        'MESSAGE_CREATE',
        { id: 'm2', channel_id: 'C1', content: 'b', timestamp: 't', author: { id: 'U1', username: 'u' } },
        3,
      )

      expect(messages.length).toBe(1)
      expect(messages[0].content).toBe('a')
    })

    test('once fires only once', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      const messages: DiscordGatewayMessageCreateEvent[] = []
      listener.once('message_create', (event) => messages.push(event))

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      mockWsInstance.simulateReady()
      mockWsInstance.simulateDispatch(
        'MESSAGE_CREATE',
        { id: 'm1', channel_id: 'C1', content: 'first', timestamp: 't', author: { id: 'U1', username: 'u' } },
        2,
      )
      mockWsInstance.simulateDispatch(
        'MESSAGE_CREATE',
        { id: 'm2', channel_id: 'C1', content: 'second', timestamp: 't', author: { id: 'U1', username: 'u' } },
        3,
      )

      expect(messages.length).toBe(1)
      expect(messages[0].content).toBe('first')
    })
  })

  describe('opcode 7 Reconnect', () => {
    test('triggers immediate reconnect without backoff', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      mockWsInstance.simulateReady()

      ;(listener as any).reconnectAttempts = 5
      mockWsInstance.simulateReconnect()

      expect((listener as any).reconnectAttempts).toBe(0)
    })
  })

  describe('opcode 9 InvalidSession', () => {
    test('d=false clears session state, reconnects with fresh identify', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      mockWsInstance.simulateReady()

      expect((listener as any).sessionId).toBe('session_123')

      mockWsInstance.simulateInvalidSession(false)

      expect((listener as any).sessionId).toBeNull()
      expect((listener as any).sequence).toBeNull()
      expect((listener as any).resumeGatewayUrl).toBeNull()
    })

    test('d=true allows resume on reconnect', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      mockWsInstance.simulateReady()

      const sessionIdBefore = (listener as any).sessionId

      mockWsInstance.simulateInvalidSession(true)

      expect((listener as any).sessionId).toBe(sessionIdBefore)
    })
  })

  describe('resume', () => {
    test('sends Resume instead of Identify when session exists', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      mockWsInstance.simulateReady()

      mockWsInstance.simulateClose()

      await new Promise((r) => setTimeout(r, 1500))

      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()

      const sentMessages = mockWsInstance.sent.map((s) => JSON.parse(s))
      const resumeMsg = sentMessages.find((m) => m.op === 6)

      expect(resumeMsg).toBeDefined()
      expect(resumeMsg.d.session_id).toBe('session_123')
    })
  })

  describe('non-recoverable close codes', () => {
    test('emits error and stops on code 4004', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      const errors: Error[] = []
      listener.on('error', (err) => errors.push(err))

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateClose(4004)

      await new Promise((r) => setTimeout(r, 50))

      expect(errors.length).toBe(1)
      expect(errors[0].message).toContain('4004')
      expect(client.gatewayConnect).toHaveBeenCalledTimes(1)
    })
  })

  describe('session reset close codes', () => {
    test('4007 clears session and reconnects with fresh identify', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      mockWsInstance.simulateReady()

      expect((listener as any).sessionId).toBe('session_123')

      mockWsInstance.simulateClose(4007)

      expect((listener as any).sessionId).toBeNull()
      expect((listener as any).sequence).toBeNull()
      expect((listener as any).resumeGatewayUrl).toBeNull()

      await new Promise((r) => setTimeout(r, 1500))

      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()

      const sentMessages = mockWsInstance.sent.map((s) => JSON.parse(s))
      const identifyMsg = sentMessages.find((m) => m.op === 2)
      const resumeMsg = sentMessages.find((m) => m.op === 6)

      expect(identifyMsg).toBeDefined()
      expect(resumeMsg).toBeUndefined()
    })

    test('4009 clears session and reconnects with fresh identify', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      mockWsInstance.simulateReady()

      mockWsInstance.simulateClose(4009)

      expect((listener as any).sessionId).toBeNull()
    })
  })

  describe('duplicate Hello', () => {
    test('does not stack heartbeat timers on second Hello', async () => {
      const originalRandom = Math.random
      Math.random = () => 0

      try {
        const client = createMockClient()
        listener = new DiscordListener(client)

        await listener.start()
        mockWsInstance.simulateOpen()
        mockWsInstance.simulateHello(50)
        mockWsInstance.simulateReady()

        mockWsInstance.simulateHello(50)

        await new Promise((r) => setTimeout(r, 200))

        const sentMessages = mockWsInstance.sent.map((s) => JSON.parse(s))
        const heartbeats = sentMessages.filter((m) => m.op === 1)

        expect(heartbeats.length).toBeLessThanOrEqual(8)
      } finally {
        Math.random = originalRandom
      }
    })
  })

  describe('InvalidSession timer safety', () => {
    test('stop cancels pending InvalidSession d=true timeout', async () => {
      const originalRandom = Math.random
      Math.random = () => 0

      try {
        const client = createMockClient()
        listener = new DiscordListener(client)

        await listener.start()
        mockWsInstance.simulateOpen()
        mockWsInstance.simulateHello()
        mockWsInstance.simulateReady()

        mockWsInstance.simulateInvalidSession(true)

        listener.stop()

        expect((listener as any).invalidSessionTimer).toBeNull()
      } finally {
        Math.random = originalRandom
      }
    })

    test('InvalidSession d=false sends fresh identify on reconnect', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      mockWsInstance.simulateReady()

      mockWsInstance.simulateInvalidSession(false)

      await new Promise((r) => setTimeout(r, 1500))

      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()

      const sentMessages = mockWsInstance.sent.map((s) => JSON.parse(s))
      const identifyMsg = sentMessages.find((m) => m.op === 2)
      const resumeMsg = sentMessages.find((m) => m.op === 6)

      expect(identifyMsg).toBeDefined()
      expect(resumeMsg).toBeUndefined()
    })
  })

  describe('server-requested heartbeat', () => {
    test('responds to opcode 1 with heartbeat', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      mockWsInstance.simulateReady()

      const sentBefore = mockWsInstance.sent.length
      mockWsInstance.simulateMessage({ op: 1 })

      const sentAfter = mockWsInstance.sent.slice(sentBefore)
      const heartbeats = sentAfter.map((s) => JSON.parse(s)).filter((m) => m.op === 1)

      expect(heartbeats.length).toBe(1)
    })
  })

  describe('sequence tracking', () => {
    test('tracks sequence from dispatch events', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      mockWsInstance.simulateReady()

      mockWsInstance.simulateDispatch(
        'MESSAGE_CREATE',
        { id: 'm1', channel_id: 'C1', content: 'hi', timestamp: 't', author: { id: 'U1', username: 'u' } },
        5,
      )

      expect((listener as any).sequence).toBe(5)
    })

    test('ignores null sequence values', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      mockWsInstance.simulateReady()

      mockWsInstance.simulateDispatch(
        'MESSAGE_CREATE',
        { id: 'm1', channel_id: 'C1', content: 'hi', timestamp: 't', author: { id: 'U1', username: 'u' } },
        5,
      )

      mockWsInstance.simulateMessage({
        op: 0,
        t: 'TYPING_START',
        s: null,
        d: { user_id: 'U1', channel_id: 'C1', timestamp: 1 },
      })

      expect((listener as any).sequence).toBe(5)
    })
  })

  describe('start after stop', () => {
    test('resets reconnect attempts on fresh start', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      await listener.start()
      ;(listener as any).reconnectAttempts = 5
      listener.stop()

      await listener.start()
      expect((listener as any).reconnectAttempts).toBe(0)
    })
  })
})
