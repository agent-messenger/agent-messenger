import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

mock.module('@/shared/utils/error-handler', () => ({
  handleError: (err: Error) => { throw err },
}))

const mockGetProfile = mock(() =>
  Promise.resolve({
    user_id: '987654321',
    username: 'testuser',
    full_name: 'Test User',
    profile_pic_url: 'https://example.com/pic.jpg',
  }),
)

const mockClient = {
  getProfile: mockGetProfile,
}

mock.module('./shared', () => ({
  withInstagramClient: async (
    _options: unknown,
    fn: (client: typeof mockClient) => Promise<unknown>,
  ) => {
    return fn(mockClient)
  },
}))

import { whoamiAction } from './whoami'

describe('whoami command', () => {
  let logs: string[]
  let originalConsoleLog: typeof console.log

  beforeEach(() => {
    mockGetProfile.mockReset()
    mockGetProfile.mockImplementation(() =>
      Promise.resolve({
        user_id: '987654321',
        username: 'testuser',
        full_name: 'Test User',
        profile_pic_url: 'https://example.com/pic.jpg',
      }),
    )

    logs = []
    originalConsoleLog = console.log
    console.log = (...args: unknown[]) => { logs.push(String(args[0])) }
  })

  afterEach(() => {
    console.log = originalConsoleLog
  })

  test('outputs profile information', async () => {
    await whoamiAction({})

    expect(logs).toHaveLength(1)
    const output = JSON.parse(logs[0])
    expect(output.user_id).toBe('987654321')
    expect(output.username).toBe('testuser')
    expect(output.full_name).toBe('Test User')
    expect(output.profile_pic_url).toBe('https://example.com/pic.jpg')
  })

  test('outputs profile with null optional fields', async () => {
    mockGetProfile.mockImplementation(() =>
      Promise.resolve({
        user_id: '987654321',
        username: 'testuser',
        full_name: null,
        profile_pic_url: null,
      }),
    )

    await whoamiAction({})

    expect(logs).toHaveLength(1)
    const output = JSON.parse(logs[0])
    expect(output.full_name).toBeNull()
    expect(output.profile_pic_url).toBeNull()
  })
})
