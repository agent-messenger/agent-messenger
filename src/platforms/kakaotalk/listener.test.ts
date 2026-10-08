import { afterEach, describe, expect, it } from 'bun:test'

import type { KakaoSessionEvent, KakaoSessionEventHandler, KakaoPushHandler, KakaoTalkClient } from './client'
import { KakaoTalkListener } from './listener'
import type { LocoPacket } from './protocol/types'
import type {
  KakaoTalkPushEmoticonEvent,
  KakaoTalkPushGenericEvent,
  KakaoTalkPushMemberEvent,
  KakaoTalkPushMessageEvent,
  KakaoTalkPushReadEvent,
} from './types'

class FakeClient {
  acquireCalls = 0
  pushHandlers = new Set<KakaoPushHandler>()
  sessionHandlers = new Set<KakaoSessionEventHandler>()
  acquireImpl: () => Promise<void> = async () => {}
  connected = false
  lookupAuthorName: (chatId: string, authorId: number) => string | null = () => null

  async acquireSession(): Promise<unknown> {
    this.acquireCalls++
    await this.acquireImpl()
    this.connected = true
    return {}
  }

  isConnected(): boolean {
    return this.connected
  }

  getCredentials(): { oauthToken: string; userId: string; deviceUuid: string; deviceType: 'tablet' } {
    return { oauthToken: 'token', userId: 'user1', deviceUuid: 'device1', deviceType: 'tablet' }
  }

  onPush(handler: KakaoPushHandler): () => void {
    this.pushHandlers.add(handler)
    return () => this.pushHandlers.delete(handler)
  }

  onSessionEvent(handler: KakaoSessionEventHandler): () => void {
    this.sessionHandlers.add(handler)
    return () => this.sessionHandlers.delete(handler)
  }

  emitPush(method: string, body: Record<string, unknown>): void {
    const packet: LocoPacket = { packetId: 0, statusCode: 0, method, bodyType: 0, body }
    for (const handler of this.pushHandlers) handler(packet)
  }

  emitSessionEvent(event: KakaoSessionEvent): void {
    for (const handler of this.sessionHandlers) handler(event)
  }
}

function createListener(overrides: Partial<FakeClient> = {}): { listener: KakaoTalkListener; client: FakeClient } {
  const client = Object.assign(new FakeClient(), overrides)
  const listener = new KakaoTalkListener(client as unknown as KakaoTalkClient)
  return { listener, client }
}

