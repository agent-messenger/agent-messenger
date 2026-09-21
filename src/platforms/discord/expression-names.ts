/**
 * Discord answers an out-of-range expression name with a bare
 * "Invalid Form Body", naming neither the field nor the file. In a batch
 * upload that says nothing about which one was refused, so the name — the one
 * part of an expression the caller supplies directly — is checked first.
 */

const EMOJI_NAME_PATTERN = /^[A-Za-z0-9_]+$/
const EMOJI_NAME_MIN = 2
const EMOJI_NAME_MAX = 32

const STICKER_NAME_MIN = 2
const STICKER_NAME_MAX = 30

export function validateEmojiName(name: string): string | null {
  if (name.length < EMOJI_NAME_MIN) {
    return `Emoji name must be at least ${EMOJI_NAME_MIN} characters: "${name}"`
  }
  if (name.length > EMOJI_NAME_MAX) {
    return `Emoji name must be at most ${EMOJI_NAME_MAX} characters: "${name}"`
  }
  if (!EMOJI_NAME_PATTERN.test(name)) {
    return `Emoji name may only contain letters, digits, underscores: "${name}"`
  }
  return null
}

export function validateStickerName(name: string): string | null {
  if (name.length < STICKER_NAME_MIN) {
    return `Sticker name must be at least ${STICKER_NAME_MIN} characters: "${name}"`
  }
  if (name.length > STICKER_NAME_MAX) {
    return `Sticker name must be at most ${STICKER_NAME_MAX} characters: "${name}"`
  }
  return null
}
