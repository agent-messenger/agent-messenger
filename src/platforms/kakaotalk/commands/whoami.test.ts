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
    original_profile_image_url: 'https://example.com/avatar_orig.jpg',
    background_image_url: 'https://example.com/bg.jpg',
    original_background_image_url: 'https://example.com/bg_orig.jpg',
    fullname: 'Real Name',
    status_message: 'Hello!',
    account_display_id: 'testuser',
    account_email: 'test@example.com',
    pstn_number: '+821012345678',
    email_verified: true,
  }),
)

const mockClient = {
  getProfile: mockGetProfile,
}

mock.module('./shared', () => ({
  withKakaoClient: mockWithKakaoClient,
}))

import { whoamiCommand } from './whoami'

describe('whoami command', () => {
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
        original_profile_image_url: 'https://example.com/avatar_orig.jpg',
        background_image_url: 'https://example.com/bg.jpg',
        original_background_image_url: 'https://example.com/bg_orig.jpg',
        fullname: 'Real Name',
        status_message: 'Hello!',
        account_display_id: 'testuser',
        account_email: 'test@example.com',
        pstn_number: '+821012345678',
        email_verified: true,
      }),
    )

    consoleLogSpy = mock((..._args: unknown[]) => {})
    console.log = consoleLogSpy
  })

  afterEach(() => {
    console.log = originalConsoleLog
  })

  test('outputs profile information', async () => {
    await whoamiCommand.parseAsync([], { from: 'user' })

    expect(mockGetProfile).toHaveBeenCalled()
    const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
    expect(output.user_id).toBe('user-1')
    expect(output.nickname).toBe('Test User')
    expect(output.profile_image_url).toBe('https://example.com/avatar.jpg')
  })

  test('outputs enriched profile fields', async () => {
    await whoamiCommand.parseAsync([], { from: 'user' })

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
    expect(output.background_image_url).toBe('https://example.com/bg.jpg')
    expect(output.original_background_image_url).toBe('https://example.com/bg_orig.jpg')
    expect(output.fullname).toBe('Real Name')
    expect(output.status_message).toBe('Hello!')
    expect(output.account_display_id).toBe('testuser')
    expect(output.account_email).toBe('test@example.com')
    expect(output.pstn_number).toBe('+821012345678')
    expect(output.email_verified).toBe(true)
  })

  test('passes account option to withKakaoClient', async () => {
    await whoamiCommand.parseAsync(['--account', 'my-account'], { from: 'user' })

    expect(mockWithKakaoClient).toHaveBeenCalledWith(
      expect.objectContaining({ account: 'my-account' }),
      expect.any(Function),
    )
  })

  test('outputs profile with pretty flag', async () => {
    await whoamiCommand.parseAsync(['--pretty'], { from: 'user' })

    expect(mockGetProfile).toHaveBeenCalled()
    const rawOutput = consoleLogSpy.mock.calls[0][0]
    const output = JSON.parse(rawOutput)
    expect(output.user_id).toBe('user-1')
  })
})
