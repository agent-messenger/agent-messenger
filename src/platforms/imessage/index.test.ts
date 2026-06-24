import { describe, expect, it } from 'bun:test'

import * as imessage from './index'

describe('imessage SDK barrel', () => {
  it('exports the client, credential manager, and error', () => {
    expect(typeof imessage.BlueBubblesClient).toBe('function')
    expect(typeof imessage.IMessageCredentialManager).toBe('function')
    expect(typeof imessage.IMessageError).toBe('function')
    expect(typeof imessage.createAccountId).toBe('function')
  })
})
