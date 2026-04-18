import { describe, expect, it } from 'bun:test'

import { findFuzzyChats, mergeChats, normalizeChatSearchText } from './chat-utils'

describe('normalizeChatSearchText', () => {
  it('lowercases and strips spaces', () => {
    expect(normalizeChatSearchText('Hello World')).toBe('helloworld')
  })

  it('strips special chars', () => {
    expect(normalizeChatSearchText('ops-alerts!')).toBe('opsalerts')
  })

  it('handles empty string', () => {
    expect(normalizeChatSearchText('')).toBe('')
  })

  it('preserves unicode letters and digits', () => {
    const result = normalizeChatSearchText('안녕 World 123')
    expect(result).toContain('안녕')
    expect(result).toContain('world')
    expect(result).toContain('123')
  })
})

describe('findFuzzyChats', () => {
  const chats = [
    { id: 1, title: 'OPS Alerts', type: 'supergroup' },
    { id: 2, title: 'Engineering', type: 'supergroup' },
    { id: 3, title: 'ops-team', type: 'group' },
  ] as any[]

  it('finds partial matches case-insensitively', () => {
    const result = findFuzzyChats(chats, 'ops', 10)
    expect(result.map((c) => c.id)).toContain(1)
    expect(result.map((c) => c.id)).toContain(3)
  })

  it('returns empty for no matches', () => {
    expect(findFuzzyChats(chats, 'zzz', 10)).toHaveLength(0)
  })

  it('returns empty for empty query', () => {
    expect(findFuzzyChats(chats, '', 10)).toHaveLength(0)
  })

  it('respects limit', () => {
    const result = findFuzzyChats(chats, 'o', 1)
    expect(result).toHaveLength(1)
  })

  it('does not match chats with empty normalized title', () => {
    const chats = [{ id: 99, title: '---', type: 'group' }] as any[]
    expect(findFuzzyChats(chats, 'ops', 10)).toHaveLength(0)
  })
})

describe('mergeChats', () => {
  const a = [{ id: 1, title: 'A', type: 'group' }] as any[]
  const b = [
    { id: 1, title: 'A', type: 'group' },
    { id: 2, title: 'B', type: 'group' },
  ] as any[]

  it('deduplicates by id', () => {
    const result = mergeChats(a, b)
    expect(result).toHaveLength(2)
    expect(result.map((c) => c.id)).toEqual([1, 2])
  })

  it('gives primary array precedence in order', () => {
    const result = mergeChats(a, b)
    expect(result[0].id).toBe(1)
  })
})
