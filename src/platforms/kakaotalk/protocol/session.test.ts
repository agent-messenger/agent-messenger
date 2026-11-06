import { describe, expect, it, mock } from 'bun:test'

import { Long } from 'bson'

import {
  buildKickListDeleteBody,
  buildKickListSyncBody,
  buildKickMemberBody,
  buildReplyWriteBody,
  buildTextWriteBody,
  buildTypingActionBody,
  sendTypingPacket,
  TYPING_ACTION_METHOD,
} from './session'
import type { LocoPacket } from './types'

type SentPacket = { method: string; body: Record<string, unknown> }

// Fake connection object that captures every sendPacket call. We test
// sendTypingPacket (the extracted wire-boundary function) directly rather than
// the LocoSession class method — LocoSession.sendTyping is a two-line delegation
// to this helper, and testing the class would require mock.module('./session',
// …) which collides with client.test.ts's LocoSession mock.
function fakeConnection(returnPacket: LocoPacket = { statusCode: 0, body: {} }): {
  connection: { sendPacket: (method: string, body: Record<string, unknown>) => Promise<LocoPacket> }
  sent: SentPacket[]
  sendPacketMock: ReturnType<typeof mock>
} {
  const sent: SentPacket[] = []
  const sendPacketMock = mock(async (method: string, body: Record<string, unknown>) => {
    sent.push({ method, body })
    return returnPacket
  })
  return { connection: { sendPacket: sendPacketMock }, sent, sendPacketMock }
}

describe('typing indicator wire contract', () => {
  it('TYPING_ACTION_METHOD is the exact string "ACTION" that KakaoTalk expects on the wire', () => {
    expect(TYPING_ACTION_METHOD).toBe('ACTION')
  })

  it('emits type=1 and omits linkId entirely for normal chats', () => {
    const body = buildTypingActionBody(Long.fromString('459750513901477'))

    expect((body.chatId as { toString(): string }).toString()).toBe('459750513901477')
    expect(body.type).toBe(1)
    expect('linkId' in body).toBe(false)
  })

  it('includes linkId when provided (open-chat pulse)', () => {
    const body = buildTypingActionBody(Long.fromString('123'), Long.fromString('77777'))

    expect(body.type).toBe(1)
    expect((body.linkId as { toString(): string }).toString()).toBe('77777')
  })

  it('never sets linkId=null when caller passes undefined (would change server routing)', () => {
    const body = buildTypingActionBody(Long.fromString('123'), undefined)

    expect(body.linkId).toBeUndefined()
    expect('linkId' in body).toBe(false)
  })

  it('body only carries chatId + type for normal chats (no stray fields)', () => {
    const body = buildTypingActionBody(Long.fromString('123'))

    expect(Object.keys(body).sort()).toEqual(['chatId', 'type'])
  })

  it('body only carries chatId + type + linkId for open chats (no stray fields)', () => {
    const body = buildTypingActionBody(Long.fromString('123'), Long.fromString('77777'))

    expect(Object.keys(body).sort()).toEqual(['chatId', 'linkId', 'type'])
  })
})

describe('sendTypingPacket → sendPacket wire boundary', () => {
  it('calls connection.sendPacket("ACTION", body) exactly once for a normal chat, with full-width Long chatId preserved', async () => {
    const { connection, sent, sendPacketMock } = fakeConnection()

    await sendTypingPacket(connection, Long.fromString('459750513901477'))

    expect(sendPacketMock).toHaveBeenCalledTimes(1)
    expect(sent).toHaveLength(1)
    const packet = sent[0]!
    expect(packet.method).toBe('ACTION')
    expect((packet.body.chatId as Long).toString()).toBe('459750513901477')
    expect(packet.body.type).toBe(1)
    expect('linkId' in packet.body).toBe(false)
  })

  it('calls sendPacket with full-width Long linkId preserved for an open-chat pulse', async () => {
    const { connection, sent } = fakeConnection()

    await sendTypingPacket(connection, Long.fromString('459750513901477'), Long.fromString('280368495100000'))

    const packet = sent[0]!
    expect(packet.method).toBe('ACTION')
    expect((packet.body.chatId as Long).toString()).toBe('459750513901477')
    expect((packet.body.linkId as Long).toString()).toBe('280368495100000')
    expect(packet.body.type).toBe(1)
  })

  it('propagates the LocoPacket returned by sendPacket verbatim', async () => {
    const expected = { statusCode: 0, body: { hello: 'world' } }
    const { connection } = fakeConnection(expected)

    const result = await sendTypingPacket(connection, Long.fromString('123'))

    expect(result).toBe(expected)
  })

  it('emits the same wire packet the reverse-engineered client builds (spec-lock)', async () => {
    const { connection, sent } = fakeConnection()

    await sendTypingPacket(connection, Long.fromString('123'), Long.fromString('456'))

    const packet = sent[0]!
    expect(packet.method).toBe(TYPING_ACTION_METHOD)
    expect(packet.body).toEqual(buildTypingActionBody(Long.fromString('123'), Long.fromString('456')))
  })
})

