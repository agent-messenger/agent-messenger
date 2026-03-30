import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'

import { WebexClient } from '../client'
import { WebexCredentialManager } from '../credential-manager'
import { loginAction, logoutAction, statusAction } from './auth'

const mockPerson = {
  id: 'person-123',
  displayName: 'Test User',
  emails: ['test@example.com'],
  orgId: 'org-123',
  type: 'person' as const,
  created: '2024-01-01T00:00:00.000Z',
}

let clientLoginSpy: ReturnType<typeof spyOn>
let clientTestAuthSpy: ReturnType<typeof spyOn>
let credManagerGetTokenSpy: ReturnType<typeof spyOn>
let credManagerSetTokenSpy: ReturnType<typeof spyOn>
let credManagerClearCredentialsSpy: ReturnType<typeof spyOn>
let consoleLogSpy: ReturnType<typeof spyOn>
let processExitSpy: ReturnType<typeof spyOn>

beforeEach(() => {
  clientLoginSpy = spyOn(WebexClient.prototype, 'login').mockResolvedValue(
    new WebexClient() as InstanceType<typeof WebexClient>,
  )

  clientTestAuthSpy = spyOn(WebexClient.prototype, 'testAuth').mockResolvedValue(mockPerson)

  credManagerGetTokenSpy = spyOn(WebexCredentialManager.prototype, 'getToken').mockResolvedValue(
    'test-token-abc123',
  )

  credManagerSetTokenSpy = spyOn(WebexCredentialManager.prototype, 'setToken').mockResolvedValue(
    undefined,
  )

  credManagerClearCredentialsSpy = spyOn(
    WebexCredentialManager.prototype,
    'clearCredentials',
  ).mockResolvedValue(undefined)

  consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {})

  processExitSpy = spyOn(process, 'exit').mockImplementation((_code?: number) => {
    throw new Error(`process.exit(${_code})`)
  })
})

afterEach(() => {
  clientLoginSpy?.mockRestore()
  clientTestAuthSpy?.mockRestore()
  credManagerGetTokenSpy?.mockRestore()
  credManagerSetTokenSpy?.mockRestore()
  credManagerClearCredentialsSpy?.mockRestore()
  consoleLogSpy?.mockRestore()
  processExitSpy?.mockRestore()
})

describe('loginAction', () => {
  test('successful login: validates token, saves, and outputs user info', async () => {
    await loginAction({ token: 'test-token-abc123' })

    expect(clientLoginSpy).toHaveBeenCalledWith({ token: 'test-token-abc123' })
    expect(clientTestAuthSpy).toHaveBeenCalled()
    expect(credManagerSetTokenSpy).toHaveBeenCalledWith('test-token-abc123')
    expect(consoleLogSpy).toHaveBeenCalledWith(
      JSON.stringify({
        user: {
          id: 'person-123',
          displayName: 'Test User',
          emails: ['test@example.com'],
        },
        authenticated: true,
      }),
    )
  })

  test('successful login with pretty flag outputs formatted JSON', async () => {
    await loginAction({ token: 'test-token-abc123', pretty: true })

    expect(consoleLogSpy).toHaveBeenCalledWith(
      JSON.stringify(
        {
          user: {
            id: 'person-123',
            displayName: 'Test User',
            emails: ['test@example.com'],
          },
          authenticated: true,
        },
        null,
        2,
      ),
    )
  })

  test('failed validation: outputs error with hint and exits', async () => {
    clientTestAuthSpy.mockRejectedValue(new Error('401 Unauthorized'))

    await expect(loginAction({ token: 'bad-token' })).rejects.toThrow('process.exit(1)')

    expect(credManagerSetTokenSpy).not.toHaveBeenCalled()
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Token validation failed'),
    )
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('hint'))
  })

  test('failed validation with non-401 error outputs generic hint', async () => {
    clientTestAuthSpy.mockRejectedValue(new Error('Network error'))

    await expect(loginAction({ token: 'bad-token' })).rejects.toThrow('process.exit(1)')

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string) as {
      error: string
      hint: string
    }
    expect(output.hint).toContain('https://developer.webex.com')
  })
})

describe('statusAction', () => {
  test('not authenticated: outputs error and exits', async () => {
    credManagerGetTokenSpy.mockResolvedValue(null)

    await expect(statusAction({})).rejects.toThrow('process.exit(1)')

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Not authenticated'),
    )
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('auth login --token <token>'),
    )
  })

  test('authenticated: validates token and outputs user info', async () => {
    await statusAction({})

    expect(clientTestAuthSpy).toHaveBeenCalled()
    expect(consoleLogSpy).toHaveBeenCalledWith(
      JSON.stringify({
        authenticated: true,
        user: {
          id: 'person-123',
          displayName: 'Test User',
          emails: ['test@example.com'],
        },
      }),
    )
  })

  test('token invalid: outputs authenticated false with null user', async () => {
    clientTestAuthSpy.mockRejectedValue(new Error('401 Unauthorized'))

    await statusAction({})

    expect(consoleLogSpy).toHaveBeenCalledWith(
      JSON.stringify({ authenticated: false, user: null }),
    )
  })

  test('authenticated with pretty flag outputs formatted JSON', async () => {
    await statusAction({ pretty: true })

    expect(consoleLogSpy).toHaveBeenCalledWith(
      JSON.stringify(
        {
          authenticated: true,
          user: {
            id: 'person-123',
            displayName: 'Test User',
            emails: ['test@example.com'],
          },
        },
        null,
        2,
      ),
    )
  })
})

describe('logoutAction', () => {
  test('has credentials: clears and outputs success', async () => {
    await logoutAction({})

    expect(credManagerClearCredentialsSpy).toHaveBeenCalled()
    expect(consoleLogSpy).toHaveBeenCalledWith(
      JSON.stringify({ removed: 'webex', success: true }),
    )
  })

  test('no credentials: outputs error and exits', async () => {
    credManagerGetTokenSpy.mockResolvedValue(null)

    await expect(logoutAction({})).rejects.toThrow('process.exit(1)')

    expect(credManagerClearCredentialsSpy).not.toHaveBeenCalled()
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Not authenticated'),
    )
  })

  test('no credentials: error message includes login hint', async () => {
    credManagerGetTokenSpy.mockResolvedValue(null)

    await expect(logoutAction({})).rejects.toThrow('process.exit(1)')

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('auth login --token <token>'),
    )
  })
})
