import { describe, expect, it } from 'bun:test'

import { computeReadStatus, extractReadWatermarks } from './read-status'

describe('extractReadWatermarks', () => {
  it('pairs CHATONROOM member ids with their watermarks', () => {
    const body = {
      a: [{ low: 7, high: 0 }, 9],
      w: [
        { low: 100, high: 0 },
        { low: 0, high: 1 },
      ],
    }
    expect(extractReadWatermarks(body, '55')).toEqual({
      chat_id: '55',
      watermarks: [
        { user_id: '7', watermark: '100' },
        { user_id: '9', watermark: '4294967296' },
      ],
    })
  })

  it('does not treat the mi member list as watermark keys', () => {
    expect(() => extractReadWatermarks({ mi: [1], w: [5] }, '1')).toThrow('read watermarks unavailable')
  })

  it('names the keys of a repeat-call response that omits a/w', () => {
    expect(() => extractReadWatermarks({ c: 1, m: [], l: 2 }, '1')).toThrow('(keys: c,m,l)')
  })

  it('throws when watermarks are missing or misaligned', () => {
    expect(() => extractReadWatermarks({ a: [1, 2] }, '1')).toThrow('read watermarks unavailable')
    expect(() => extractReadWatermarks({ a: [1, 2], w: [3] }, '1')).toThrow('read watermarks unavailable')
  })
})

describe('computeReadStatus', () => {
  const state = {
    chat_id: '55',
    watermarks: [
      { user_id: '1', watermark: '200' },
      { user_id: '2', watermark: '150' },
      { user_id: '3', watermark: '99' },
    ],
  }

  it('counts members whose watermark is below the log id, excluding the sender', () => {
    expect(computeReadStatus(state, '150', { senderId: '1' })).toEqual({
      chat_id: '55',
      log_id: '150',
      unread_count: 1,
      read_by: ['2'],
      unread_by: ['3'],
    })
  })

  it('compares 64-bit log ids exactly', () => {
    const big = { chat_id: '1', watermarks: [{ user_id: '2', watermark: '9007199254740993' }] }
    expect(computeReadStatus(big, '9007199254740993').unread_count).toBe(0)
    expect(computeReadStatus(big, '9007199254740994').unread_count).toBe(1)
  })
})
