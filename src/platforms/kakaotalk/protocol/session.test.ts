import { describe, expect, it, mock } from 'bun:test'

import { Long } from 'bson'

import {
  buildReactionActionBody,
  buildRewriteMessageBody,
  buildTypingActionBody,
  REACTION_ACTION_METHOD,
  REWRITE_MESSAGE_METHOD,
  sendReactionPacket,
  sendTypingPacket,
  TYPING_ACTION_METHOD,
  rewriteMessagePacket,
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
describe('reaction and rewrite wire contracts', () => {
  it('builds the ACTION reaction body with full-width ids and the selected type', () => {
    const body = buildReactionActionBody(Long.fromString('459750513901477'), Long.fromString('922337203685477000'), 1)

    expect((body.chatId as Long).toString()).toBe('459750513901477')
    expect((body.logId as Long).toString()).toBe('922337203685477000')
    expect(body.type).toBe(1)
    expect(Object.keys(body).sort()).toEqual(['chatId', 'logId', 'type'])
  })

  it('rejects invalid reaction types before sending a packet', () => {
    expect(() => buildReactionActionBody(Long.fromString('1'), Long.fromString('2'), 0)).toThrow(
      'reactionType must be a positive integer',
    )
    expect(() => buildReactionActionBody(Long.fromString('1'), Long.fromString('2'), 1.5)).toThrow(
      'reactionType must be a positive integer',
    )
  })

  it('builds the REWRITE body with the text message type', () => {
    const body = buildRewriteMessageBody(Long.fromString('123'), Long.fromString('456'), 'corrected')

    expect(body).toEqual({
      chatId: Long.fromString('123'),
      logId: Long.fromString('456'),
      msg: 'corrected',
      type: 1,
    })
  })

  it('sends ACTION and REWRITE through the live connection', async () => {
    const { connection, sent } = fakeConnection()

    await sendReactionPacket(connection, Long.fromString('123'), Long.fromString('456'), 1)
    await rewriteMessagePacket(connection, Long.fromString('123'), Long.fromString('456'), 'edited')

    expect(sent).toEqual([
      {
        method: REACTION_ACTION_METHOD,
        body: { chatId: Long.fromString('123'), logId: Long.fromString('456'), type: 1 },
      },
      {
        method: REWRITE_MESSAGE_METHOD,
        body: { chatId: Long.fromString('123'), logId: Long.fromString('456'), msg: 'edited', type: 1 },
      },
    ])
  })
})
