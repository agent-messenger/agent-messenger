import { describe, expect, test } from 'bun:test'

import { parseLimitOption } from '@/platforms/instagram/commands/shared'
import { InstagramError } from '@/platforms/instagram/types'

describe('parseLimitOption', () => {
  test('returns parsed integer for valid input', () => {
    expect(parseLimitOption('10', 20)).toBe(10)
  })

  test('returns default when undefined', () => {
    expect(parseLimitOption(undefined, 20)).toBe(20)
  })

  test('trims whitespace', () => {
    expect(parseLimitOption('  15  ', 20)).toBe(15)
  })

  test('throws InstagramError for non-numeric input', () => {
    expect(() => parseLimitOption('abc', 20)).toThrow(InstagramError)
  })

  test('throws for zero', () => {
    expect(() => parseLimitOption('0', 20)).toThrow(InstagramError)
  })

  test('throws for negative numbers', () => {
    expect(() => parseLimitOption('-5', 20)).toThrow(InstagramError)
  })

  test('throws for values exceeding default maxValue', () => {
    expect(() => parseLimitOption('101', 20)).toThrow(InstagramError)
  })

  test('respects custom maxValue', () => {
    expect(parseLimitOption('50', 20, 50)).toBe(50)
    expect(() => parseLimitOption('51', 20, 50)).toThrow(InstagramError)
  })

  test('throws for decimal numbers', () => {
    expect(() => parseLimitOption('10.5', 20)).toThrow(InstagramError)
  })

  test('accepts boundary value 1', () => {
    expect(parseLimitOption('1', 20)).toBe(1)
  })

  test('accepts boundary value 100', () => {
    expect(parseLimitOption('100', 20)).toBe(100)
  })
})