describe('reply WRITE wire contract', () => {
  it('writes src_logId and src_userId as exact bare integers in the extra JSON', () => {
    const body = buildReplyWriteBody(Long.fromString('459750513901477'), 'hi', {
      attach_only: false,
      attach_type: 1,
      src_logId: '3947068532267313155',
      src_userId: '7467363552057858123',
      src_message: 'q',
      src_type: 1,
      src_mentions: [],
      mentions: [],
    })

    expect(body.type).toBe(26)
    expect(body.msg).toBe('hi')
    expect(body).not.toHaveProperty('li')
    expect(body.extra).toBe(
      '{"attach_only":false,"attach_type":1,"src_logId":3947068532267313155,"src_userId":7467363552057858123,"src_message":"q","src_type":1,"src_mentions":[],"mentions":[]}',
    )
  })

  it('writes src_linkId as a bare integer when present', () => {
    const body = buildReplyWriteBody(Long.fromString('1'), 'hi', {
      attach_only: false,
      attach_type: 1,
      src_logId: '2',
      src_userId: '3',
      src_message: '',
      src_type: 1,
      src_mentions: [],
      mentions: [],
      src_linkId: '9007199254740993',
    })

    expect(body.extra).toContain('"src_linkId":9007199254740993')
    expect(body).not.toHaveProperty('li')
  })
})

describe('mention WRITE wire contract', () => {
  it('omits extra for a plain text message', () => {
    const body = buildTextWriteBody(Long.fromString('1'), 'hello')

    expect(body).toEqual({ chatId: Long.fromString('1'), msg: 'hello', type: 1, noSeen: false })
    expect(body).not.toHaveProperty('extra')
  })

  it('carries mentions in the extra JSON of a type-1 WRITE with exact user ids', () => {
    const body = buildTextWriteBody(Long.fromString('1'), '@Alice @Bob', [
      { user_id: '7467363552057858123', at: [1], len: 5 },
      { user_id: '42', at: [2], len: 3 },
    ])

    expect(body.type).toBe(1)
    expect(body.msg).toBe('@Alice @Bob')
    expect(body.extra).toBe(
      '{"mentions":[{"at":[1],"len":5,"user_id":7467363552057858123},{"at":[2],"len":3,"user_id":42}]}',
    )
  })

  it('writes reply mentions with exact user ids', () => {
    const body = buildReplyWriteBody(Long.fromString('1'), '@Alice ok', {
      attach_only: false,
      attach_type: 1,
      src_logId: '2',
      src_userId: '3',
      src_message: 'q',
      src_type: 1,
      src_mentions: [],
      mentions: [{ user_id: '7467363552057858123', at: [1], len: 5 }],
    })

    expect(body.type).toBe(26)
    expect(body.extra).toContain('"mentions":[{"at":[1],"len":5,"user_id":7467363552057858123}]')
  })
})

describe('open chat moderation wire contract', () => {
  it('KICKMEM body uses the short c/li/mid keys with full-width Longs', () => {
    const body = buildKickMemberBody(
      Long.fromString('459750513901477'),
      Long.fromString('280368495100000'),
      Long.fromString('7467363552057858123'),
    )

    expect(Object.keys(body).sort()).toEqual(['c', 'li', 'mid'])
    expect((body.c as Long).toString()).toBe('459750513901477')
    expect((body.li as Long).toString()).toBe('280368495100000')
    expect((body.mid as Long).toString()).toBe('7467363552057858123')
  })

  it('KLSYNC body only carries the link id', () => {
    const body = buildKickListSyncBody(Long.fromString('280368495100000'))

    expect(Object.keys(body)).toEqual(['li'])
    expect((body.li as Long).toString()).toBe('280368495100000')
  })

  it('KLDELITEM body uses the short li/c/kid keys with full-width Longs', () => {
    const body = buildKickListDeleteBody(
      Long.fromString('280368495100000'),
      Long.fromString('459750513901477'),
      Long.fromString('7467363552057858123'),
    )

    expect(Object.keys(body).sort()).toEqual(['c', 'kid', 'li'])
    expect((body.li as Long).toString()).toBe('280368495100000')
    expect((body.c as Long).toString()).toBe('459750513901477')
    expect((body.kid as Long).toString()).toBe('7467363552057858123')
  })
})

