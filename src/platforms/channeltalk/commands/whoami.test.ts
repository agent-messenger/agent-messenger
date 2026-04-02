import { beforeEach, describe, expect, mock, test } from 'bun:test'

const mockGetAccount = mock(() =>
  Promise.resolve({
    id: 'account-1',
    name: 'Test User',
    email: 'test@example.com',
    emailVerified: true,
    language: 'en',
    country: 'US',
    createdAt: 1700000000000,
  }),
)

mock.module('./shared', () => ({
  getClient: async () => ({
    getAccount: mockGetAccount,
  }),
  getCurrentWorkspaceId: async () => 'ws-1',
}))

import { whoamiAction } from './whoami'

describe('whoami command', () => {
  beforeEach(() => {
    mockGetAccount.mockReset()
    mockGetAccount.mockImplementation(() =>
      Promise.resolve({
        id: 'account-1',
        name: 'Test User',
        email: 'test@example.com',
        emailVerified: true,
        language: 'en',
        country: 'US',
        createdAt: 1700000000000,
      }),
    )
  })

  test('whoamiAction returns account info', async () => {
    const result = await whoamiAction({})

    expect(mockGetAccount).toHaveBeenCalled()
    expect(result.account).toEqual({
      id: 'account-1',
      name: 'Test User',
      email: 'test@example.com',
      email_verified: true,
      language: 'en',
      country: 'US',
      created_at: 1700000000000,
    })
    expect(result.error).toBeUndefined()
  })

  test('whoamiAction returns error when getAccount fails', async () => {
    mockGetAccount.mockImplementation(() => Promise.reject(new Error('Not authenticated')))

    const result = await whoamiAction({})

    expect(result.error).toBe('Not authenticated')
    expect(result.account).toBeUndefined()
  })
})
