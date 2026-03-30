import { describe, expect, test } from 'bun:test'

import * as webex from './index'

describe('webex barrel exports', () => {
  test('exports WebexClient', () => {
    expect(webex.WebexClient).toBeDefined()
  })

  test('exports WebexCredentialManager', () => {
    expect(webex.WebexCredentialManager).toBeDefined()
  })

  test('exports WebexError', () => {
    expect(webex.WebexError).toBeDefined()
  })

  test('exports Zod schemas', () => {
    expect(webex.WebexSpaceSchema).toBeDefined()
    expect(webex.WebexMessageSchema).toBeDefined()
    expect(webex.WebexPersonSchema).toBeDefined()
    expect(webex.WebexMembershipSchema).toBeDefined()
    expect(webex.WebexCredentialsSchema).toBeDefined()
    expect(webex.WebexConfigSchema).toBeDefined()
  })
})