describe('KakaoTalkListener', () => {
  let listener: KakaoTalkListener

  afterEach(() => {
    listener?.stop()
  })

  describe('start', () => {
    it('acquires the shared session from the client', async () => {
      const { listener: l, client } = createListener()
      listener = l

      await listener.start()

      expect(client.acquireCalls).toBe(1)
    })

    it('is idempotent', async () => {
      const { listener: l, client } = createListener()
      listener = l

      await listener.start()
      await listener.start()

      expect(client.acquireCalls).toBe(1)
    })
  })

  describe('connected event', () => {
    it('emits connected after acquiring an already-active session', async () => {
      const { listener: l, client } = createListener()
      listener = l
      client.connected = true

      const events: Array<{ userId: string }> = []
      listener.on('connected', (info) => events.push(info))

      await listener.start()

      expect(events.length).toBe(1)
      expect(events[0].userId).toBe('user1')
    })

    it('emits connected from session-event when client connects after listener starts', async () => {
      const { listener: l, client } = createListener()
      listener = l

      const events: Array<{ userId: string }> = []
      listener.on('connected', (info) => events.push(info))

      await listener.start()
      client.emitSessionEvent({ type: 'connected', userId: 'user1' })

      expect(events.length).toBe(1)
      expect(events[0].userId).toBe('user1')
    })
  })

  describe('message events', () => {
    it('emits message on MSG push with parsed fields', async () => {
      const { listener: l, client } = createListener()
      listener = l

      const messages: KakaoTalkPushMessageEvent[] = []
      listener.on('message', (event) => messages.push(event))

      await listener.start()
      client.emitPush('MSG', {
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
      expect(messages[0].author_name).toBeNull()
      expect(messages[0].message).toBe('hello world')
      expect(messages[0].message_type).toBe(1)
      expect(messages[0].sent_at).toBe(1700000000)
    })

    it('resolves author_name from client.lookupAuthorName when available', async () => {
      const { listener: l, client } = createListener()
      listener = l

      client.lookupAuthorName = (chatId: string, authorId: number) => {
        if (chatId === '100' && authorId === 42) return 'Alice'
        return null
      }

      const messages: KakaoTalkPushMessageEvent[] = []
      listener.on('message', (event) => messages.push(event))

      await listener.start()
      client.emitPush('MSG', {
        chatId: { high: 0, low: 100 },
        chatLog: {
          logId: { high: 0, low: 200 },
          authorId: 42,
          message: 'hello',
          type: 1,
          sendAt: 1700000000,
        },
      })

      expect(messages[0].author_name).toBe('Alice')
    })
  })

  describe('emoticon events', () => {
    it('emits emoticon on MSG push with type=20 (animated sticker)', async () => {
      const { listener: l, client } = createListener()
      listener = l

      const emoticons: KakaoTalkPushEmoticonEvent[] = []
      listener.on('emoticon', (event) => emoticons.push(event))

      await listener.start()
      client.emitPush('MSG', {
        chatId: { high: 0, low: 100 },
        chatLog: {
          logId: { high: 0, low: 200 },
          authorId: 42,
          message: '',
          type: 20,
          sendAt: 1700000000,
          attachment: '{"path":"4412724.emot_001.webp","emoticonItemPath":"4412724.emot_001.webp","name":"(emoticon)"}',
        },
      })

      expect(emoticons.length).toBe(1)
      expect(emoticons[0].type).toBe('EMOTICON')
      expect(emoticons[0].chat_id).toBe('100')
      expect(emoticons[0].log_id).toBe('200')
      expect(emoticons[0].author_id).toBe(42)
      expect(emoticons[0].message_type).toBe(20)
      expect(emoticons[0].emoticon_kind).toBe('sticker_ani')
      expect(emoticons[0].pack_id).toBe('4412724')
      expect(emoticons[0].sticker_path).toBe('4412724.emot_001.webp')
      expect(emoticons[0].sent_at).toBe(1700000000)
    })

    it('emits emoticon on MSG push with type=12 (static sticker)', async () => {
      const { listener: l, client } = createListener()
      listener = l

      const emoticons: KakaoTalkPushEmoticonEvent[] = []
      listener.on('emoticon', (event) => emoticons.push(event))

      await listener.start()
      client.emitPush('MSG', {
        chatId: { high: 0, low: 100 },
        chatLog: {
          logId: { high: 0, low: 201 },
          authorId: 42,
          message: '',
          type: 12,
          sendAt: 1700000001,
          attachment: '{"path":"2222149.emot_004.png","emoticonItemPath":"2222149.emot_004.png","name":"(emoticon)"}',
        },
      })

      expect(emoticons.length).toBe(1)
      expect(emoticons[0].emoticon_kind).toBe('sticker')
      expect(emoticons[0].pack_id).toBe('2222149')
      expect(emoticons[0].sticker_path).toBe('2222149.emot_004.png')
    })

    it.each([
      [6, 'ditem_emoticon' as const],
      [22, 'actioncon' as const],
      [25, 'sticker_gif' as const],
    ])('maps message_type=%i to emoticon_kind=%s', async (msgType, expectedKind) => {
      const { listener: l, client } = createListener()
      listener = l

      const emoticons: KakaoTalkPushEmoticonEvent[] = []
      listener.on('emoticon', (event) => emoticons.push(event))

      await listener.start()
      client.emitPush('MSG', {
        chatId: { high: 0, low: 100 },
        chatLog: {
          logId: { high: 0, low: 202 },
          authorId: 42,
          message: '',
          type: msgType,
          sendAt: 1700000002,
          attachment: '{"path":"9999999.emot_001.webp"}',
        },
      })

      expect(emoticons[0].emoticon_kind).toBe(expectedKind)
    })

    it('still emits the message event for back-compat when emoticon arrives', async () => {
      const { listener: l, client } = createListener()
      listener = l

      const messages: KakaoTalkPushMessageEvent[] = []
      const emoticons: KakaoTalkPushEmoticonEvent[] = []
      listener.on('message', (event) => messages.push(event))
      listener.on('emoticon', (event) => emoticons.push(event))

      await listener.start()
      client.emitPush('MSG', {
        chatId: { high: 0, low: 100 },
        chatLog: {
          logId: { high: 0, low: 203 },
          authorId: 42,
          message: '',
          type: 12,
          sendAt: 1700000003,
          attachment: '{"path":"2222149.emot_004.png"}',
        },
      })

      expect(messages.length).toBe(1)
      expect(messages[0].message_type).toBe(12)
      expect(emoticons.length).toBe(1)
    })

    it('does not emit emoticon for non-sticker types', async () => {
      const { listener: l, client } = createListener()
      listener = l

      const emoticons: KakaoTalkPushEmoticonEvent[] = []
      listener.on('emoticon', (event) => emoticons.push(event))

      await listener.start()
      client.emitPush('MSG', {
        chatId: { high: 0, low: 100 },
        chatLog: {
          logId: { high: 0, low: 204 },
          authorId: 42,
          message: 'hello',
          type: 1,
          sendAt: 1700000004,
          attachment: '{}',
        },
      })

      expect(emoticons.length).toBe(0)
    })

    it('emits emoticon with null fields when attachment is malformed JSON', async () => {
      const { listener: l, client } = createListener()
      listener = l

      const emoticons: KakaoTalkPushEmoticonEvent[] = []
      listener.on('emoticon', (event) => emoticons.push(event))

      await listener.start()
      client.emitPush('MSG', {
        chatId: { high: 0, low: 100 },
        chatLog: {
          logId: { high: 0, low: 205 },
          authorId: 42,
          message: '',
          type: 12,
          sendAt: 1700000005,
          attachment: 'not-json',
        },
      })

      expect(emoticons.length).toBe(1)
      expect(emoticons[0].sticker_path).toBeNull()
      expect(emoticons[0].pack_id).toBeNull()
    })

    it('emits emoticon with null fields when attachment is missing', async () => {
      const { listener: l, client } = createListener()
      listener = l

      const emoticons: KakaoTalkPushEmoticonEvent[] = []
      listener.on('emoticon', (event) => emoticons.push(event))

      await listener.start()
      client.emitPush('MSG', {
        chatId: { high: 0, low: 100 },
        chatLog: {
          logId: { high: 0, low: 206 },
          authorId: 42,
          message: '',
          type: 20,
          sendAt: 1700000006,
        },
      })

      expect(emoticons.length).toBe(1)
      expect(emoticons[0].sticker_path).toBeNull()
      expect(emoticons[0].pack_id).toBeNull()
    })

    it('falls back to emoticonItemPath when path is absent', async () => {
      const { listener: l, client } = createListener()
      listener = l

      const emoticons: KakaoTalkPushEmoticonEvent[] = []
      listener.on('emoticon', (event) => emoticons.push(event))

      await listener.start()
      client.emitPush('MSG', {
        chatId: { high: 0, low: 100 },
        chatLog: {
          logId: { high: 0, low: 207 },
          authorId: 42,
          message: '',
          type: 12,
          sendAt: 1700000007,
          attachment: '{"emoticonItemPath":"3333.emot_009.png"}',
        },
      })

      expect(emoticons[0].sticker_path).toBe('3333.emot_009.png')
      expect(emoticons[0].pack_id).toBe('3333')
    })

    it('does not throw or leak invalid types when attachment.path is a non-string', async () => {
      const { listener: l, client } = createListener()
      listener = l

      const emoticons: KakaoTalkPushEmoticonEvent[] = []
      listener.on('emoticon', (event) => emoticons.push(event))

      await listener.start()
      client.emitPush('MSG', {
        chatId: { high: 0, low: 100 },
        chatLog: {
          logId: { high: 0, low: 208 },
          authorId: 42,
          message: '',
          type: 12,
          sendAt: 1700000008,
          attachment: '{"path":12345,"emoticonItemPath":null,"name":{"nested":"obj"}}',
        },
      })

      expect(emoticons.length).toBe(1)
      expect(emoticons[0].sticker_path).toBeNull()
      expect(emoticons[0].pack_id).toBeNull()
    })
  })

  describe('attachment field', () => {
    it('parses chatLog.attachment JSON into a structured field', async () => {
      const { listener: l, client } = createListener()
      listener = l

      const messages: KakaoTalkPushMessageEvent[] = []
      listener.on('message', (event) => messages.push(event))

      await listener.start()
      client.emitPush('MSG', {
        chatId: { high: 0, low: 100 },
        chatLog: {
          logId: { high: 0, low: 200 },
          authorId: 42,
          message: '사진',
          type: 2,
          sendAt: 1700000000,
          attachment:
            '{"k":"abc/photo.jpg","w":1320,"h":2868,"s":438315,"mt":"image/jpeg","url":"https://talk.kakaocdn.net/p"}',
        },
      })

      expect(messages[0].attachment).toEqual({
        k: 'abc/photo.jpg',
        w: 1320,
        h: 2868,
        s: 438315,
        mt: 'image/jpeg',
        url: 'https://talk.kakaocdn.net/p',
      })
    })

    it('keeps 64-bit ids inside a pushed reply attachment exact', async () => {
      const { listener: l, client } = createListener()
      listener = l

      const messages: KakaoTalkPushMessageEvent[] = []
      listener.on('message', (event) => messages.push(event))

      await listener.start()
      client.emitPush('MSG', {
        chatId: { high: 0, low: 100 },
        chatLog: {
          logId: { high: 0, low: 201 },
          authorId: 42,
          message: 'reply',
          type: 26,
          sendAt: 1700000000,
          attachment: '{"src_logId":3947068532267313155,"src_userId":446784507,"src_type":1}',
        },
      })

      expect(messages[0].attachment).toEqual({ src_logId: '3947068532267313155', src_userId: 446784507, src_type: 1 })
    })

    it('returns null when attachment is "{}" (text messages have no payload)', async () => {
      const { listener: l, client } = createListener()
      listener = l

      const messages: KakaoTalkPushMessageEvent[] = []
      listener.on('message', (event) => messages.push(event))

      await listener.start()
      client.emitPush('MSG', {
        chatId: { high: 0, low: 100 },
        chatLog: {
          logId: { high: 0, low: 201 },
          authorId: 42,
          message: 'hi',
          type: 1,
          sendAt: 1700000001,
          attachment: '{}',
        },
      })

      expect(messages[0].attachment).toBeNull()
    })

    it('returns null when attachment is absent', async () => {
      const { listener: l, client } = createListener()
      listener = l

      const messages: KakaoTalkPushMessageEvent[] = []
      listener.on('message', (event) => messages.push(event))

      await listener.start()
      client.emitPush('MSG', {
        chatId: { high: 0, low: 100 },
        chatLog: {
          logId: { high: 0, low: 202 },
          authorId: 42,
          message: 'hi',
          type: 1,
          sendAt: 1700000002,
        },
      })

      expect(messages[0].attachment).toBeNull()
    })

    it('returns null when attachment is an empty string', async () => {
      const { listener: l, client } = createListener()
      listener = l

      const messages: KakaoTalkPushMessageEvent[] = []
      listener.on('message', (event) => messages.push(event))

      await listener.start()
      client.emitPush('MSG', {
        chatId: { high: 0, low: 100 },
        chatLog: {
          logId: { high: 0, low: 203 },
          authorId: 42,
          message: '',
          type: 1,
          sendAt: 1700000003,
          attachment: '',
        },
      })

      expect(messages[0].attachment).toBeNull()
    })

    it('returns null when attachment is malformed JSON', async () => {
      const { listener: l, client } = createListener()
      listener = l

      const messages: KakaoTalkPushMessageEvent[] = []
      listener.on('message', (event) => messages.push(event))

      await listener.start()
      client.emitPush('MSG', {
        chatId: { high: 0, low: 100 },
        chatLog: {
          logId: { high: 0, low: 204 },
          authorId: 42,
          message: '',
          type: 1,
          sendAt: 1700000004,
          attachment: 'not-json{',
        },
      })

      expect(messages[0].attachment).toBeNull()
    })

    it('returns null when attachment is a JSON array (non-object)', async () => {
      const { listener: l, client } = createListener()
      listener = l

      const messages: KakaoTalkPushMessageEvent[] = []
      listener.on('message', (event) => messages.push(event))

      await listener.start()
      client.emitPush('MSG', {
        chatId: { high: 0, low: 100 },
        chatLog: {
          logId: { high: 0, low: 205 },
          authorId: 42,
          message: '',
          type: 1,
          sendAt: 1700000005,
          attachment: '[1,2,3]',
        },
      })

      expect(messages[0].attachment).toBeNull()
    })
  })

  describe('member events', () => {
    it('emits member_joined on NEWMEM push', async () => {
      const { listener: l, client } = createListener()
      listener = l

      const joined: KakaoTalkPushMemberEvent[] = []
      listener.on('member_joined', (event) => joined.push(event))

      await listener.start()
      client.emitPush('NEWMEM', {
        chatId: { high: 0, low: 100 },
        chatLog: { authorId: 42 },
      })

      expect(joined.length).toBe(1)
      expect(joined[0].type).toBe('NEWMEM')
      expect(joined[0].chat_id).toBe('100')
      expect(joined[0].member.user_id).toBe(42)
    })

    it('emits member_left on DELMEM push', async () => {
      const { listener: l, client } = createListener()
      listener = l

      const left: KakaoTalkPushMemberEvent[] = []
      listener.on('member_left', (event) => left.push(event))

      await listener.start()
      client.emitPush('DELMEM', {
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
    it('emits read on DECUNREAD push with watermark', async () => {
      const { listener: l, client } = createListener()
      listener = l

      const reads: KakaoTalkPushReadEvent[] = []
      listener.on('read', (event) => reads.push(event))

      await listener.start()
      client.emitPush('DECUNREAD', {
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
    it('emits kakaotalk_event for every push event', async () => {
      const { listener: l, client } = createListener()
      listener = l

      const events: KakaoTalkPushGenericEvent[] = []
      listener.on('kakaotalk_event', (event) => events.push(event))

      await listener.start()
      client.emitPush('MSG', {
        chatId: { high: 0, low: 1 },
        chatLog: { logId: { high: 0, low: 2 }, authorId: 1, message: 'hi', type: 1, sendAt: 1 },
      })
      client.emitPush('NEWMEM', {
        chatId: { high: 0, low: 1 },
        chatLog: { authorId: 1 },
      })
      client.emitPush('CUSTOM_EVENT', { some: 'data' })

      expect(events.length).toBe(3)
      expect(events[0].type).toBe('MSG')
      expect(events[1].type).toBe('NEWMEM')
      expect(events[2].type).toBe('CUSTOM_EVENT')
    })
  })

  describe('stop', () => {
    it('unsubscribes from client push and session events', async () => {
      const { listener: l, client } = createListener()
      listener = l

      await listener.start()
      expect(client.pushHandlers.size).toBe(1)
      expect(client.sessionHandlers.size).toBe(1)

      listener.stop()

      expect(client.pushHandlers.size).toBe(0)
      expect(client.sessionHandlers.size).toBe(0)
    })
  })

  describe('disconnected event', () => {
    it('emits disconnected when the client session drops', async () => {
      const { listener: l, client } = createListener()
      listener = l

      const disconnects: number[] = []
      listener.on('disconnected', () => disconnects.push(1))

      await listener.start()
      client.emitSessionEvent({ type: 'disconnected' })

      expect(disconnects.length).toBe(1)
    })
  })

  describe('KICKOUT', () => {
    it('emits error and stops the listener when the client reports a kicked session', async () => {
      const { listener: l, client } = createListener()
      listener = l

      const errors: Error[] = []
      listener.on('error', (err) => errors.push(err))

      await listener.start()
      client.emitSessionEvent({ type: 'kicked', reason: 'Session kicked — another device logged in' })

      expect(errors.length).toBe(1)
      expect(errors[0].message).toContain('kicked')
      expect((listener as unknown as { running: boolean }).running).toBe(false)
      expect(client.pushHandlers.size).toBe(0)
      expect(client.sessionHandlers.size).toBe(0)
    })
  })

  describe('on/off/once', () => {
    it('off removes listener', async () => {
      const { listener: l, client } = createListener()
      listener = l

      const messages: KakaoTalkPushMessageEvent[] = []
      const handler = (event: KakaoTalkPushMessageEvent) => messages.push(event)
      listener.on('message', handler)

      await listener.start()
      client.emitPush('MSG', {
        chatId: { high: 0, low: 1 },
        chatLog: { logId: { high: 0, low: 1 }, authorId: 1, message: 'first', type: 1, sendAt: 1 },
      })

      listener.off('message', handler)
      client.emitPush('MSG', {
        chatId: { high: 0, low: 1 },
        chatLog: { logId: { high: 0, low: 2 }, authorId: 1, message: 'second', type: 1, sendAt: 2 },
      })

      expect(messages.length).toBe(1)
      expect(messages[0].message).toBe('first')
    })

    it('once fires only once', async () => {
      const { listener: l, client } = createListener()
      listener = l

      const messages: KakaoTalkPushMessageEvent[] = []
      listener.once('message', (event) => messages.push(event))

      await listener.start()
      client.emitPush('MSG', {
        chatId: { high: 0, low: 1 },
        chatLog: { logId: { high: 0, low: 1 }, authorId: 1, message: 'first', type: 1, sendAt: 1 },
      })
      client.emitPush('MSG', {
        chatId: { high: 0, low: 1 },
        chatLog: { logId: { high: 0, low: 2 }, authorId: 1, message: 'second', type: 1, sendAt: 2 },
      })

      expect(messages.length).toBe(1)
      expect(messages[0].message).toBe('first')
    })
  })

  describe('error during start', () => {
    it('emits error and tears down subscriptions when acquireSession fails', async () => {
      const client = new FakeClient()
      client.acquireImpl = async () => {
        throw new Error('login_failed')
      }
      const l = new KakaoTalkListener(client as unknown as KakaoTalkClient)
      listener = l

      const errors: Error[] = []
      listener.on('error', (err) => errors.push(err))

      await listener.start()

      expect(errors.length).toBe(1)
      expect(errors[0].message).toBe('login_failed')
      expect(client.pushHandlers.size).toBe(0)
      expect(client.sessionHandlers.size).toBe(0)
    })

    it('can be restarted after a failed start()', async () => {
      // given — a client whose first acquire fails but later succeeds
      const client = new FakeClient()
      let attempts = 0
      client.acquireImpl = async () => {
        attempts++
        if (attempts === 1) throw new Error('login_failed')
      }
      const l = new KakaoTalkListener(client as unknown as KakaoTalkClient)
      listener = l

      const errors: Error[] = []
      listener.on('error', (err) => errors.push(err))

      // when — first start() fails, then we try again
      await listener.start()
      expect(errors.length).toBe(1)

      await listener.start()

      // then — second start succeeds (subscriptions re-attached, acquire was retried)
      expect(attempts).toBe(2)
      expect(client.pushHandlers.size).toBe(1)
      expect(client.sessionHandlers.size).toBe(1)
    })
  })
})
