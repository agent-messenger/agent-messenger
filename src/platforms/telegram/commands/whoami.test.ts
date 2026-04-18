import { afterEach, beforeEach, describe, expect, spyOn, it } from 'bun:test'

import { TelegramTdlibClient } from '../client'
import { TelegramCredentialManager } from '../credential-manager'
import type { TelegramAccount } from '../types'
import * as sharedModule from './shared'
import { whoamiAction } from './whoami'

const mockAuthStatus = {
  account_id: 'plus-12025551234',
  phone_number: '+12025551234',
  authorization_state: 'authorizationStateReady',
  authenticated: true,
  user: {
    id: 123456,
    first_name: 'Test',
    last_name: 'User',
    username: 'testuser',
    phone_number: '12025551234',
    type: 'user' as const,
  },
}

let withTelegramClientSpy: ReturnType<typeof spyOn>
let getAuthStatusSpy: ReturnType<typeof spyOn>
let consoleLogSpy: ReturnType<typeof spyOn>

describe('whoami command', () => {
  beforeEach(() => {
    getAuthStatusSpy = spyOn(TelegramTdlibClient.prototype, 'getAuthStatus').mockResolvedValue(mockAuthStatus)
    withTelegramClientSpy = spyOn(sharedModule, 'withTelegramClient').mockImplementation(async (_opts, fn) => {
      const fakeClient = Object.create(TelegramTdlibClient.prototype) as TelegramTdlibClient
      return fn(fakeClient, {} as TelegramAccount, new TelegramCredentialManager())
    })
    consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    getAuthStatusSpy?.mockRestore()
    withTelegramClientSpy?.mockRestore()
    consoleLogSpy?.mockRestore()
  })

  it('outputs account info with user when authenticated', async () => {
    await whoamiAction({})

    expect(consoleLogSpy).toHaveBeenCalledTimes(1)
    const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string)
    expect(output.account_id).toBe('plus-12025551234')
    expect(output.phone_number).toBe('+12025551234')
    expect(output.authenticated).toBe(true)
    expect(output.user).toBeDefined()
    expect(output.user.id).toBe(123456)
    expect(output.user.username).toBe('testuser')
  })

  it('omits user field when not present', async () => {
    getAuthStatusSpy.mockResolvedValue({
      account_id: 'plus-12025551234',
      phone_number: '+12025551234',
      authorization_state: 'authorizationStateWaitCode',
      authenticated: false,
    })

    await whoamiAction({})

    expect(consoleLogSpy).toHaveBeenCalledTimes(1)
    const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string)
    expect(output.account_id).toBe('plus-12025551234')
    expect(output.authenticated).toBe(false)
    expect(output.user).toBeUndefined()
  })
})
