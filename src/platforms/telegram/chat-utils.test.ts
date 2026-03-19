import { describe, expect, test } from 'bun:test'
import { findFuzzyChats, mergeChats, normalizeChatSearchText } from './chat-utils'

describe('normalizeChatSearchText', () => {
  test('lowercases and strips spaces', () => {
    expect(normalizeChatSearchText('Hello World')).toBe('helloworld')
  })

  test('strips special chars', () => {
    expect(normalizeChatSearchText('ops-alerts!')).toBe('opsalerts')
  })

  test('handles empty string', () => {
    expect(normalizeChatSearchText('')).toBe('')
  })

  test('preserves unicode letters and digits', () => {
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

  test('finds partial matches case-insensitively', () => {
    const result = findFuzzyChats(chats, 'ops', 10)
    expect(result.map((c) => c.id)).toContain(1)
    expect(result.map((c) => c.id)).toContain(3)
  })

  test('returns empty for no matches', () => {
    expect(findFuzzyChats(chats, 'zzz', 10)).toHaveLength(0)
  })

  test('returns empty for empty query', () => {
    expect(findFuzzyChats(chats, '', 10)).toHaveLength(0)
  })

  test('respects limit', () => {
    const result = findFuzzyChats(chats, 'o', 1)
    expect(result).toHaveLength(1)
  })
})

describe('mergeChats', () => {
  const a = [{ id: 1, title: 'A', type: 'group' }] as any[]
  const b = [{ id: 1, title: 'A', type: 'group' }, { id: 2, title: 'B', type: 'group' }] as any[]

  test('deduplicates by id', () => {
    const result = mergeChats(a, b)
    expect(result).toHaveLength(2)
    expect(result.map((c) => c.id)).toEqual([1, 2])
  })

  test('primary takes precedence order', () => {
    const result = mergeChats(a, b)
    expect(result[0].id).toBe(1)
  })
})
