import { afterEach, describe, expect, mock, test } from 'bun:test'

import { KakaoTalkListener } from '@/platforms/kakaotalk/listener'
import type { LocoPacket } from '@/platforms/kakaotalk/protocol/types'
import type {
  KakaoTalkPushGenericEvent,
  KakaoTalkPushMemberEvent,
  KakaoTalkPushMessageEvent,
  KakaoTalkPushReadEvent,
} from '@/platforms/kakaotalk/types'

const mockLogin = mock(() => Promise.resolve({}))
const mockSessionClose = mock(() => {})

let mockSessionInstance: MockLocoSession

class MockLocoSession {
  pushHandler: ((packet: LocoPacket) => void) | null = null
  closeHandler: (() => void) | null = null
  login = mockLogin
  close = mockSessionClose

  constructor() {
    // oxlint-disable-next-line typescript-eslint/no-this-alias
    mockSessionInstance = this
  }

  onPush(handler: (packet: LocoPacket) => void): void {
    this.pushHandler = handler
  }

  onClose(handler: () => void): void {
    this.closeHandler = handler
  }

  simulatePush(method: string, body: Record<string, unknown>): void {
    this.pushHandler?.({ packetId: 0, statusCode: 0, method, bodyType: 0, body })
  }

  simulateClose(): void {
    this.closeHandler?.()
  }
}

mock.module('./protocol/session', () => ({ LocoSession: MockLocoSession }))

function createMockClient(overrides: Record<string, unknown> = {}) {
  return {
    getCredentials: mock(() => ({
      oauthToken: 'token',
      userId: 'user1',
      deviceUuid: 'device1',
      deviceType: 'tablet' as const,
    })),
    ...overrides,
  } as any
}

