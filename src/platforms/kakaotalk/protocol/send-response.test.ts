import { describe, expect, it } from 'bun:test'

import { Long } from 'bson'

import { formatSendResult } from './send-response'

describe('send response validation', () => {
  it('requires both protocol statuses and a positive message id', () => {
    for (const logId of [Long.fromNumber(7), { low: 7, high: 0 }, '7']) {
      expect(formatSendResult({ statusCode: 0, body: { logId } }, '100').success).toBe(true)
      expect(formatSendResult({ statusCode: 0, body: { status: -203, logId } }, '100')).toMatchObject({
        success: false,
        status_code: -203,
      })
    }
    for (const logId of [undefined, 0, 'bad', Long.NEG_ONE, '9223372036854775808', '18446744073709551615']) {
      expect(formatSendResult({ statusCode: 0, body: { logId } }, '100').success).toBe(false)
    }
    expect(formatSendResult({ statusCode: 0, body: { logId: '9223372036854775807' } }, '100').success).toBe(true)
    expect(formatSendResult(null, '100').success).toBe(false)
    expect(formatSendResult({ statusCode: 0, body: { status: '0', logId: 7 } }, '100').success).toBe(false)
  })
})
