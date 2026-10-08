import { describe, expect, it } from 'bun:test'

import { Long } from 'bson'

import { exactInteger, parseJsonPreservingIntegers, stringifyWithExactIntegers } from './exact-json'

const BIG_LOG_ID = '3947068532267313155'
const BIG_USER_ID = '7467363552057858123'

describe('exactInteger', () => {
  it('accepts decimal strings, safe numbers, bigints and Long values', () => {
    expect(exactInteger(BIG_LOG_ID).digits).toBe(BIG_LOG_ID)
    expect(exactInteger(52976567).digits).toBe('52976567')
    expect(exactInteger(BigInt(BIG_USER_ID)).digits).toBe(BIG_USER_ID)
    expect(exactInteger(Long.fromString(BIG_USER_ID)).digits).toBe(BIG_USER_ID)
  })

  it('accepts a plain Long-like { low, high } object', () => {
    const long = Long.fromString(BIG_USER_ID)
    expect(exactInteger({ low: long.low, high: long.high }).digits).toBe(BIG_USER_ID)
  })

  it('keeps negative 64-bit values exact', () => {
    expect(exactInteger(Long.fromString('-9110477831976617123')).digits).toBe('-9110477831976617123')
  })

  it('rejects unsafe numbers instead of rounding them', () => {
    expect(() => exactInteger(Number(BIG_LOG_ID))).toThrow()
  })

  it('rejects ids outside the signed 64-bit range', () => {
    expect(() => exactInteger('9223372036854775808')).toThrow()
    expect(() => exactInteger(Long.fromString('9223372036854775808', true))).toThrow()
    expect(exactInteger('9223372036854775807').digits).toBe('9223372036854775807')
    expect(exactInteger('-9223372036854775808').digits).toBe('-9223372036854775808')
  })

  it('rejects malformed ids', () => {
    expect(() => exactInteger('12a')).toThrow()
    expect(() => exactInteger('')).toThrow()
    expect(() => exactInteger(1.5)).toThrow()
    expect(() => exactInteger(null)).toThrow()
  })
})

describe('stringifyWithExactIntegers', () => {
  it('emits exact integer tokens for 64-bit ids', () => {
    const json = stringifyWithExactIntegers({
      src_logId: exactInteger(BIG_LOG_ID),
      src_userId: exactInteger(Long.fromString(BIG_USER_ID)),
      src_message: 'hi',
    })

    expect(json).toBe(`{"src_logId":${BIG_LOG_ID},"src_userId":${BIG_USER_ID},"src_message":"hi"}`)
  })

  it('does not rewrite user text that looks like an id', () => {
    const json = stringifyWithExactIntegers({ src_logId: exactInteger('1'), src_message: `"${BIG_LOG_ID}"` })

    expect(JSON.parse(json).src_message).toBe(`"${BIG_LOG_ID}"`)
  })
})

describe('parseJsonPreservingIntegers', () => {
  it('returns unsafe integers as exact decimal strings', () => {
    const parsed = parseJsonPreservingIntegers(
      `{"src_logId":${BIG_LOG_ID},"src_userId":-9110477831976617123,"src_linkId":474619593,"n":[${BIG_USER_ID}]}`,
    ) as Record<string, unknown>

    expect(parsed.src_logId).toBe(BIG_LOG_ID)
    expect(parsed.src_userId).toBe('-9110477831976617123')
    expect(parsed.src_linkId).toBe(474619593)
    expect(parsed.n).toEqual([BIG_USER_ID])
  })

  it('leaves digits inside strings, floats and exponents alone', () => {
    const parsed = parseJsonPreservingIntegers(
      `{"t":"id ${BIG_LOG_ID} \\" ${BIG_LOG_ID}","f":1.5,"e":1e3,"neg":-3}`,
    ) as Record<string, unknown>

    expect(parsed.t).toBe(`id ${BIG_LOG_ID} " ${BIG_LOG_ID}`)
    expect(parsed.f).toBe(1.5)
    expect(parsed.e).toBe(1000)
    expect(parsed.neg).toBe(-3)
  })

  it('round-trips with stringifyWithExactIntegers', () => {
    const json = stringifyWithExactIntegers({ src_logId: exactInteger(BIG_LOG_ID) })

    expect(parseJsonPreservingIntegers(json)).toEqual({ src_logId: BIG_LOG_ID })
  })

  it('throws on invalid JSON like JSON.parse', () => {
    expect(() => parseJsonPreservingIntegers('not-json')).toThrow()
  })
})
