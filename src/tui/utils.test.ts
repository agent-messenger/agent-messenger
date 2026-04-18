import { describe, it, expect } from 'bun:test'

import { formatTimestamp, truncate, fuzzyMatch, stripHtml } from './utils'

describe('formatTimestamp', () => {
  it("returns HH:MM for today's date", () => {
    const now = new Date()
    const epochSeconds = (now.getTime() / 1000).toFixed(6)
    const result = formatTimestamp(epochSeconds)
    expect(result).toMatch(/^\d{2}:\d{2}$/)
  })

  it("returns MM/DD HH:MM for yesterday's date", () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const epochSeconds = (yesterday.getTime() / 1000).toFixed(6)
    const result = formatTimestamp(epochSeconds)
    expect(result).toMatch(/^\d{2}\/\d{2} \d{2}:\d{2}$/)
  })

  it('ISO 8601 string for today returns HH:MM', () => {
    const now = new Date()
    const iso = now.toISOString()
    const result = formatTimestamp(iso)
    expect(result).toMatch(/^\d{2}:\d{2}$/)
  })

  it('ISO 8601 string for past date returns MM/DD HH:MM', () => {
    const result = formatTimestamp('2024-03-15T10:30:00Z')
    expect(result).toMatch(/^\d{2}\/\d{2} \d{2}:\d{2}$/)
  })

  it('invalid string returns original', () => {
    expect(formatTimestamp('not-a-date')).toBe('not-a-date')
    expect(formatTimestamp('abc123')).toBe('abc123')
  })

  it('formats Slack-style epoch with microseconds as HH:MM', () => {
    const now = new Date()
    const slackTs = `${Math.floor(now.getTime() / 1000)}.123456`
    const result = formatTimestamp(slackTs)
    expect(result).toMatch(/^\d{2}:\d{2}$/)
  })
})

describe('truncate', () => {
  it('returns short string unchanged', () => {
    expect(truncate('hello', 10)).toBe('hello')
  })

  it('returns string unchanged when length equals maxLen', () => {
    expect(truncate('hello', 5)).toBe('hello')
  })

  it('long string gets truncated with ellipsis', () => {
    expect(truncate('hello world', 8)).toBe('hello...')
  })

  it('truncates without ellipsis when maxLen is 3', () => {
    expect(truncate('hello', 3)).toBe('hel')
  })

  it('truncates without ellipsis when maxLen is 1', () => {
    expect(truncate('hello', 1)).toBe('h')
  })

  it('returns empty string when maxLen is 0', () => {
    expect(truncate('hello', 0)).toBe('')
  })

  it('adds ellipsis when maxLen is 4', () => {
    expect(truncate('hello', 4)).toBe('h...')
  })
})

describe('fuzzyMatch', () => {
  it('exact match returns true', () => {
    expect(fuzzyMatch('general', 'general')).toBe(true)
  })

  it('partial match in order returns true', () => {
    expect(fuzzyMatch('gnrl', 'general')).toBe(true)
  })

  it('matches case-insensitively', () => {
    expect(fuzzyMatch('GNRL', 'general')).toBe(true)
    expect(fuzzyMatch('gnrl', 'GENERAL')).toBe(true)
  })

  it('empty query returns true', () => {
    expect(fuzzyMatch('', 'anything')).toBe(true)
    expect(fuzzyMatch('', '')).toBe(true)
  })

  it('no match returns false', () => {
    expect(fuzzyMatch('xyz', 'general')).toBe(false)
  })

  it('characters out of order returns false', () => {
    expect(fuzzyMatch('lrng', 'general')).toBe(false)
  })

  it('query longer than text returns false', () => {
    expect(fuzzyMatch('generalgeneral', 'general')).toBe(false)
  })
})

describe('stripHtml', () => {
  it('removes simple tags', () => {
    expect(stripHtml('<p>hello</p>')).toBe('hello')
  })

  it('removes nested tags', () => {
    expect(stripHtml('<div><p><strong>hello</strong></p></div>')).toBe('hello')
  })

  it('decodes &amp;', () => {
    expect(stripHtml('a &amp; b')).toBe('a & b')
  })

  it('decodes &lt; and &gt;', () => {
    expect(stripHtml('&lt;tag&gt;')).toBe('<tag>')
  })

  it('decodes &quot;', () => {
    expect(stripHtml('say &quot;hello&quot;')).toBe('say "hello"')
  })

  it('decodes &#39;', () => {
    expect(stripHtml('it&#39;s')).toBe("it's")
  })

  it('collapses multiple whitespace', () => {
    expect(stripHtml('hello   world')).toBe('hello world')
  })

  it('trims leading and trailing whitespace', () => {
    expect(stripHtml('  hello  ')).toBe('hello')
  })

  it('handles multiple entities and tags together', () => {
    expect(stripHtml('<p>Hello &amp; <strong>World</strong></p>')).toBe('Hello & World')
  })

  it('collapses whitespace left by tag removal', () => {
    expect(stripHtml('<p>hello</p> <p>world</p>')).toBe('hello world')
  })
})
