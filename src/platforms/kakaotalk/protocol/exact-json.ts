// KakaoTalk ids (log ids, open-profile user ids, link ids) are signed 64-bit
// integers. Real log ids are already ~3.9e18, far past
// Number.MAX_SAFE_INTEGER, so neither JSON.stringify nor JSON.parse can carry
// them through a JS number. The official clients write them into the LOCO
// `extra`/attachment JSON as bare integer tokens, so we must emit and read
// exactly that shape without ever routing the value through a double.

const INTEGER_DIGITS = /^-?(0|[1-9]\d*)$/
const INT64_MIN = -(2n ** 63n)
const INT64_MAX = 2n ** 63n - 1n

export class JsonInteger {
  readonly digits: string

  constructor(digits: string) {
    if (!INTEGER_DIGITS.test(digits)) throw new Error(`Not an integer id: ${JSON.stringify(digits)}`)
    const value = BigInt(digits)
    if (value < INT64_MIN || value > INT64_MAX) throw new Error(`Id ${digits} is outside the signed 64-bit range`)
    this.digits = digits
  }
}

function isLongLike(value: unknown): value is { low: number; high: number; unsigned?: boolean } {
  if (!value || typeof value !== 'object' || !('low' in value) || !('high' in value)) return false
  const { low, high } = value as { low: unknown; high: unknown }
  return Number.isInteger(low) && Number.isInteger(high)
}

function longLikeToBigInt({ low, high, unsigned }: { low: number; high: number; unsigned?: boolean }): bigint {
  const bits = (BigInt(high >>> 0) << 32n) | BigInt(low >>> 0)
  return unsigned ? bits : BigInt.asIntN(64, bits)
}

// Normalizes every id shape the SDK sees at runtime: decimal strings (our
// public API), safe numbers (DM/group user ids), bigint, and BSON Long or
// plain Long-like objects (open-chat author ids). Unsafe numbers are rejected
// because their digits are already gone.
export function exactInteger(value: unknown): JsonInteger {
  if (value instanceof JsonInteger) return value
  if (typeof value === 'string') return new JsonInteger(value)
  if (typeof value === 'bigint') return new JsonInteger(value.toString())
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new Error(`Id ${value} is not a safe integer; pass it as a decimal string, bigint, or Long instead`)
    }
    return new JsonInteger(String(value))
  }
  if (isLongLike(value)) return new JsonInteger(longLikeToBigInt(value).toString())
  throw new Error(`Unsupported id value: ${String(value)}`)
}

// JSON.stringify, except every JsonInteger is written as a bare integer token.
// A per-call nonce marks the placeholders so user text (e.g. src_message) can
// never collide with them.
export function stringifyWithExactIntegers(value: unknown): string {
  const nonce = crypto.randomUUID()
  const json = JSON.stringify(value, (_key, item: unknown) =>
    item instanceof JsonInteger ? `${nonce}:${item.digits}` : item,
  )
  return json.replace(new RegExp(`"${nonce}:(-?\\d+)"`, 'g'), '$1')
}

function isUnsafeIntegerToken(token: string): boolean {
  return INTEGER_DIGITS.test(token) && !Number.isSafeInteger(Number(token))
}

// JSON.parse, except integer tokens outside the safe range come back as exact
// decimal strings instead of rounded numbers. Safe integers, floats and
// everything inside strings are left untouched.
export function parseJsonPreservingIntegers(raw: string): unknown {
  let out = ''
  let i = 0
  while (i < raw.length) {
    const ch = raw[i]!
    if (ch === '"') {
      let j = i + 1
      while (j < raw.length && raw[j] !== '"') j += raw[j] === '\\' ? 2 : 1
      out += raw.slice(i, j + 1)
      i = j + 1
      continue
    }
    if (ch === '-' || (ch >= '0' && ch <= '9')) {
      let j = i + 1
      while (j < raw.length && /[\d.eE+-]/.test(raw[j]!)) j++
      const token = raw.slice(i, j)
      out += isUnsafeIntegerToken(token) ? `"${token}"` : token
      i = j
      continue
    }
    out += ch
    i++
  }
  return JSON.parse(out)
}
