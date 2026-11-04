import { describe, expect, it } from 'bun:test'

import { buildMentions, extractMentions } from './mention'

describe('buildMentions', () => {
  it('tags a single user at the first @', () => {
    expect(buildMentions('@Alice hello', [{ user_id: '123', name: 'Alice' }])).toEqual([
      { user_id: '123', at: [1], len: 5 },
    ])
  })

  it('counts every @ in the text when computing ordinals', () => {
    const mentions = buildMentions('mail a@b.c then @Bob and @Carol', [
      { user_id: '1', name: 'Bob' },
      { user_id: '2', name: 'Carol' },
    ])

    expect(mentions).toEqual([
      { user_id: '1', at: [2], len: 3 },
      { user_id: '2', at: [3], len: 5 },
    ])
  })

  it('collects every occurrence of the same user into one entry', () => {
    expect(buildMentions('@Bob hi @Bob', [{ user_id: '7', name: 'Bob' }])).toEqual([
      { user_id: '7', at: [1, 2], len: 3 },
    ])
  })

  it('merges duplicate inputs for the same user', () => {
    expect(
      buildMentions('@Bob', [
        { user_id: '7', name: 'Bob' },
        { user_id: '7', name: 'Bob' },
      ]),
    ).toEqual([{ user_id: '7', at: [1], len: 3 }])
  })

  it('attributes an @ to the longest matching name when names share a prefix', () => {
    const mentions = buildMentions('@Kimberly and @Kim', [
      { user_id: '1', name: 'Kim' },
      { user_id: '2', name: 'Kimberly' },
    ])

    expect(mentions).toEqual([
      { user_id: '1', at: [2], len: 3 },
      { user_id: '2', at: [1], len: 8 },
    ])
  })

  it('measures Hangul names by code points', () => {
    expect(buildMentions('@홍길동 안녕하세요', [{ user_id: '9', name: '홍길동' }])).toEqual([
      { user_id: '9', at: [1], len: 3 },
    ])
  })

  it('keeps 64-bit user ids exact', () => {
    expect(buildMentions('@x', [{ user_id: '7467363552057858123', name: 'x' }])[0]!.user_id).toBe('7467363552057858123')
  })

  it('throws when the text does not contain @<name>', () => {
    expect(() => buildMentions('hello Alice', [{ user_id: '1', name: 'Alice' }])).toThrow(
      'Message text does not contain "@Alice" for user 1',
    )
  })

  it('throws on an invalid user id', () => {
    expect(() => buildMentions('@a', [{ user_id: 'abc', name: 'a' }])).toThrow('Invalid mention user id: abc')
  })

  it('throws on an empty name', () => {
    expect(() => buildMentions('@a', [{ user_id: '1', name: '' }])).toThrow('has an empty name')
  })

  it('throws when the same user is given two different names', () => {
    expect(() =>
      buildMentions('@a @b', [
        { user_id: '1', name: 'a' },
        { user_id: '1', name: 'b' },
      ]),
    ).toThrow('mentioned with two different names')
  })
})

describe('extractMentions', () => {
  it('returns undefined when the attachment has no mentions', () => {
    expect(extractMentions(null)).toBeUndefined()
    expect(extractMentions({ k: 'path' })).toBeUndefined()
    expect(extractMentions({ mentions: [] })).toBeUndefined()
  })

  it('normalizes user_id to an exact decimal string', () => {
    expect(
      extractMentions({
        mentions: [
          { at: [1], len: 3, user_id: 42 },
          { at: [2, 3], len: 5, user_id: '7467363552057858123' },
        ],
      }),
    ).toEqual([
      { user_id: '42', at: [1], len: 3 },
      { user_id: '7467363552057858123', at: [2, 3], len: 5 },
    ])
  })

  it('accepts a scalar at and skips entries without a usable user id', () => {
    expect(
      extractMentions({
        mentions: [{ at: 1, len: 2, user_id: 5 }, { at: [1], len: 2 }, null, { user_id: 'x' }],
      }),
    ).toEqual([{ user_id: '5', at: [1], len: 2 }])
  })
})
