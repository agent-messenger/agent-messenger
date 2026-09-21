/**
 * Decide an expression's format from its bytes, not its filename.
 *
 * The upload declares a media type in its multipart part, and Discord answers
 * a part whose declared type does not match its content with a bare
 * "Invalid Asset" — the same opaque rejection a missing type produces. A
 * filename is unverified input, so deriving the type from the extension means
 * one mislabelled file in a batch fails without saying which, or why.
 *
 * A leading `{` proves only that the file is JSON, so a sticker's JSON is
 * checked for the one field every Lottie animation carries. Uploading `{}`
 * otherwise comes back as a bare "Invalid Asset". Whether the animation renders
 * is still Discord's call, and Lottie needs a VERIFIED or PARTNERED guild.
 *
 * This deliberately does not check dimensions. Discord's documentation gives
 * 320x320 for stickers, but a 408x408 PNG uploads and registers fine, so a
 * local size check would refuse files the API accepts.
 */

export type ExpressionFormat = 'png' | 'gif' | 'jpeg' | 'webp' | 'json'

/**
 * The two endpoints do not take the same formats, so one shared set would let a
 * JPEG reach the sticker endpoint — declared image/jpeg, and refused with the
 * same opaque "Invalid Asset" this check exists to avoid.
 */
export const EMOJI_FORMATS: ReadonlySet<ExpressionFormat> = new Set(['png', 'gif', 'jpeg', 'webp'])
/** APNG carries the PNG signature, so it is covered by 'png'. */
export const STICKER_FORMATS: ReadonlySet<ExpressionFormat> = new Set(['png', 'gif', 'json'])

const MEDIA_TYPES: Record<ExpressionFormat, string> = {
  png: 'image/png',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  json: 'application/json',
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff]

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return bytes.length >= signature.length && signature.every((byte, index) => bytes[index] === byte)
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length))
}

export function mediaTypeOf(format: ExpressionFormat): string {
  return MEDIA_TYPES[format]
}

export function sniffFormat(bytes: Uint8Array): ExpressionFormat | null {
  // APNG carries the PNG signature too; Discord takes both as image/png.
  if (startsWith(bytes, PNG_SIGNATURE)) return 'png'
  if (startsWith(bytes, JPEG_SIGNATURE)) return 'jpeg'

  if (bytes.length >= 6 && ascii(bytes, 0, 3) === 'GIF') {
    const version = ascii(bytes, 3, 3)
    if (version === '87a' || version === '89a') return 'gif'
  }

  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
    return 'webp'
  }

  // Lottie is a JSON document. Scan past leading whitespace and a BOM until the
  // first byte that is neither — a fixed lookahead would reject a file that is
  // merely indented. Any binary hits a non-skippable byte almost immediately.
  for (const byte of bytes) {
    if (byte === 0x7b) return 'json'
    const skippable =
      byte === 0x20 ||
      byte === 0x09 ||
      byte === 0x0a ||
      byte === 0x0d ||
      byte === 0xef ||
      byte === 0xbb ||
      byte === 0xbf
    if (!skippable) break
  }

  return null
}

/**
 * A Lottie animation always carries a `layers` array. Checking that one field
 * rejects an arbitrary JSON document without guessing at the rest of the
 * schema, which would risk refusing animations a newer exporter produces.
 *
 * Returns the reason the document cannot be one, or null when it may be. The
 * two faults are reported apart: a file can hold a layers array and still be
 * broken, and "no layers array" would send its author looking in the wrong
 * place.
 */
export function lottieError(bytes: Uint8Array): string | null {
  let text: string
  try {
    // A lenient decoder substitutes U+FFFD for a malformed byte, leaving JSON
    // that parses while the file itself is not valid UTF-8.
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return 'JSON file is not valid UTF-8'
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return 'JSON file is not valid JSON'
  }

  const hasLayers =
    typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as { layers?: unknown }).layers)
  return hasLayers ? null : 'JSON file is not a Lottie animation (no layers array)'
}
