import { describe, expect, it } from 'bun:test'

import { TelegramError } from '../types'
import { parseLimitOption } from './shared'

describe('telegram shared command helpers', () => {
  it('parseLimitOption accepts normal integer strings', () => {
    expect(parseLimitOption('10', 20)).toBe(10)
  })

  it('parseLimitOption rejects malformed numeric prefixes', () => {
    expect(() => parseLimitOption('10abc', 20)).toThrow(TelegramError)
    expect(() => parseLimitOption('1.5', 20)).toThrow(TelegramError)
    expect(() => parseLimitOption('2e3', 20)).toThrow(TelegramError)
  })
})
