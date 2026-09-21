import { describe, expect, it } from 'bun:test'

import { validateEmojiName, validateStickerName } from './expression-names'

describe('validateEmojiName', () => {
  it('accepts letters, digits and underscores', () => {
    expect(validateEmojiName('potato_13')).toBeNull()
  })

  it('rejects a hyphen, naming the allowed characters', () => {
    // A filename like potato-13.png derives this name, and Discord answers
    // "Invalid Form Body" without saying which field was at fault.
    expect(validateEmojiName('potato-13')).toContain('letters, digits, underscores')
  })

  it('rejects a space', () => {
    expect(validateEmojiName('potato 13')).toContain('letters, digits, underscores')
  })

  it('rejects a name shorter than 2 characters', () => {
    expect(validateEmojiName('a')).toContain('2')
  })

  it('rejects a name longer than 32 characters', () => {
    expect(validateEmojiName('p'.repeat(33))).toContain('32')
  })
})

describe('validateStickerName', () => {
  it('accepts a two-character name', () => {
    expect(validateStickerName('빼액')).toBeNull()
  })

  it('rejects a single character, naming the minimum', () => {
    expect(validateStickerName('흥')).toContain('2')
  })

  it('rejects a name longer than 30 characters', () => {
    expect(validateStickerName('가'.repeat(31))).toContain('30')
  })
})