describe('KakaoTalkListener', () => {
  let listener: KakaoTalkListener

  afterEach(() => {
    listener?.stop()
    mockLogin.mockReset()
    mockLogin.mockResolvedValue({})
    mockSessionClose.mockReset()
  })

  describe('start', () => {
    test('calls login on LocoSession', async () => {
      const client = createMockClient()
      listener = new KakaoTalkListener(client)

      await listener.start()

      expect(mockLogin).toHaveBeenCalledTimes(1)
      expect(mockLogin).toHaveBeenCalledWith('token', 'user1', 'device1', undefined, 'tablet')
    })

    test('is idempotent', async () => {
      const client = createMockClient()
      listener = new KakaoTalkListener(client)

      await listener.start()
      await listener.start()

      expect(mockLogin).toHaveBeenCalledTimes(1)
    })
  })

  describe('connected event', () => {
    test('emits connected with userId after successful login', async () => {
      const client = createMockClient()
      listener = new KakaoTalkListener(client)

      const connected: Array<{ userId: string }> = []
      listener.on('connected', (info) => connected.push(info))

      await listener.start()

      expect(connected.length).toBe(1)
      expect(connected[0].userId).toBe('user1')
    })
  })

  describe('message events', () => {
    test('emits message on MSG push with parsed fields', async () => {
      const client = createMockClient()
      listener = new KakaoTalkListener(client)

      const messages: KakaoTalkPushMessageEvent[] = []
      listener.on('message', (event) => messages.push(event))

      await listener.start()
      mockSessionInstance.simulatePush('MSG', {
        chatId: { high: 0, low: 100 },
        chatLog: {
          logId: { high: 0, low: 200 },
          authorId: 42,
          message: 'hello world',
          type: 1,
          sendAt: 1700000000,
        },
      })

      expect(messages.length).toBe(1)
      expect(messages[0].type).toBe('MSG')
      expect(messages[0].chat_id).toBe('100')
      expect(messages[0].log_id).toBe('200')
      expect(messages[0].author_id).toBe(42)
      expect(messages[0].message).toBe('hello world')
      expect(messages[0].message_type).toBe(1)
      expect(messages[0].sent_at).toBe(1700000000)
    })
  })

  describe('member events', () => {
    test('emits member_joined on NEWMEM push', async () => {
      const client = createMockClient()
      listener = new KakaoTalkListener(client)

      const joined: KakaoTalkPushMemberEvent[] = []
      listener.on('member_joined', (event) => joined.push(event))

      await listener.start()
      mockSessionInstance.simulatePush('NEWMEM', {
        chatId: { high: 0, low: 100 },
        chatLog: { authorId: 42 },
      })

      expect(joined.length).toBe(1)
      expect(joined[0].type).toBe('NEWMEM')
      expect(joined[0].chat_id).toBe('100')
      expect(joined[0].member.user_id).toBe(42)
    })

    test('emits member_left on DELMEM push', async () => {
      const client = createMockClient()
      listener = new KakaoTalkListener(client)

      const left: KakaoTalkPushMemberEvent[] = []
      listener.on('member_left', (event) => left.push(event))

      await listener.start()
      mockSessionInstance.simulatePush('DELMEM', {
        chatId: { high: 0, low: 100 },
        chatLog: { authorId: 42 },
      })

      expect(left.length).toBe(1)
      expect(left[0].type).toBe('DELMEM')
      expect(left[0].chat_id).toBe('100')
      expect(left[0].member.user_id).toBe(42)
    })
  })

  describe('read events', () => {
    test('emits read on DECUNREAD push with watermark', async () => {
      const client = createMockClient()
      listener = new KakaoTalkListener(client)

      const reads: KakaoTalkPushReadEvent[] = []
      listener.on('read', (event) => reads.push(event))

      await listener.start()
      mockSessionInstance.simulatePush('DECUNREAD', {
        chatId: { high: 0, low: 100 },
        userId: 42,
        watermark: { high: 0, low: 999 },
      })

      expect(reads.length).toBe(1)
      expect(reads[0].type).toBe('DECUNREAD')
      expect(reads[0].chat_id).toBe('100')
      expect(reads[0].user_id).toBe(42)
      expect(reads[0].watermark).toBe('999')
    })
  })

  describe('kakaotalk_event catch-all', () => {
    test('emits kakaotalk_event for every push event', async () => {
      const client = createMockClient()
      listener = new KakaoTalkListener(client)

      const events: KakaoTalkPushGenericEvent[] = []
      listener.on('kakaotalk_event', (event) => events.push(event))

      await listener.start()
      mockSessionInstance.simulatePush('MSG', {
        chatId: { high: 0, low: 1 },
        chatLog: { logId: { high: 0, low: 2 }, authorId: 1, message: 'hi', type: 1, sendAt: 1 },
      })
      mockSessionInstance.simulatePush('NEWMEM', {
        chatId: { high: 0, low: 1 },
        chatLog: { authorId: 1 },
      })
      mockSessionInstance.simulatePush('CUSTOM_EVENT', { some: 'data' })

      expect(events.length).toBe(3)
      expect(events[0].type).toBe('MSG')
      expect(events[1].type).toBe('NEWMEM')
      expect(events[2].type).toBe('CUSTOM_EVENT')
    })
  })

  describe('stop', () => {
    test('closes session and prevents reconnection', async () => {
      const client = createMockClient()
      listener = new KakaoTalkListener(client)

      await listener.start()

      listener.stop()
      mockSessionInstance.simulateClose()

      await new Promise((r) => setTimeout(r, 50))
      expect(mockLogin).toHaveBeenCalledTimes(1)
    })
  })

  describe('reconnection', () => {
    test('reconnects on session close when still running', async () => {
      const client = createMockClient()
      listener = new KakaoTalkListener(client)

      const disconnected: boolean[] = []
      listener.on('disconnected', () => disconnected.push(true))

      await listener.start()
      mockSessionInstance.simulateClose()

      expect(disconnected.length).toBe(1)

      await new Promise((r) => setTimeout(r, 1500))
      expect(mockLogin.mock.calls.length).toBeGreaterThanOrEqual(2)
    })

    test('emits error and reconnects on login failure', async () => {
      let callCount = 0
      mockLogin.mockImplementation(() => {
        callCount++
        if (callCount === 1) return Promise.reject(new Error('network_error'))
        return Promise.resolve({})
      })

      const client = createMockClient()
      listener = new KakaoTalkListener(client)

      const errors: Error[] = []
      listener.on('error', (err) => errors.push(err))

      await listener.start()

      await new Promise((r) => setTimeout(r, 1500))

      expect(errors.length).toBe(1)
      expect(errors[0].message).toBe('network_error')
      expect(mockLogin.mock.calls.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('CHANGESVR', () => {
    test('resets reconnect attempts to 0 on CHANGESVR push', async () => {
      const client = createMockClient()
      listener = new KakaoTalkListener(client)

      await listener.start()
      ;(listener as any).reconnectAttempts = 5

      mockSessionInstance.simulatePush('CHANGESVR', {})

      expect((listener as any).reconnectAttempts).toBe(0)
    })
  })

  describe('KICKOUT', () => {
    test('emits error and stops without reconnecting', async () => {
      const client = createMockClient()
      listener = new KakaoTalkListener(client)

      const errors: Error[] = []
      listener.on('error', (err) => errors.push(err))

      await listener.start()
      mockSessionInstance.simulatePush('KICKOUT', {})

      expect(errors.length).toBe(1)
      expect(errors[0].message).toContain('kicked')
      expect((listener as any).running).toBe(false)

      await new Promise((r) => setTimeout(r, 50))
      expect(mockLogin).toHaveBeenCalledTimes(1)
    })
  })

  describe('on/off/once', () => {
    test('off removes listener', async () => {
      const client = createMockClient()
      listener = new KakaoTalkListener(client)

      const messages: KakaoTalkPushMessageEvent[] = []
      const handler = (event: KakaoTalkPushMessageEvent) => messages.push(event)
      listener.on('message', handler)

      await listener.start()
      mockSessionInstance.simulatePush('MSG', {
        chatId: { high: 0, low: 1 },
        chatLog: { logId: { high: 0, low: 1 }, authorId: 1, message: 'first', type: 1, sendAt: 1 },
      })

      listener.off('message', handler)
      mockSessionInstance.simulatePush('MSG', {
        chatId: { high: 0, low: 1 },
        chatLog: { logId: { high: 0, low: 2 }, authorId: 1, message: 'second', type: 1, sendAt: 2 },
      })

      expect(messages.length).toBe(1)
      expect(messages[0].message).toBe('first')
    })

    test('once fires only once', async () => {
      const client = createMockClient()
      listener = new KakaoTalkListener(client)

      const messages: KakaoTalkPushMessageEvent[] = []
      listener.once('message', (event) => messages.push(event))

      await listener.start()
      mockSessionInstance.simulatePush('MSG', {
        chatId: { high: 0, low: 1 },
        chatLog: { logId: { high: 0, low: 1 }, authorId: 1, message: 'first', type: 1, sendAt: 1 },
      })
      mockSessionInstance.simulatePush('MSG', {
        chatId: { high: 0, low: 1 },
        chatLog: { logId: { high: 0, low: 2 }, authorId: 1, message: 'second', type: 1, sendAt: 2 },
      })

      expect(messages.length).toBe(1)
      expect(messages[0].message).toBe('first')
    })
  })

  describe('start after stop', () => {
    test('resets reconnect attempts on fresh start', async () => {
      const client = createMockClient()
      listener = new KakaoTalkListener(client)

      await listener.start()
      ;(listener as any).reconnectAttempts = 5
      listener.stop()

      await listener.start()
      expect((listener as any).reconnectAttempts).toBe(0)
    })
  })
})
