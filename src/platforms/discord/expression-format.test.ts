import { describe, expect, it } from 'bun:test'

import { EMOJI_FORMATS, STICKER_FORMATS, lottieError, mediaTypeOf, sniffFormat } from './expression-format'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])
const gif = new Uint8Array([...Buffer.from('GIF89a'), 0, 0, 0, 0])
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0])
const webp = new Uint8Array([...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WEBP')])
const json = new Uint8Array(Buffer.from('  {"v":"5.5.7","fr":30}'))

describe('sniffFormat', () => {
  it('reads PNG from its signature', () => {
    expect(sniffFormat(png)).toBe('png')
  })

  it('reads GIF, JPEG and WebP from their signatures', () => {
    expect(sniffFormat(gif)).toBe('gif')
    expect(sniffFormat(jpeg)).toBe('jpeg')
    expect(sniffFormat(webp)).toBe('webp')
  })

  it('reads JSON from a leading brace — a Lottie is a JSON document', () => {
    expect(sniffFormat(json)).toBe('json')
  })

  it('ignores the filename entirely — a GIF named .png is still a GIF', () => {
    // Discord answers a part whose declared type does not match its bytes
    // with a bare "Invalid Asset".
    expect(sniffFormat(gif)).toBe('gif')
  })

  it('returns null for bytes that match no supported format', () => {
    expect(sniffFormat(new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]))).toBeNull()
  })

  it('returns null for a truncated file', () => {
    expect(sniffFormat(new Uint8Array([0x89, 0x50]))).toBeNull()
  })

  it('reads JSON past more leading whitespace than a fixed lookahead', () => {
    const padded = new Uint8Array(Buffer.from(' '.repeat(40) + '{"v":"5.5.7"}'))
    expect(sniffFormat(padded)).toBe('json')
  })

  it('does not mistake a long run of zero bytes for JSON', () => {
    expect(sniffFormat(new Uint8Array(64))).toBeNull()
  })
})

describe('endpoint format sets', () => {
  it('emoji takes the still and animated image formats, not Lottie', () => {
    expect([...EMOJI_FORMATS].sort()).toEqual(['gif', 'jpeg', 'png', 'webp'])
  })

  it('sticker takes PNG, GIF and JSON, not JPEG or WebP', () => {
    // A JPEG sticker would otherwise be declared image/jpeg and refused by
    // Discord as "Invalid Asset" — the rejection this check exists to avoid.
    expect([...STICKER_FORMATS].sort()).toEqual(['gif', 'json', 'png'])
  })
})

describe('mediaTypeOf', () => {
  it('maps each format to the type Discord expects', () => {
    expect(mediaTypeOf('png')).toBe('image/png')
    expect(mediaTypeOf('gif')).toBe('image/gif')
    expect(mediaTypeOf('jpeg')).toBe('image/jpeg')
    expect(mediaTypeOf('webp')).toBe('image/webp')
    expect(mediaTypeOf('json')).toBe('application/json')
  })
})

describe('lottieError', () => {
  const bytesOf = (text: string) => new Uint8Array(Buffer.from(text))

  it('accepts a document with a layers array', () => {
    expect(lottieError(bytesOf('{"v":"5.5.7","fr":30,"layers":[{"ty":4}]}'))).toBeNull()
  })

  it('accepts an animation with no layers yet', () => {
    expect(lottieError(bytesOf('{"v":"5.5.7","layers":[]}'))).toBeNull()
  })

  it('rejects an empty object', () => {
    // Discord answers `{}` uploaded as a sticker with a bare "Invalid Asset".
    expect(lottieError(bytesOf('{}'))).toContain('layers')
  })

  it('rejects JSON that is not an animation', () => {
    expect(lottieError(bytesOf('{"name":"package","version":"1.0.0"}'))).toContain('layers')
  })

  it('rejects a document whose layers is not an array', () => {
    expect(lottieError(bytesOf('{"layers":"nope"}'))).toContain('layers')
  })

  it('rejects malformed JSON without throwing', () => {
    expect(lottieError(bytesOf('{"layers":['))).toContain('valid JSON')
  })

  it('rejects a document carrying invalid UTF-8', () => {
    // A lenient decoder turns the stray byte into U+FFFD, leaving JSON that
    // parses and passes — and Discord then refuses it as "Invalid Asset".
    const broken = new Uint8Array([...Buffer.from('{"layers":[],"nm":"'), 0xff, ...Buffer.from('"}')])
    // The layers array is present, so the message must name the real fault.
    expect(lottieError(broken)).toContain('UTF-8')
  })
})
