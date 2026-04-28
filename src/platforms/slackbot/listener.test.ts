import { afterEach, describe, expect, mock, it } from 'bun:test'

import { SlackBotListener } from '@/platforms/slackbot/listener'
import type {
  SlackSocketModeEventsApiArgs,
  SlackSocketModeInteractiveArgs,
  SlackSocketModeMessageEvent,
  SlackSocketModeReactionEvent,
  SlackSocketModeSlashCommandArgs,
} from '@/platforms/slackbot/types'

type WsHandler = (...args: any[]) => void

let mockWsInstance: MockWs

class MockWs {
  static OPEN = 1
  static CLOSED = 3
  static lastUrl: string | null = null
  readyState = MockWs.OPEN
  url: string

  private handlers = new Map<string, WsHandler[]>()
  sent: string[] = []
  pings: number = 0

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

  ping() {
    this.pings++
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

  simulateRawMessage(raw: string) {
    this.emit('message', Buffer.from(raw))
  }

  simulateClose() {
    this.readyState = MockWs.CLOSED
    this.emit('close')
  }

  simulatePong() {
    this.emit('pong')
  }

  simulateHello(extra: Record<string, unknown> = {}) {
    this.simulateMessage({
      type: 'hello',
      connection_info: { app_id: 'A_APP' },
      num_connections: 1,
      ...extra,
    })
  }

  simulateEventsApi(envelopeId: string, event: Record<string, unknown>, extra: Record<string, unknown> = {}) {
    this.simulateMessage({
      type: 'events_api',
      envelope_id: envelopeId,
      payload: {
        team_id: 'T_TEAM',
        api_app_id: 'A_APP',
        event,
        type: 'event_callback',
        event_id: 'Ev123',
        event_time: 1700000000,
      },
      accepts_response_payload: false,
      ...extra,
    })
  }

  simulateSlashCommand(envelopeId: string, payload: Record<string, unknown>) {
    this.simulateMessage({
      type: 'slash_commands',
      envelope_id: envelopeId,
      payload,
      accepts_response_payload: true,
    })
  }

  simulateInteractive(envelopeId: string, payload: Record<string, unknown>) {
    this.simulateMessage({
      type: 'interactive',
      envelope_id: envelopeId,
      payload,
      accepts_response_payload: true,
    })
  }

  simulateDisconnect(reason = 'warning') {
    this.simulateMessage({ type: 'disconnect', reason, debug_info: { host: 'h' } })
  }
}

mock.module('ws', () => ({ default: MockWs, __esModule: true }))

function createMockClient(overrides: Record<string, any> = {}) {
  return {
    appsConnectionsOpen: mock(() => Promise.resolve({ url: 'wss://wss.slack.com/?ticket=abc' })),
    ...overrides,
  } as any
}

const APP_TOKEN = 'xapp-1-A123-456-deadbeef'

describe('SlackBotListener', () => {
  let listener: SlackBotListener

  afterEach(() => {
    listener?.stop()
  })

  describe('constructor', () => {
    it('throws without app token', () => {
      const client = createMockClient()
      expect(() => new SlackBotListener(client, { appToken: '' })).toThrow(/app-level token/i)
    })

    it('accepts a valid xapp- token', () => {
      const client = createMockClient()
      listener = new SlackBotListener(client, { appToken: APP_TOKEN })
      expect(listener).toBeInstanceOf(SlackBotListener)
    })
  })

  describe('start', () => {
    it('calls appsConnectionsOpen with the app token and opens WebSocket', async () => {
      const client = createMockClient()
      listener = new SlackBotListener(client, { appToken: APP_TOKEN })

      await listener.start()
      mockWsInstance.simulateOpen()

      expect(client.appsConnectionsOpen).toHaveBeenCalledTimes(1)
      expect(client.appsConnectionsOpen).toHaveBeenCalledWith(APP_TOKEN)
      expect(MockWs.lastUrl).toBe('wss://wss.slack.com/?ticket=abc')
    })

    it('is idempotent', async () => {
      const client = createMockClient()
      listener = new SlackBotListener(client, { appToken: APP_TOKEN })

      await listener.start()
      await listener.start()

      expect(client.appsConnectionsOpen).toHaveBeenCalledTimes(1)
    })

    it('appends debug_reconnects=true when option is set', async () => {
      const client = createMockClient()
      listener = new SlackBotListener(client, { appToken: APP_TOKEN, debugReconnects: true })

      await listener.start()

      expect(MockWs.lastUrl).toContain('debug_reconnects=true')
    })

    it('preserves existing query params when appending debug_reconnects', async () => {
      const client = createMockClient({
        appsConnectionsOpen: mock(() => Promise.resolve({ url: 'wss://wss.slack.com/?ticket=abc' })),
      })
      listener = new SlackBotListener(client, { appToken: APP_TOKEN, debugReconnects: true })

      await listener.start()

      expect(MockWs.lastUrl).toBe('wss://wss.slack.com/?ticket=abc&debug_reconnects=true')
    })

    it('uses ? when URL has no existing query string', async () => {
      const client = createMockClient({
        appsConnectionsOpen: mock(() => Promise.resolve({ url: 'wss://wss.slack.com/' })),
      })
      listener = new SlackBotListener(client, { appToken: APP_TOKEN, debugReconnects: true })

      await listener.start()

      expect(MockWs.lastUrl).toBe('wss://wss.slack.com/?debug_reconnects=true')
    })
  })

  describe('hello envelope', () => {
    it('emits connected with app_id and num_connections', async () => {
      const client = createMockClient()
      listener = new SlackBotListener(client, { appToken: APP_TOKEN })

      const connected: any[] = []
      listener.on('connected', (info) => connected.push(info))

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()

      expect(connected.length).toBe(1)
      expect(connected[0].app_id).toBe('A_APP')
      expect(connected[0].num_connections).toBe(1)
    })

    it('resets reconnect attempts on hello', async () => {
      const client = createMockClient()
      listener = new SlackBotListener(client, { appToken: APP_TOKEN })

      await listener.start()
      ;(listener as any).reconnectAttempts = 5

      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()

      expect((listener as any).reconnectAttempts).toBe(0)
    })
  })

  describe('events_api envelope', () => {
    it('emits inner event type with ack and event payload', async () => {
      const client = createMockClient()
      listener = new SlackBotListener(client, { appToken: APP_TOKEN })

      const args: SlackSocketModeEventsApiArgs<SlackSocketModeMessageEvent>[] = []
      listener.on('message', (a) => args.push(a))

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      mockWsInstance.simulateEventsApi('env_001', {
        type: 'message',
        channel: 'C123',
        user: 'U456',
        text: 'hello',
        ts: '111.222',
      })

      expect(args.length).toBe(1)
      expect(args[0].envelope_id).toBe('env_001')
      expect(args[0].event.type).toBe('message')
      expect(args[0].event.channel).toBe('C123')
      expect(args[0].event.text).toBe('hello')
      expect(args[0].body.team_id).toBe('T_TEAM')
    })

    it('ack() sends envelope_id back over the WebSocket', async () => {
      const client = createMockClient()
      listener = new SlackBotListener(client, { appToken: APP_TOKEN })

      let captured: SlackSocketModeEventsApiArgs<SlackSocketModeMessageEvent> | null = null
      listener.on('message', (a) => {
        captured = a
      })

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      mockWsInstance.simulateEventsApi('env_002', { type: 'message', channel: 'C', ts: '1' })

      expect(captured).not.toBeNull()
      captured!.ack()

      expect(mockWsInstance.sent.length).toBe(1)
      expect(JSON.parse(mockWsInstance.sent[0])).toEqual({ envelope_id: 'env_002' })
    })

    it('ack(payload) sends envelope_id with response payload', async () => {
      const client = createMockClient()
      listener = new SlackBotListener(client, { appToken: APP_TOKEN })

      let captured: SlackSocketModeEventsApiArgs<SlackSocketModeMessageEvent> | null = null
      listener.on('message', (a) => {
        captured = a
      })

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      mockWsInstance.simulateEventsApi('env_003', { type: 'message', channel: 'C', ts: '1' })

      captured!.ack({ text: 'ok' })

      expect(mockWsInstance.sent.length).toBe(1)
      expect(JSON.parse(mockWsInstance.sent[0])).toEqual({
        envelope_id: 'env_003',
        payload: { text: 'ok' },
      })
    })

    it('ack is idempotent — only the first call hits the wire', async () => {
      const client = createMockClient()
      listener = new SlackBotListener(client, { appToken: APP_TOKEN })

      let captured: SlackSocketModeEventsApiArgs<SlackSocketModeMessageEvent> | null = null
      listener.on('message', (a) => {
        captured = a
      })

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      mockWsInstance.simulateEventsApi('env_004', { type: 'message', channel: 'C', ts: '1' })

      captured!.ack()
      captured!.ack({ retry: true })
      captured!.ack()

      expect(mockWsInstance.sent.length).toBe(1)
    })

    it('exposes retry_attempt and retry_reason', async () => {
      const client = createMockClient()
      listener = new SlackBotListener(client, { appToken: APP_TOKEN })

      const args: SlackSocketModeEventsApiArgs<SlackSocketModeMessageEvent>[] = []
      listener.on('message', (a) => args.push(a))

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      mockWsInstance.simulateEventsApi(
        'env_005',
        { type: 'message', channel: 'C', ts: '1' },
        { retry_attempt: 2, retry_reason: 'timeout' },
      )

      expect(args[0].retry_num).toBe(2)
      expect(args[0].retry_reason).toBe('timeout')
    })

    it('routes reaction_added to its own listener', async () => {
      const client = createMockClient()
      listener = new SlackBotListener(client, { appToken: APP_TOKEN })

      const reactions: SlackSocketModeEventsApiArgs<SlackSocketModeReactionEvent>[] = []
      listener.on('reaction_added', (a) => reactions.push(a))

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      mockWsInstance.simulateEventsApi('env_r1', {
        type: 'reaction_added',
        user: 'U1',
        reaction: 'thumbsup',
        item: { type: 'message', channel: 'C', ts: '1' },
        event_ts: '2',
      })

      expect(reactions.length).toBe(1)
      expect(reactions[0].event.reaction).toBe('thumbsup')
    })

    it('also emits slack_event for every events_api dispatch', async () => {
      const client = createMockClient()
      listener = new SlackBotListener(client, { appToken: APP_TOKEN })

      const generic: any[] = []
      listener.on('slack_event', (a) => generic.push(a))

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      mockWsInstance.simulateEventsApi('env_g1', { type: 'message', channel: 'C', ts: '1' })
      mockWsInstance.simulateEventsApi('env_g2', { type: 'app_mention', channel: 'C', user: 'U', text: 'hi', ts: '2' })

      expect(generic.length).toBe(2)
    })

    it('ignores events_api envelope with no inner event.type', async () => {
      const client = createMockClient()
      listener = new SlackBotListener(client, { appToken: APP_TOKEN })

      const events: any[] = []
      listener.on('slack_event', (a) => events.push(a))

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      mockWsInstance.simulateMessage({
        type: 'events_api',
        envelope_id: 'env_bad',
        payload: { event: {} },
      })

      expect(events.length).toBe(0)
    })
  })

  describe('slash_commands envelope', () => {
    it('emits slash_commands with ack and command payload', async () => {
      const client = createMockClient()
      listener = new SlackBotListener(client, { appToken: APP_TOKEN })

      const commands: SlackSocketModeSlashCommandArgs[] = []
      listener.on('slash_commands', (a) => commands.push(a))

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      mockWsInstance.simulateSlashCommand('env_sc1', {
        command: '/deploy',
        text: 'production',
        user_id: 'U1',
        channel_id: 'C1',
        team_id: 'T1',
      })

      expect(commands.length).toBe(1)
      expect(commands[0].body.command).toBe('/deploy')
      expect(commands[0].body.text).toBe('production')
      expect(commands[0].accepts_response_payload).toBe(true)

      commands[0].ack({ text: 'Deploying...' })

      expect(mockWsInstance.sent.length).toBe(1)
      expect(JSON.parse(mockWsInstance.sent[0])).toEqual({
        envelope_id: 'env_sc1',
        payload: { text: 'Deploying...' },
      })
    })
  })

  describe('interactive envelope', () => {
    it('emits interactive with ack and action payload', async () => {
      const client = createMockClient()
      listener = new SlackBotListener(client, { appToken: APP_TOKEN })

      const interactions: SlackSocketModeInteractiveArgs[] = []
      listener.on('interactive', (a) => interactions.push(a))

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      mockWsInstance.simulateInteractive('env_i1', {
        type: 'block_actions',
        user: { id: 'U1' },
        actions: [{ action_id: 'approve', value: 'PR-123' }],
      })

      expect(interactions.length).toBe(1)
      expect(interactions[0].body.type).toBe('block_actions')

      interactions[0].ack()

      expect(JSON.parse(mockWsInstance.sent[0])).toEqual({ envelope_id: 'env_i1' })
    })
  })

  describe('disconnect envelope', () => {
    it('closes the WebSocket on disconnect message (triggering reconnect)', async () => {
      const client = createMockClient()
      listener = new SlackBotListener(client, { appToken: APP_TOKEN })

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()

      const ws = mockWsInstance
      mockWsInstance.simulateDisconnect('refresh_requested')

      expect(ws.readyState).toBe(MockWs.CLOSED)
    })

    it('does not emit slack_event for disconnect envelopes', async () => {
      const client = createMockClient()
      listener = new SlackBotListener(client, { appToken: APP_TOKEN })

      const events: any[] = []
      listener.on('slack_event', (a) => events.push(a))

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      mockWsInstance.simulateDisconnect('warning')

      expect(events.length).toBe(0)
    })
  })

  describe('unknown envelope', () => {
    it('emits slack_event for envelopes the listener does not specifically handle', async () => {
      const client = createMockClient()
      listener = new SlackBotListener(client, { appToken: APP_TOKEN })

      const events: any[] = []
      listener.on('slack_event', (a) => events.push(a))

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      mockWsInstance.simulateMessage({ type: 'something_new', envelope_id: 'env_x', payload: { foo: 'bar' } })

      expect(events.length).toBe(1)
      expect(events[0].type).toBe('something_new')
    })
  })

  describe('malformed frames', () => {
    it('does not emit error or crash on invalid JSON', async () => {
      const client = createMockClient()
      listener = new SlackBotListener(client, { appToken: APP_TOKEN })

      const errors: Error[] = []
      listener.on('error', (e) => errors.push(e))

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateRawMessage('not json')

      expect(errors.length).toBe(0)
    })
  })

  describe('ping/pong', () => {
    it('clears the pong timeout when a pong is received', async () => {
      const client = createMockClient()
      listener = new SlackBotListener(client, { appToken: APP_TOKEN })

      await listener.start()
      mockWsInstance.simulateOpen()
      ;(listener as any).pongTimer = setTimeout(() => {}, 60_000)

      mockWsInstance.simulatePong()

      expect((listener as any).pongTimer).toBeNull()
    })
  })

  describe('stop', () => {
    it('closes the WebSocket and prevents reconnection', async () => {
      const client = createMockClient()
      listener = new SlackBotListener(client, { appToken: APP_TOKEN })

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()

      listener.stop()
      await new Promise((r) => setTimeout(r, 50))

      expect(client.appsConnectionsOpen).toHaveBeenCalledTimes(1)
    })

    it('ack after stop is a no-op', async () => {
      const client = createMockClient()
      listener = new SlackBotListener(client, { appToken: APP_TOKEN })

      let captured: SlackSocketModeEventsApiArgs<SlackSocketModeMessageEvent> | null = null
      listener.on('message', (a) => {
        captured = a
      })

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      mockWsInstance.simulateEventsApi('env_stop', { type: 'message', channel: 'C', ts: '1' })

      const ws = mockWsInstance
      listener.stop()
      ws.sent = []

      captured!.ack()

      expect(ws.sent.length).toBe(0)
    })
  })

  describe('reconnection', () => {
    it('reconnects after WebSocket close while running', async () => {
      const client = createMockClient()
      listener = new SlackBotListener(client, { appToken: APP_TOKEN })

      const disconnected: boolean[] = []
      listener.on('disconnected', () => disconnected.push(true))

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      mockWsInstance.simulateClose()

      expect(disconnected.length).toBe(1)

      await new Promise((r) => setTimeout(r, 1500))
      expect(client.appsConnectionsOpen.mock.calls.length).toBeGreaterThanOrEqual(2)
    })

    it('emits error and reconnects on appsConnectionsOpen network failure', async () => {
      let callCount = 0
      const client = createMockClient({
        appsConnectionsOpen: mock(() => {
          callCount++
          if (callCount === 1) return Promise.reject(new Error('network_error'))
          return Promise.resolve({ url: 'wss://wss.slack.com/?ticket=2' })
        }),
      })

      listener = new SlackBotListener(client, { appToken: APP_TOKEN })

      const errors: Error[] = []
      listener.on('error', (e) => errors.push(e))

      await listener.start()
      await new Promise((r) => setTimeout(r, 1500))

      expect(errors.length).toBe(1)
      expect(errors[0].message).toBe('network_error')
      expect(client.appsConnectionsOpen.mock.calls.length).toBeGreaterThanOrEqual(2)
    })

    it('does not reconnect on fatal Slack errors', async () => {
      const fatal: any = new Error('invalid auth')
      fatal.code = 'invalid_auth'

      const client = createMockClient({
        appsConnectionsOpen: mock(() => Promise.reject(fatal)),
      })

      listener = new SlackBotListener(client, { appToken: APP_TOKEN })

      const errors: Error[] = []
      listener.on('error', (e) => errors.push(e))

      await listener.start()
      await new Promise((r) => setTimeout(r, 1500))

      expect(errors.length).toBe(1)
      expect(client.appsConnectionsOpen).toHaveBeenCalledTimes(1)
    })

    it('does not reconnect on missing_app_token', async () => {
      const fatal: any = new Error('missing app token')
      fatal.code = 'missing_app_token'

      const client = createMockClient({
        appsConnectionsOpen: mock(() => Promise.reject(fatal)),
      })

      listener = new SlackBotListener(client, { appToken: APP_TOKEN })

      const errors: Error[] = []
      listener.on('error', (e) => errors.push(e))

      await listener.start()
      await new Promise((r) => setTimeout(r, 1500))

      expect(client.appsConnectionsOpen).toHaveBeenCalledTimes(1)
    })

    it('resets reconnectAttempts to 0 on hello after reconnect', async () => {
      const client = createMockClient()
      listener = new SlackBotListener(client, { appToken: APP_TOKEN })

      await listener.start()
      ;(listener as any).reconnectAttempts = 3
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()

      expect((listener as any).reconnectAttempts).toBe(0)
    })
  })

  describe('on/off/once', () => {
    it('off removes a listener', async () => {
      const client = createMockClient()
      listener = new SlackBotListener(client, { appToken: APP_TOKEN })

      const messages: any[] = []
      const handler = (a: any) => messages.push(a.event)
      listener.on('message', handler)

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      mockWsInstance.simulateEventsApi('e1', { type: 'message', channel: 'C', text: 'a', ts: '1' })

      listener.off('message', handler)
      mockWsInstance.simulateEventsApi('e2', { type: 'message', channel: 'C', text: 'b', ts: '2' })

      expect(messages.length).toBe(1)
      expect(messages[0].text).toBe('a')
    })

    it('once fires only once', async () => {
      const client = createMockClient()
      listener = new SlackBotListener(client, { appToken: APP_TOKEN })

      const messages: any[] = []
      listener.once('message', (a) => messages.push(a.event))

      await listener.start()
      mockWsInstance.simulateOpen()
      mockWsInstance.simulateHello()
      mockWsInstance.simulateEventsApi('e1', { type: 'message', channel: 'C', text: 'first', ts: '1' })
      mockWsInstance.simulateEventsApi('e2', { type: 'message', channel: 'C', text: 'second', ts: '2' })

      expect(messages.length).toBe(1)
      expect(messages[0].text).toBe('first')
    })
  })

  describe('generation guard', () => {
    it('ignores frames from a stale socket after stop/start', async () => {
      const client = createMockClient()
      listener = new SlackBotListener(client, { appToken: APP_TOKEN })

      const messages: any[] = []
      listener.on('message', (a) => messages.push(a.event))

      await listener.start()
      const staleWs = mockWsInstance
      staleWs.simulateOpen()

      listener.stop()
      await listener.start()

      staleWs.simulateMessage({
        type: 'events_api',
        envelope_id: 'stale',
        payload: { event: { type: 'message', channel: 'C', text: 'old', ts: '1' } },
      })

      expect(messages.length).toBe(0)
    })
  })
})
