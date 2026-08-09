import { describe, expect, it } from 'bun:test'

import { validateLoginListResponse } from './login-response'
import type { LocoPacket } from './types'

function packet(statusCode: number, body: Record<string, unknown>): LocoPacket {
  return { packetId: 1, statusCode, method: 'LOGINLIST', bodyType: 0, body }
}

describe('LOGINLIST authentication response contract', () => {
  it('accepts status=0 and returns the login snapshot', () => {
    const body = { status: 0, chatDatas: [], eof: true }

    expect(validateLoginListResponse(packet(0, body))).toBe(body)
  })

  it('accepts a successful response when body.status is omitted', () => {
    const body = { chatDatas: [], eof: true }

    expect(validateLoginListResponse(packet(0, body))).toBe(body)
  })

  it('rejects body.status=-950 as invalid_access_token', () => {
    expect(() => validateLoginListResponse(packet(0, { status: -950 }))).toThrow(
      expect.objectContaining({ code: 'invalid_access_token', serverStatus: -950 }),
    )
  })

  it('rejects unknown non-zero body status as login_rejected', () => {
    expect(() => validateLoginListResponse(packet(0, { status: -777 }))).toThrow(
      expect.objectContaining({ code: 'login_rejected', serverStatus: -777 }),
    )
  })

  it('rejects non-zero transport status before inspecting the body', () => {
    expect(() => validateLoginListResponse(packet(-1, { status: -950 }))).toThrow(
      expect.objectContaining({ code: 'login_rejected', serverStatus: -1 }),
    )
  })
})
