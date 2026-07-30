import { afterEach, describe, expect, mock, it } from 'bun:test'

import { DiscordListener, parseReadStates } from '@/platforms/discord/listener'
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

  simulateReady(sessionId = 'session_123', readState?: unknown) {
    this.simulateMessage({
      op: 0,
      t: 'READY',
      s: 1,
      d: {
        session_id: sessionId,
        resume_gateway_url: 'wss://resume.discord.gg',
        user: { id: 'U_SELF', username: 'testbot' },
        ...(readState === undefined ? {} : { read_state: readState }),
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

// start() now resolves only once the gateway emits READY, so the handshake must be
// driven concurrently while start() is pending. This waits for connect() to create the
// socket (after the awaited gatewayConnect microtask) before the caller drives it.
async function waitForSocket(): Promise<MockWs> {
  for (let i = 0; i < 50 && !mockWsInstance; i++) {
    await Promise.resolve()
  }
  return mockWsInstance
}

async function startAndReady(listener: DiscordListener): Promise<void> {
  const started = listener.start()
  const ws = await waitForSocket()
  ws.simulateOpen()
  ws.simulateHello()
  ws.simulateReady()
  await started
}

// For tests that exercise pre-READY behavior (Identify/heartbeat/close paths): start() stays
// pending here. The start promise's rejection is swallowed; afterEach stop() clears its timer.
async function startConnecting(listener: DiscordListener): Promise<MockWs> {
  listener.start().catch(() => {})
  const ws = await waitForSocket()
  ws.simulateOpen()
  return ws
}

describe('parseReadStates', () => {
  it('filters out non-channel read state types', () => {
    const result = parseReadStates([
      { id: 'c1', last_message_id: '100', mention_count: 1 },
      { id: 'c2', read_state_type: 2, mention_count: 5 },
    ])

    expect(result.states).toEqual([{ channelId: 'c1', lastMessageId: '100', mentionCount: 1 }])
  })

  it('normalizes missing last_message_id and mention_count', () => {
    const result = parseReadStates([{ id: 'c1' }])

    expect(result.states).toEqual([{ channelId: 'c1', lastMessageId: null, mentionCount: 0 }])
  })

  it('skips malformed entries but keeps valid ones', () => {
    const result = parseReadStates([{ id: 'c1', mention_count: 1 }, { mention_count: 3 }])

    expect(result.states).toEqual([{ channelId: 'c1', lastMessageId: null, mentionCount: 1 }])
  })

  it('treats a bare array payload as complete', () => {
    expect(parseReadStates([{ id: 'c1' }]).partial).toBe(false)
  })

  it('reads the partial flag from a versioned payload', () => {
    expect(parseReadStates({ entries: [{ id: 'c1' }], version: 7, partial: true }).partial).toBe(true)
    expect(parseReadStates({ entries: [{ id: 'c1' }], version: 7 }).partial).toBe(false)
  })

  it('throws on a non-array, non-versioned payload', () => {
    expect(() => parseReadStates({ foo: 'bar' })).toThrow(/invalid read_state/)
  })
})

describe('DiscordListener', () => {
  let listener: DiscordListener

  afterEach(() => {
    listener?.stop()
    mockWsInstance = undefined as unknown as MockWs
  })

  describe('start', () => {
    it('calls gatewayConnect and opens WebSocket', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      await startAndReady(listener)

      expect(client.gatewayConnect).toHaveBeenCalledTimes(1)
    })

    it('does not resolve until a READY dispatch is delivered', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      let resolved = false
      const started = listener.start().then(() => {
        resolved = true
      })

      const ws = await waitForSocket()
      ws.simulateOpen()
      ws.simulateHello()

      // given: socket open + Hello (Identify sent) but no READY yet
      await Promise.resolve()
      expect(resolved).toBe(false)

      // when: READY arrives
      ws.simulateReady()
      await started

      expect(resolved).toBe(true)
    })

    it('is idempotent', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      await startAndReady(listener)
      await listener.start()

      expect(client.gatewayConnect).toHaveBeenCalledTimes(1)
    })

    it('shares one readiness promise across concurrent start() calls', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      const first = listener.start()
      const second = listener.start()

      const ws = await waitForSocket()
      ws.simulateOpen()
      ws.simulateHello()
      ws.simulateReady()

      await Promise.all([first, second])
      expect(client.gatewayConnect).toHaveBeenCalledTimes(1)
    })

    it('rejects an in-flight start() when stop() is called before READY', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      const started = listener.start()
      const ws = await waitForSocket()
      ws.simulateOpen()
      ws.simulateHello()

      // given: start() is still awaiting READY when the consumer stops the listener
      listener.stop()

      await expect(started).rejects.toThrow(/stopped before becoming ready/)
    })
  })

  describe('connected event', () => {
    it('emits connected with user/sessionId on READY', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      const connected: any[] = []
      listener.on('connected', (info) => connected.push(info))

      await startAndReady(listener)

      expect(connected.length).toBe(1)
      expect(connected[0].user.id).toBe('U_SELF')
      expect(connected[0].sessionId).toBe('session_123')
    })
  })

  describe('read state', () => {
    it('captures raw-array read_state from READY', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      const started = listener.start()
      const ws = await waitForSocket()
      ws.simulateOpen()
      ws.simulateHello()
      ws.simulateReady('session_123', [{ id: 'c1', last_message_id: '100', mention_count: 2 }])
      await started

      expect(listener.getReadState()).toEqual([{ channelId: 'c1', lastMessageId: '100', mentionCount: 2 }])
    })

    it('captures versioned { entries } read_state from READY', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      const started = listener.start()
      const ws = await waitForSocket()
      ws.simulateOpen()
      ws.simulateHello()
      ws.simulateReady('session_123', { version: 7, entries: [{ id: 'c1', last_message_id: '100', mention_count: 1 }] })
      await started

      expect(listener.getReadState()).toEqual([{ channelId: 'c1', lastMessageId: '100', mentionCount: 1 }])
    })

    it('defaults to an empty read state when READY omits read_state', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      await startAndReady(listener)

      expect(listener.getReadState()).toEqual([])
    })
  })

  describe('identify', () => {
    it('sends Identify after Hello', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      const ws = await startConnecting(listener)
      ws.simulateHello()

      const sentMessages = mockWsInstance.sent.map((s) => JSON.parse(s))
      const identifyMsg = sentMessages.find((m) => m.op === 2)

      expect(identifyMsg).toBeDefined()
      expect(identifyMsg.d.token).toBe('fake-token')
    })

    it('sends a user-account Identify with the load-bearing default shape', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      const ws = await startConnecting(listener)
      ws.simulateHello()

      const sentMessages = mockWsInstance.sent.map((s) => JSON.parse(s))
      const identifyMsg = sentMessages.find((m) => m.op === 2)

      expect(identifyMsg).toBeDefined()
      expect(identifyMsg.d.capabilities).toBe(16381)
      expect(identifyMsg.d.client_state).toEqual({ guild_versions: {} })
      expect(identifyMsg.d.compress).toBe(false)
      expect(identifyMsg.d.presence).toEqual({ status: 'online', since: 0, activities: [], afk: false })
      expect(identifyMsg.d.properties.browser).toBe('Chrome')
      expect(identifyMsg.d.properties.client_build_number).toBe(648814)

      // All intents incl. MESSAGE_CONTENT (1<<15); user sessions blank other users' content without it
      expect(identifyMsg.d.intents).toBe(33_554_431)
      expect(identifyMsg.d.intents & (1 << 15)).toBe(1 << 15)
    })
  })

  describe('message events', () => {
    it('emits message_create events', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      const messages: DiscordGatewayMessageCreateEvent[] = []
      listener.on('message_create', (event) => messages.push(event))

      await startAndReady(listener)
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
      listener = new DiscordListener(client)

      const updates: DiscordGatewayMessageUpdateEvent[] = []
      listener.on('message_update', (event) => updates.push(event))

      await startAndReady(listener)
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
      listener = new DiscordListener(client)

      const deletes: DiscordGatewayMessageDeleteEvent[] = []
      listener.on('message_delete', (event) => deletes.push(event))

      await startAndReady(listener)
      mockWsInstance.simulateDispatch('MESSAGE_DELETE', { id: 'msg_1', channel_id: 'C123' }, 2)

      expect(deletes.length).toBe(1)
      expect(deletes[0].id).toBe('msg_1')
    })
  })

  describe('reaction events', () => {
    it('emits message_reaction_add events', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      const reactions: DiscordGatewayReactionEvent[] = []
      listener.on('message_reaction_add', (event) => reactions.push(event))

      await startAndReady(listener)
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
    it('emits discord_event for every dispatch (not READY)', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      const events: DiscordGatewayGenericEvent[] = []
      listener.on('discord_event', (event) => events.push(event))

      await startAndReady(listener)
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
        listener = new DiscordListener(client)

        const ws = await startConnecting(listener)
        ws.simulateHello(50)

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
      listener = new DiscordListener(client)

      const events: DiscordGatewayGenericEvent[] = []
      listener.on('discord_event', (event) => events.push(event))

      await startAndReady(listener)
      mockWsInstance.simulateHeartbeatACK()

      expect(events.length).toBe(0)
    })

    it('zombie connection triggers reconnect (no ACK received)', async () => {
      const originalRandom = Math.random
      Math.random = () => 0

      try {
        const client = createMockClient()
        listener = new DiscordListener(client)

        const disconnected: boolean[] = []
        listener.on('disconnected', () => disconnected.push(true))

        const ws = await startConnecting(listener)
        ws.simulateHello(50)

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
      listener = new DiscordListener(client)

      await startConnecting(listener)

      listener.stop()

      await new Promise((r) => setTimeout(r, 50))
      expect(client.gatewayConnect).toHaveBeenCalledTimes(1)
    })
  })

  describe('reconnection', () => {
    it('reconnects on WebSocket close when running', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      const disconnected: boolean[] = []
      listener.on('disconnected', () => disconnected.push(true))

      const ws = await startConnecting(listener)
      ws.simulateClose()

      expect(disconnected.length).toBe(1)

      await new Promise((r) => setTimeout(r, 1500))
      expect(client.gatewayConnect.mock.calls.length).toBeGreaterThanOrEqual(2)
    })

    it('rejects start() and stops on gatewayConnect failure during initial connect', async () => {
      const client = createMockClient({
        gatewayConnect: mock(() => Promise.reject(new Error('network_error'))),
      })

      listener = new DiscordListener(client)
      listener.on('error', () => {})

      await expect(listener.start()).rejects.toThrow('network_error')

      // given: a pre-READY connect error tears down the listener (no resurrected reconnect loop)
      await new Promise((r) => setTimeout(r, 1500))
      expect((listener as any).running).toBe(false)
      expect(client.gatewayConnect).toHaveBeenCalledTimes(1)
    })
  })

  describe('on/off/once', () => {
    it('off removes listener', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      const messages: DiscordGatewayMessageCreateEvent[] = []
      const handler = (event: DiscordGatewayMessageCreateEvent) => messages.push(event)
      listener.on('message_create', handler)

      await startAndReady(listener)
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
      listener = new DiscordListener(client)

      const messages: DiscordGatewayMessageCreateEvent[] = []
      listener.once('message_create', (event) => messages.push(event))

      await startAndReady(listener)
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
      listener = new DiscordListener(client)

      await startAndReady(listener)

      ;(listener as any).reconnectAttempts = 5
      mockWsInstance.simulateReconnect()

      expect((listener as any).reconnectAttempts).toBe(0)
    })
  })

  describe('opcode 9 InvalidSession', () => {
    it('d=false clears session state, reconnects with fresh identify', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      await startAndReady(listener)

      expect((listener as any).sessionId).toBe('session_123')

      mockWsInstance.simulateInvalidSession(false)

      expect((listener as any).sessionId).toBeNull()
      expect((listener as any).sequence).toBeNull()
      expect((listener as any).resumeGatewayUrl).toBeNull()
    })

    it('d=true allows resume on reconnect', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      await startAndReady(listener)

      const sessionIdBefore = (listener as any).sessionId

      mockWsInstance.simulateInvalidSession(true)

      expect((listener as any).sessionId).toBe(sessionIdBefore)
    })
  })

  describe('resume', () => {
    it('sends Resume instead of Identify when session exists', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      await startAndReady(listener)

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
    for (const code of [4004, 4013, 4014]) {
      it(`rejects start() and stops on non-recoverable close ${code}`, async () => {
        const client = createMockClient()
        listener = new DiscordListener(client)
        listener.on('error', () => {})

        const started = listener.start()
        const ws = await waitForSocket()
        ws.simulateOpen()
        ws.simulateClose(code)

        await expect(started).rejects.toThrow(String(code))
        expect((listener as any).running).toBe(false)
        expect(client.gatewayConnect).toHaveBeenCalledTimes(1)
      })
    }
  })

  describe('connect timeout', () => {
    it('rejects start() and tears down when READY never arrives', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client, { connectTimeoutMs: 100 })
      listener.on('error', () => {})

      const started = listener.start()
      const ws = await waitForSocket()
      ws.simulateOpen()
      ws.simulateHello()
      // given: Identify sent but the gateway never delivers READY

      await expect(started).rejects.toThrow(/did not become ready/)
      expect((listener as any).running).toBe(false)
    })
  })

  describe('session reset close codes', () => {
    it('4007 clears session and reconnects with fresh identify', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      await startAndReady(listener)

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

    it('4009 clears session and reconnects with fresh identify', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      await startAndReady(listener)

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
        listener = new DiscordListener(client)

        const started = listener.start()
        const ws = await waitForSocket()
        ws.simulateOpen()
        ws.simulateHello(50)
        ws.simulateReady()
        await started

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
        listener = new DiscordListener(client)

        await startAndReady(listener)

        mockWsInstance.simulateInvalidSession(true)

        listener.stop()

        expect((listener as any).invalidSessionTimer).toBeNull()
      } finally {
        Math.random = originalRandom
      }
    })

    it('InvalidSession d=false sends fresh identify on reconnect', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      await startAndReady(listener)

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
    it('responds to opcode 1 with heartbeat', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      await startAndReady(listener)

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
      listener = new DiscordListener(client)

      await startAndReady(listener)

      mockWsInstance.simulateDispatch(
        'MESSAGE_CREATE',
        { id: 'm1', channel_id: 'C1', content: 'hi', timestamp: 't', author: { id: 'U1', username: 'u' } },
        5,
      )

      expect((listener as any).sequence).toBe(5)
    })

    it('ignores null sequence values', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      await startAndReady(listener)

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
      listener = new DiscordListener(client)

      await startConnecting(listener)
      ;(listener as any).reconnectAttempts = 5
      listener.stop()

      await startConnecting(listener)
      expect((listener as any).reconnectAttempts).toBe(0)
    })
  })

  describe('reconnect URL', () => {
    it('appends ?v=10&encoding=json to resume_gateway_url on reconnect', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      const started = listener.start()
      const ws = await waitForSocket()
      ws.simulateOpen()
      ws.simulateHello()
      ws.simulateMessage({
        op: 0,
        t: 'READY',
        s: 1,
        d: {
          session_id: 'session_xyz',
          resume_gateway_url: 'wss://gateway-us-east1-b.discord.gg',
          user: { id: 'U_SELF', username: 'user' },
        },
      })
      await started

      mockWsInstance.simulateClose()
      await new Promise((r) => setTimeout(r, 1500))

      expect(MockWs.lastUrl).toBe('wss://gateway-us-east1-b.discord.gg?v=10&encoding=json')
    })
  })

  describe('reconnectAttempts deferred to READY/RESUMED', () => {
    it('does not reset reconnectAttempts on socket open alone', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      listener.start().catch(() => {})
      const ws = await waitForSocket()
      ;(listener as any).reconnectAttempts = 5

      ws.simulateOpen()

      expect((listener as any).reconnectAttempts).toBe(5)
    })

    it('resets reconnectAttempts on READY dispatch', async () => {
      const client = createMockClient()
      listener = new DiscordListener(client)

      const started = listener.start()
      const ws = await waitForSocket()
      ;(listener as any).reconnectAttempts = 5

      ws.simulateOpen()
      ws.simulateHello()
      ws.simulateReady()
      await started

      expect((listener as any).reconnectAttempts).toBe(0)
    })
  })
})
