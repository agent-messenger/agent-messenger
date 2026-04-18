import { describe, expect, it } from 'bun:test'

import * as webex from './index'

describe('webex barrel exports', () => {
  it('exports WebexClient', () => {
    expect(webex.WebexClient).toBeDefined()
  })

  it('exports WebexCredentialManager', () => {
    expect(webex.WebexCredentialManager).toBeDefined()
  })

  it('exports WebexError', () => {
    expect(webex.WebexError).toBeDefined()
  })

  it('exports Zod schemas', () => {
    expect(webex.WebexSpaceSchema).toBeDefined()
    expect(webex.WebexMessageSchema).toBeDefined()
    expect(webex.WebexPersonSchema).toBeDefined()
    expect(webex.WebexMembershipSchema).toBeDefined()
    expect(webex.WebexConfigSchema).toBeDefined()
  })
})
