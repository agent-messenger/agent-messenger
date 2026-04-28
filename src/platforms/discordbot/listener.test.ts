import { afterEach, describe, expect, mock, it } from 'bun:test'

import { DiscordBotListener } from '@/platforms/discordbot/listener'
import type {
  DiscordGatewayGenericEvent,
  DiscordGatewayMessageCreateEvent,
  DiscordGatewayMessageDeleteEvent,
  DiscordGatewayMessageUpdateEvent,
  DiscordGatewayReactionEvent,
} from '@/platforms/discordbot/types'

type WsHandler = (...args: any[]) => void

let mockWsInstance: MockWs

class MockWs {
  static OPEN = 1
  static CLOSED = 3
  static lastUrl: string | null = null
  readyState = MockWs.OPEN

  private handlers = new Map<string, WsHandler[]>()
  sent: string[] = []
  url: string

  constructor(url: string, _options?: any) {
    this.url = url
    MockWs.lastUrl = url
    // oxlint-disable-next-line typescript-eslint/no-this-alias
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
        user: { id: 'BOT_SELF', username: 'testbot' },
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
    gatewayConnect: mock(() => Promise.resolve({ token: 'fake-bot-token' })),
    ...overrides,
  } as any
}

describe('DiscordBotListener', () => {
  let listener: DiscordBotListener

  afterEach(() => {
    listener?.stop()
  })

  describe('start', () => {
    it('calls gatewayConnect and opens WebSocket', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      await listener.start()
      mockWsInstance.simulateOpen()

      expect(client.gatewayConnect).toHaveBeenCalledTimes(1)
    })

    it('is idempotent', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      await listener.start()
      await listener.start()

      expect(client.gatewayConnect).toHaveBeenCalledTimes(1)
    })
  })

  describe('connected event', () => {
    it('emits connected with bot user/sessionId on READY', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      const connected: any[] = []
      listener.on('connected', (info) => connected.push(info))

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      mockWsInstance.simulateReady()

      expect(connected.length).toBe(1)
      expect(connected[0].user.id).toBe('BOT_SELF')
      expect(connected[0].sessionId).toBe('session_123')
    })
  })

  describe('identify', () => {
    it('sends Identify with bot token after Hello', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()

      const sentMessages = mockWsInstance.sent.map((s) => JSON.parse(s))
      const identifyMsg = sentMessages.find((m) => m.op === 2)

      expect(identifyMsg).toBeDefined()
      expect(identifyMsg.d.token).toBe('fake-bot-token')
    })

    it('sends Identify with custom intents', async () => {
      const client = createMockClient()
      const customIntents = (1 << 9) | (1 << 15) // GuildMessages | MessageContent
      listener = new DiscordBotListener(client, { intents: customIntents })

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()

      const sentMessages = mockWsInstance.sent.map((s) => JSON.parse(s))
      const identifyMsg = sentMessages.find((m) => m.op === 2)

      expect(identifyMsg).toBeDefined()
      expect(identifyMsg.d.intents).toBe(customIntents)
    })

    it('uses sensible default intents when none specified', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()

      const sentMessages = mockWsInstance.sent.map((s) => JSON.parse(s))
      const identifyMsg = sentMessages.find((m) => m.op === 2)

      // given: default intents enable Guilds + GuildMessages + reactions/typing + DMs
      // then: the bitfield must include GuildMessages (1 << 9) at minimum
      expect(identifyMsg.d.intents & (1 << 9)).toBeGreaterThan(0)
      // and: must NOT include privileged MessageContent (1 << 15) by default
      expect(identifyMsg.d.intents & (1 << 15)).toBe(0)
    })
  })

  describe('message events', () => {
    it('emits message_create events', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

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

    it('emits message_update events', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

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

    it('emits message_delete events', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

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
    it('emits message_reaction_add events', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

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

  describe('interaction events', () => {
    it('emits interaction_create events for slash commands', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      const interactions: any[] = []
      listener.on('interaction_create', (event) => interactions.push(event))

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      mockWsInstance.simulateReady()
      mockWsInstance.simulateDispatch(
        'INTERACTION_CREATE',
        {
          id: 'int_1',
          application_id: 'app_1',
          token: 'interaction_token',
          channel_id: 'C123',
          data: { name: 'ping' },
        },
        2,
      )

      expect(interactions.length).toBe(1)
      expect(interactions[0].id).toBe('int_1')
      expect(interactions[0].data.name).toBe('ping')
    })
  })

  describe('discord_event catch-all', () => {
    it('emits discord_event for every dispatch (not READY)', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

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
    it('sends heartbeat after Hello (with jitter)', async () => {
      const originalRandom = Math.random
      Math.random = () => 0

      try {
        const client = createMockClient()
        listener = new DiscordBotListener(client)

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

    it('heartbeat ACK not emitted as user event', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      const events: DiscordGatewayGenericEvent[] = []
      listener.on('discord_event', (event) => events.push(event))

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      mockWsInstance.simulateReady()
      mockWsInstance.simulateHeartbeatACK()

      expect(events.length).toBe(0)
    })

    it('zombie connection triggers reconnect (no ACK received)', async () => {
      const originalRandom = Math.random
      Math.random = () => 0

      try {
        const client = createMockClient()
        listener = new DiscordBotListener(client)

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
    it('closes WebSocket and prevents reconnection', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      await listener.start()
      mockWsInstance.simulateOpen()

      listener.stop()

      await new Promise((r) => setTimeout(r, 50))
      expect(client.gatewayConnect).toHaveBeenCalledTimes(1)
    })
  })

  describe('reconnection', () => {
    it('reconnects on WebSocket close when running', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      const disconnected: boolean[] = []
      listener.on('disconnected', () => disconnected.push(true))

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateClose()

      expect(disconnected.length).toBe(1)

      await new Promise((r) => setTimeout(r, 1500))
      expect(client.gatewayConnect.mock.calls.length).toBeGreaterThanOrEqual(2)
    })

    it('emits error and reconnects on gatewayConnect failure', async () => {
      let callCount = 0
      const client = createMockClient({
        gatewayConnect: mock(() => {
          callCount++
          if (callCount === 1) return Promise.reject(new Error('network_error'))
          return Promise.resolve({ token: 'fake-bot-token' })
        }),
      })

      listener = new DiscordBotListener(client)

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
    it('off removes listener', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

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

    it('once fires only once', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

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
    it('triggers immediate reconnect without backoff', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

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
    it('d=false clears session state, reconnects with fresh identify', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

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

    it('d=true allows resume on reconnect', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

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
    it('sends Resume instead of Identify when session exists', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

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
    it('emits error and stops on code 4014 (privileged intent not approved)', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      const errors: Error[] = []
      listener.on('error', (err) => errors.push(err))

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateClose(4014)

      await new Promise((r) => setTimeout(r, 50))

      expect(errors.length).toBe(1)
      expect(errors[0].message).toContain('4014')
      expect(client.gatewayConnect).toHaveBeenCalledTimes(1)
    })

    it('emits error and stops on code 4004 (invalid token)', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      const errors: Error[] = []
      listener.on('error', (err) => errors.push(err))

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateClose(4004)

      await new Promise((r) => setTimeout(r, 50))

      expect(errors.length).toBe(1)
      expect(errors[0].message).toContain('4004')
    })
  })

  describe('session reset close codes', () => {
    it('4007 clears session and reconnects with fresh identify', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

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

    it('4009 clears session', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      mockWsInstance.simulateReady()

      mockWsInstance.simulateClose(4009)

      expect((listener as any).sessionId).toBeNull()
    })
  })

  describe('duplicate Hello', () => {
    it('does not stack heartbeat timers on second Hello', async () => {
      const originalRandom = Math.random
      Math.random = () => 0

      try {
        const client = createMockClient()
        listener = new DiscordBotListener(client)

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
    it('stop cancels pending InvalidSession d=true timeout', async () => {
      const originalRandom = Math.random
      Math.random = () => 0

      try {
        const client = createMockClient()
        listener = new DiscordBotListener(client)

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
  })

  describe('server-requested heartbeat', () => {
    it('responds to opcode 1 with heartbeat', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

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
    it('tracks sequence from dispatch events', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

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

    it('ignores null sequence values', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

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
    it('resets reconnect attempts on fresh start', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      await listener.start()
      ;(listener as any).reconnectAttempts = 5
      listener.stop()

      await listener.start()
      expect((listener as any).reconnectAttempts).toBe(0)
    })
  })

  describe('reconnect URL', () => {
    it('appends ?v=10&encoding=json to resume_gateway_url on reconnect', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      mockWsInstance.simulateMessage({
        op: 0,
        t: 'READY',
        s: 1,
        d: {
          session_id: 'session_xyz',
          resume_gateway_url: 'wss://gateway-us-east1-b.discord.gg',
          user: { id: 'BOT', username: 'bot' },
        },
      })

      mockWsInstance.simulateClose()
      await new Promise((r) => setTimeout(r, 1500))

      expect(MockWs.lastUrl).toBe('wss://gateway-us-east1-b.discord.gg?v=10&encoding=json')
    })

    it('uses default gateway URL on initial connect when no resume URL is set', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      await listener.start()

      expect(MockWs.lastUrl).toBe('wss://gateway.discord.gg/?v=10&encoding=json')
    })
  })

  describe('reconnectAttempts deferred to READY/RESUMED', () => {
    it('does not reset reconnectAttempts on socket open alone', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      await listener.start()
      ;(listener as any).reconnectAttempts = 5

      mockWsInstance.simulateOpen()

      // given: a socket opens but no READY received yet
      // then: reconnectAttempts must NOT be reset (open alone is not a successful session)
      expect((listener as any).reconnectAttempts).toBe(5)
    })

    it('resets reconnectAttempts on READY dispatch', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      await listener.start()
      ;(listener as any).reconnectAttempts = 5

      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      mockWsInstance.simulateReady()

      expect((listener as any).reconnectAttempts).toBe(0)
    })

    it('resets reconnectAttempts on RESUMED dispatch', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      mockWsInstance.simulateReady()

      mockWsInstance.simulateClose()
      await new Promise((r) => setTimeout(r, 1500))

      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      ;(listener as any).reconnectAttempts = 5

      mockWsInstance.simulateMessage({ op: 0, t: 'RESUMED', s: 2, d: {} })

      expect((listener as any).reconnectAttempts).toBe(0)
    })
  })

  describe('RESUMED dispatch', () => {
    it('emits connected with cached user/session on RESUMED', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      const connectedEvents: any[] = []
      listener.on('connected', (info) => connectedEvents.push(info))

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      mockWsInstance.simulateReady()

      expect(connectedEvents.length).toBe(1)

      mockWsInstance.simulateClose()
      await new Promise((r) => setTimeout(r, 1500))

      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      mockWsInstance.simulateMessage({ op: 0, t: 'RESUMED', s: 2, d: {} })

      expect(connectedEvents.length).toBe(2)
      expect(connectedEvents[1].user.id).toBe('BOT_SELF')
      expect(connectedEvents[1].sessionId).toBe('session_123')
    })
  })

  describe('generation guard prevents stale-socket interference', () => {
    it('stale socket close after stop+start does not clear new socket timers', async () => {
      const client = createMockClient()
      listener = new DiscordBotListener(client)

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      mockWsInstance.simulateReady()

      const oldWs = mockWsInstance

      listener.stop()
      await listener.start()

      // given: a fresh socket from the second start()
      // when: the OLD socket fires a stale close event
      oldWs.emit('close', 1000)

      // then: the new socket's state should be intact (running, generation incremented)
      expect((listener as any).running).toBe(true)
      expect((listener as any).generation).toBeGreaterThanOrEqual(2)
    })

    it('InvalidSession d=true timer no-ops if generation changed before firing', async () => {
      const originalRandom = Math.random
      Math.random = () => 0

      try {
        const client = createMockClient()
        listener = new DiscordBotListener(client)

        await listener.start()
        mockWsInstance.simulateOpen()
        mockWsInstance.simulateHello()
        mockWsInstance.simulateReady()

        const initialGeneration = (listener as any).generation

        mockWsInstance.simulateInvalidSession(true)

        // when: stop()+start() before the d=true delay fires
        listener.stop()
        await listener.start()

        await new Promise((r) => setTimeout(r, 1500))

        // then: generation moved forward so the stale timer's close call is suppressed
        expect((listener as any).generation).toBeGreaterThan(initialGeneration)
      } finally {
        Math.random = originalRandom
      }
    })
  })
})
