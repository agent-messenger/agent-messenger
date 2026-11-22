import { describe, expect, it } from 'bun:test'

import { assertMessageId } from './message-id'

describe('assertMessageId', () => {
  it('accepts a numeric int64 message ID', () => {
    expect(assertMessageId('600000000000000001')).toBe('600000000000000001')
  })

  it('rejects non-numeric, zero, and out-of-range IDs', () => {
    for (const value of ['', 'abc', '12a', '-1', '0', '9223372036854775808']) {
      expect(() => assertMessageId(value)).toThrow(expect.objectContaining({ code: 'invalid_message_id' }))
    }
  })
})
