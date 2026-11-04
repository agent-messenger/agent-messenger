import { describe, expect, it } from 'bun:test'

import { extractThreadFields } from './chat-log-fields'

describe('extractThreadFields', () => {
  it('returns an empty object when the chat log has no thread fields', () => {
    expect(extractThreadFields({ logId: { high: 0, low: 1 }, type: 1, message: 'hi' })).toEqual({})
  })

  it('exposes scope, thread_id and prev_id from the chat log', () => {
    expect(
      extractThreadFields({
        scope: 3,
        threadId: { high: 0, low: 10 },
        prevId: { high: 0, low: 9 },
      }),
    ).toEqual({ scope: 3, thread_id: '10', prev_id: '9' })
  })

  it('keeps 64-bit Long ids exact as decimal strings', () => {
    // 3947068532267313155 = 0x36c6cdea_e9ea6803
    const threadId = { high: 0x36c6cdea, low: 0xe9ea6803 | 0 }
    expect(extractThreadFields({ threadId }).thread_id).toBe('3947068532267313155')
  })

  it('accepts safe numbers, bigints and decimal strings for ids', () => {
    expect(extractThreadFields({ threadId: 42, prevId: 41n })).toEqual({ thread_id: '42', prev_id: '41' })
    expect(extractThreadFields({ threadId: '3947068532267313155' }).thread_id).toBe('3947068532267313155')
  })

  it('omits zero ids instead of reporting "0"', () => {
    expect(extractThreadFields({ threadId: { high: 0, low: 0 }, prevId: 0 })).toEqual({})
  })

  it('omits ids that cannot be represented exactly', () => {
    expect(extractThreadFields({ threadId: 2 ** 60, prevId: 'not-a-number' })).toEqual({})
  })

  it('omits a non-integer scope', () => {
    expect(extractThreadFields({ scope: '3' })).toEqual({})
    expect(extractThreadFields({ scope: 1.5 })).toEqual({})
  })

  it('falls back to the supplement JSON for scope and threadId', () => {
    expect(
      extractThreadFields({
        supplement: '{"scope":3,"threadId":3947068532267313155}',
      }),
    ).toEqual({ scope: 3, thread_id: '3947068532267313155' })
  })

  it('prefers top-level fields over the supplement', () => {
    expect(
      extractThreadFields({
        scope: 1,
        threadId: { high: 0, low: 5 },
        supplement: '{"scope":3,"threadId":6}',
      }),
    ).toEqual({ scope: 1, thread_id: '5' })
  })

  it('ignores a malformed or non-object supplement', () => {
    expect(extractThreadFields({ scope: 3, supplement: '{not json' })).toEqual({ scope: 3 })
    expect(extractThreadFields({ supplement: '[1,2]' })).toEqual({})
    expect(extractThreadFields({ supplement: '' })).toEqual({})
  })
})
