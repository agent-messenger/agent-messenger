import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test'

mock.module('@/shared/utils/error-handler', () => ({
  handleError: (err: Error) => { throw err },
}))

const mockGetProfile = mock(() =>
  Promise.resolve({
    id: '12025551234:1@s.whatsapp.net',
    name: 'Test User',
    phone_number: '12025551234',
  }),
)

const mockClient = {
  getProfile: mockGetProfile,
}

mock.module('./shared', () => ({
  withWhatsAppClient: async (
    _options: unknown,
    fn: (client: typeof mockClient) => Promise<unknown>,
  ) => {
    return fn(mockClient)
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
    mockGetProfile.mockReset()
    mockGetProfile.mockImplementation(() =>
      Promise.resolve({
        id: '12025551234:1@s.whatsapp.net',
        name: 'Test User',
        phone_number: '12025551234',
      }),
    )

    logs = []
    originalConsoleLog = console.log
    console.log = (...args: unknown[]) => { logs.push(String(args[0])) }
  })

  afterAll(() => {
    console.log = originalConsoleLog
  })

  test('outputs profile information', async () => {
    await whoamiAction({})

    expect(logs).toHaveLength(1)
    const output = JSON.parse(logs[0])
    expect(output.id).toBe('12025551234:1@s.whatsapp.net')
    expect(output.name).toBe('Test User')
    expect(output.phone_number).toBe('12025551234')
  })

  test('outputs profile with null name', async () => {
    mockGetProfile.mockImplementation(() =>
      Promise.resolve({
        id: '12025551234@s.whatsapp.net',
        name: null,
        phone_number: '12025551234',
      }),
    )

    await whoamiAction({})

    expect(logs).toHaveLength(1)
    const output = JSON.parse(logs[0])
    expect(output.id).toBe('12025551234@s.whatsapp.net')
    expect(output.name).toBeNull()
  })
})