describe('common WRITE headers', () => {
  it('preserves payload extras and validates boolean options', async () => {
    const { buildWriteBody } = await import('./session')
    const extra = '{"mentions":[{"user_id":9007199254740993}]}'
    const body = buildWriteBody({ chatId: Long.ONE, type: 1, extra }, Long.fromNumber(123), { silence: true })
    expect(body).toMatchObject({ scope: 1, silence: true, noSeen: false, extra })
    expect((body.msgId as Long).toNumber()).toBe(123)
    expect(buildWriteBody({ type: 26, extra }, Long.ONE).extra).toBe(extra)
    expect(buildWriteBody({ type: 18, extra: '{"name":"fixture.txt"}' }, Long.ONE).extra).toContain('fixture.txt')
    expect(buildWriteBody({}, Long.ONE).extra).toBe('{}')
    expect(() => buildWriteBody({}, Long.ONE, { silence: 'true' as unknown as boolean })).toThrow(TypeError)
  })
})

describe('messaging transport selection', () => {
  it('uses verified TLS settings for tablets and preserves the desktop transport', async () => {
    const { connectMessagingServer } = await import('./session')
    const calls: Array<{ kind: string; port: number; options?: import('node:tls').ConnectionOptions }> = []
    const connection = {
      connectTls: async (_host: string, port: number, options?: import('node:tls').ConnectionOptions) => {
        calls.push({ kind: 'tls', port, options })
      },
      connectSecure: async (_host: string, port: number) => {
        calls.push({ kind: 'legacy', port })
      },
    }
    await connectMessagingServer(connection, 'fixture.invalid', 5242, 'tablet')
    expect(calls[0]).toMatchObject({
      kind: 'tls',
      port: 10009,
      options: { servername: 'kakao.com', ecdhCurve: 'X25519:P-256:P-384' },
    })
    expect(calls[0]!.options!.ciphers!.split(':').slice(0, 3)).toEqual([
      'TLS_AES_128_GCM_SHA256',
      'TLS_AES_256_GCM_SHA384',
      'TLS_CHACHA20_POLY1305_SHA256',
    ])
    await connectMessagingServer(connection, 'fixture.invalid', 5242, 'pc')
    expect(calls[1]).toEqual({ kind: 'legacy', port: 5242 })
  })
})

describe('configurable protocol fields', () => {
  it('keeps login defaults while allowing explicit identity and revision values', async () => {
    const { buildLoginFields } = await import('./session')
    const defaults = buildLoginFields()
    expect(defaults.checkin).toEqual({ countryISO: 'KR' })
    expect(defaults.login.isSw).toBe(false)
    expect((defaults.login.rp as import('bson').Binary).buffer.toString('hex')).toBe('0000ffff0000')
    const overridden = buildLoginFields({
      countryISO: 'US',
      isSwitching: true,
      blockRevision: 65535,
      plusBlockRevision: 42,
    })
    expect(overridden.checkin).toEqual({ countryISO: 'US' })
    expect(overridden.login.isSw).toBe(true)
    expect((overridden.login.rp as import('bson').Binary).buffer.toString('hex')).toBe('ffffffff2a00')
    const omitted = buildLoginFields({ countryISO: null, isSwitching: null })
    expect(omitted.checkin).toEqual({})
    expect(omitted.login).not.toHaveProperty('isSw')
    for (const value of [-1, 65536, 1.5, NaN]) expect(() => buildLoginFields({ blockRevision: value })).toThrow()
    expect(() => buildLoginFields({ countryISO: 'usa' })).toThrow()
    expect(() => buildLoginFields({ isSwitching: 'false' as unknown as boolean })).toThrow()
  })

  it('preserves explicit visibility, thread ids and raw extras without replacing typed payloads', async () => {
    const { buildWriteBody } = await import('./session')
    const extra = '{"custom":9007199254740993}'
    for (const scope of [1, 2, 3] as const) {
      const body = buildWriteBody({}, Long.ONE, {
        scope,
        threadId: '9007199254740993',
        extra,
        silence: true,
        noSeen: true,
      })
      expect(body).toMatchObject({ scope, extra, silence: true, noSeen: true })
      expect((body.threadId as Long).toString()).toBe('9007199254740993')
    }
    expect(() => buildWriteBody({}, Long.ONE, { scope: 0 as 1 })).toThrow()
    expect(() => buildWriteBody({}, Long.ONE, { threadId: '9223372036854775808' })).toThrow()
    expect(() => buildWriteBody({}, Long.ONE, { extra: '[]' })).toThrow()
    expect(() => buildWriteBody({ extra: '{"src_logId":9007199254740993}' }, Long.ONE, { extra })).toThrow()
  })
})
