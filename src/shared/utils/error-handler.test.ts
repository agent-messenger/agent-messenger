import { describe, expect, it } from 'bun:test'

import { formatHandledError } from './error-handler'

describe('formatHandledError', () => {
  it('keeps the existing message-only shape for generic errors', () => {
    expect(formatHandledError(new Error('network failed'))).toEqual({ error: 'network failed' })
  })

  it('preserves a safe string error code', () => {
    const error = Object.assign(new Error('invalid access token'), { code: 'invalid_access_token' })

    expect(formatHandledError(error)).toEqual({
      error: 'invalid access token',
      code: 'invalid_access_token',
    })
  })

  it('preserves a finite numeric server status in snake_case output', () => {
    const error = Object.assign(new Error('invalid access token'), {
      code: 'invalid_access_token',
      serverStatus: -950,
    })

    expect(formatHandledError(error)).toEqual({
      error: 'invalid access token',
      code: 'invalid_access_token',
      server_status: -950,
    })
  })

  it('drops unsafe metadata types', () => {
    const error = Object.assign(new Error('failed'), {
      code: { secret: 'do-not-serialize' },
      serverStatus: Number.NaN,
    })

    expect(formatHandledError(error)).toEqual({ error: 'failed' })
  })
})
