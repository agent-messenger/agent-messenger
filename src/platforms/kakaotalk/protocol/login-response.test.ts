import { describe, expect, it } from 'bun:test'

import { isSyntheticConnectionClose, validateLoginListResponse } from './login-response'
import type { LocoPacket } from './types'

function packet(statusCode: number, body: Record<string, unknown>): LocoPacket {
  return { packetId: 1, statusCode, method: 'LOGINLIST', bodyType: 0, body }
}

function captureError(fn: () => unknown): unknown {
  try {
    fn()
    return undefined
  } catch (error) {
    return error
  }
}

describe('LOGINLIST response classification', () => {
  it('accepts status=0 and returns the login snapshot', () => {
    const body = { status: 0, chatDatas: [], eof: true }

    expect(validateLoginListResponse(packet(0, body))).toBe(body)
  })

  it('accepts a successful response when body.status is omitted', () => {
    const body = { chatDatas: [], eof: true }

    expect(validateLoginListResponse(packet(0, body))).toBe(body)
  })

  it('classifies body.status=-950 as invalid_access_token', () => {
    expect(() => validateLoginListResponse(packet(0, { status: -950 }))).toThrow(
      expect.objectContaining({ code: 'invalid_access_token', serverStatus: -950 }),
    )
  })

  it('classifies packet statusCode=-950 as invalid_access_token', () => {
    expect(() => validateLoginListResponse(packet(-950, {}))).toThrow(
      expect.objectContaining({ code: 'invalid_access_token', serverStatus: -950 }),
    )
  })

  it('classifies an unknown non-zero body status as login_rejected', () => {
    expect(() => validateLoginListResponse(packet(0, { status: -777 }))).toThrow(
      expect.objectContaining({ code: 'login_rejected', serverStatus: -777 }),
    )
  })

  it('classifies an unknown non-zero packet status as login_rejected', () => {
    expect(() => validateLoginListResponse(packet(-777, {}))).toThrow(
      expect.objectContaining({ code: 'login_rejected', serverStatus: -777 }),
    )
  })

  it('keeps a synthetic socket close on the transport-error path', () => {
    const response = packet(-1, { error: 'connection closed' })
    const error = captureError(() => validateLoginListResponse(response))

    expect(isSyntheticConnectionClose(response)).toBe(true)
    expect(error).toBeInstanceOf(Error)
    expect(error).toMatchObject({ message: 'KakaoTalk LOGINLIST transport failed: connection closed' })
    expect(error).not.toHaveProperty('code')
    expect(error).not.toHaveProperty('serverStatus')
  })

  it('does not classify status -1 with a nonmatching body as a synthetic socket close', () => {
    const response = packet(-1, { error: 'provider rejected' })

    expect(isSyntheticConnectionClose(response)).toBe(false)
    expect(() => validateLoginListResponse(response)).toThrow(
      expect.objectContaining({ code: 'login_rejected', serverStatus: -1 }),
    )
  })
})
