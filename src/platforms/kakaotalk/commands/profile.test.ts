import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'

const originalConsoleLog = console.log

const mockWithKakaoClient = mock(
  async (_options: unknown, fn: (client: unknown) => Promise<unknown>) => {
    return fn(mockClient)
  },
)

const mockGetProfile = mock(() =>
  Promise.resolve({
    user_id: 'user-1',
    nickname: 'Test User',
    profile_image_url: 'https://example.com/avatar.jpg',
  }),
)

const mockClient = {
  getProfile: mockGetProfile,
}

mock.module('./shared', () => ({
  withKakaoClient: mockWithKakaoClient,
}))

import { profileCommand } from './profile'

describe('profile command', () => {
  let consoleLogSpy: ReturnType<typeof mock>

  beforeEach(() => {
    mockWithKakaoClient.mockReset()
    mockGetProfile.mockReset()

    mockWithKakaoClient.mockImplementation(
      async (_options: unknown, fn: (client: unknown) => Promise<unknown>) => {
        return fn(mockClient)
      },
    )
    mockGetProfile.mockImplementation(() =>
      Promise.resolve({
        user_id: 'user-1',
        nickname: 'Test User',
        profile_image_url: 'https://example.com/avatar.jpg',
      }),
    )

    consoleLogSpy = mock((..._args: unknown[]) => {})
    console.log = consoleLogSpy
  })

  afterEach(() => {
    console.log = originalConsoleLog
  })

  test('outputs profile information', async () => {
    await profileCommand.parseAsync([], { from: 'user' })

    expect(mockGetProfile).toHaveBeenCalled()
    const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
    expect(output.user_id).toBe('user-1')
    expect(output.nickname).toBe('Test User')
    expect(output.profile_image_url).toBe('https://example.com/avatar.jpg')
  })

  test('passes account option to withKakaoClient', async () => {
    await profileCommand.parseAsync(['--account', 'my-account'], { from: 'user' })

    expect(mockWithKakaoClient).toHaveBeenCalledWith(
      expect.objectContaining({ account: 'my-account' }),
      expect.any(Function),
    )
  })

  test('outputs profile with pretty flag', async () => {
    await profileCommand.parseAsync(['--pretty'], { from: 'user' })

    expect(mockGetProfile).toHaveBeenCalled()
    const rawOutput = consoleLogSpy.mock.calls[0][0]
    const output = JSON.parse(rawOutput)
    expect(output.user_id).toBe('user-1')
  })
})
