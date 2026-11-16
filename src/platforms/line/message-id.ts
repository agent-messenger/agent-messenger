import { LineError } from './types'

const MAX_MESSAGE_ID = 9223372036854775807n

// LINE message IDs are positive signed 64-bit integers serialized as decimal
// strings. Validate before any network call so a typo fails fast instead of
// reaching the server (or wrapping when packed into an i64 field).
export function assertMessageId(value: string, field = 'message ID'): string {
  if (!/^\d+$/.test(value) || BigInt(value) === 0n || BigInt(value) > MAX_MESSAGE_ID) {
    throw new LineError('invalid_message_id', `Invalid ${field} "${value}": expected a numeric LINE message ID`)
  }
  return value
}
