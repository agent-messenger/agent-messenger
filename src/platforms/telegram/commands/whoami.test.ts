import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'

mock.module('@/shared/utils/error-handler', () => ({
  handleError: (err: Error) => { throw err },
}))

const mockGetAuthStatus = mock(() =>
  Promise.resolve({
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
  }),
)

mock.module('./shared', () => ({
  withTelegramClient: async (
    options: unknown,
    fn: (client: { getAuthStatus: typeof mockGetAuthStatus }) => Promise<unknown>,
  ) => {
    return fn({ getAuthStatus: mockGetAuthStatus })
  },
}))

import { whoamiAction } from './whoami'

afterAll(() => {
  mock.restore()
})

describe('whoami command', () => {
  let logs: string[]
  let originalConsoleLog: typeof console.log

  beforeEach(() => {
    mockGetAuthStatus.mockReset()
    mockGetAuthStatus.mockImplementation(() =>
      Promise.resolve({
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
      }),
    )

    logs = []
    originalConsoleLog = console.log
    console.log = (...args: unknown[]) => { logs.push(String(args[0])) }
  })

  afterAll(() => {
    console.log = originalConsoleLog
  })

  test('outputs account info with user when authenticated', async () => {
    await whoamiAction({})

    expect(logs).toHaveLength(1)
    const output = JSON.parse(logs[0])
    expect(output.account_id).toBe('plus-12025551234')
    expect(output.phone_number).toBe('+12025551234')
    expect(output.authenticated).toBe(true)
    expect(output.user).toBeDefined()
    expect(output.user.id).toBe(123456)
    expect(output.user.username).toBe('testuser')
  })

  test('omits user field when not present', async () => {
    mockGetAuthStatus.mockImplementation(() =>
      Promise.resolve({
        account_id: 'plus-12025551234',
        phone_number: '+12025551234',
        authorization_state: 'authorizationStateWaitCode',
        authenticated: false,
      }),
    )

    await whoamiAction({})

    expect(logs).toHaveLength(1)
    const output = JSON.parse(logs[0])
    expect(output.account_id).toBe('plus-12025551234')
    expect(output.authenticated).toBe(false)
    expect(output.user).toBeUndefined()
  })
})
