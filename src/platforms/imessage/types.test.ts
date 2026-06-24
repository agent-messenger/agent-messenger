import { describe, expect, it } from 'bun:test'

import { createAccountId, IMessageError, type IMessageErrorCode } from './types'

describe('createAccountId', () => {
  it('strips protocol and slugifies a URL deterministically', () => {
    expect(createAccountId('http://Mac-1:1234')).toBe(createAccountId('http://Mac-1:1234'))
    expect(createAccountId('http://Mac-1:1234')).toBe('mac-1-1234')
  })

  it('strips https and trailing junk', () => {
    expect(createAccountId('https://my-mac.local:1234/')).toBe('my-mac-local-1234')
  })

  it('falls back to "default" for empty input', () => {
    expect(createAccountId('   ')).toBe('default')
  })
})

describe('IMessageError', () => {
  const codes: IMessageErrorCode[] = [
    'no_credentials',
    'not_authenticated',
    'unreachable',
    'auth_rejected',
    'private_api_required',
    'invalid_limit',
    'send_failed',
    'localhost_in_container',
    'imessage_error',
  ]

  it('is instantiable with every code and exposes .code', () => {
    for (const code of codes) {
      const err = new IMessageError('msg', code)
      expect(err.code).toBe(code)
      expect(err).toBeInstanceOf(Error)
    }
  })

  it('serializes suggestion and doctorCommand only when present', () => {
    const bare = new IMessageError('m', 'unreachable').toJSON()
    expect(bare).toEqual({ error: 'm', code: 'unreachable' })

    const rich = new IMessageError('m', 'unreachable', {
      suggestion: 's',
      doctorCommand: 'agent-imessage doctor',
    }).toJSON()
    expect(rich).toEqual({
      error: 'm',
      code: 'unreachable',
      suggestion: 's',
      doctorCommand: 'agent-imessage doctor',
    })
  })
})
