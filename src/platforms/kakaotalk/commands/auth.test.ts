import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'

const originalConsoleLog = console.log

const mockLoad = mock(() =>
  Promise.resolve({ current_account: null, accounts: {} }),
)
const mockGetAccount = mock(() => Promise.resolve(null))
const mockListAccounts = mock(() => Promise.resolve([]))
const mockSetAccount = mock(() => Promise.resolve())
const mockSetCurrentAccount = mock(() => Promise.resolve())
const mockRemoveAccount = mock(() => Promise.resolve())
const mockLoadPendingLogin = mock(() => Promise.resolve(null))

mock.module('../credential-manager', () => ({
  CredentialManager: class {
    load = mockLoad
    getAccount = mockGetAccount
    listAccounts = mockListAccounts
    setAccount = mockSetAccount
    setCurrentAccount = mockSetCurrentAccount
    removeAccount = mockRemoveAccount
    loadPendingLogin = mockLoadPendingLogin
  },
  KakaoCredentialManager: class {
    load = mockLoad
    getAccount = mockGetAccount
    listAccounts = mockListAccounts
    setAccount = mockSetAccount
    setCurrentAccount = mockSetCurrentAccount
    removeAccount = mockRemoveAccount
    loadPendingLogin = mockLoadPendingLogin
  },
}))

import { authCommand } from './auth'

describe('auth commands', () => {
  let consoleLogSpy: ReturnType<typeof mock>
  let processExitSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    mockLoad.mockReset()
    mockGetAccount.mockReset()
    mockListAccounts.mockReset()
    mockSetAccount.mockReset()
    mockSetCurrentAccount.mockReset()
    mockRemoveAccount.mockReset()
    mockLoadPendingLogin.mockReset()

    mockLoad.mockImplementation(() =>
      Promise.resolve({ current_account: null, accounts: {} }),
    )
    mockGetAccount.mockImplementation(() => Promise.resolve(null))
    mockListAccounts.mockImplementation(() => Promise.resolve([]))
    mockSetAccount.mockImplementation(() => Promise.resolve())
    mockSetCurrentAccount.mockImplementation(() => Promise.resolve())
    mockRemoveAccount.mockImplementation(() => Promise.resolve())
    mockLoadPendingLogin.mockImplementation(() => Promise.resolve(null))

    consoleLogSpy = mock((..._args: unknown[]) => {})
    console.log = consoleLogSpy
    processExitSpy = spyOn(process, 'exit').mockImplementation((_code?: number) => {
      throw new Error(`process.exit(${_code})`)
    })
  })

  afterEach(() => {
    console.log = originalConsoleLog
    processExitSpy?.mockRestore()
  })

  describe('list', () => {
    test('outputs empty array when no accounts', async () => {
      mockListAccounts.mockImplementation(() => Promise.resolve([]))

      await authCommand.parseAsync(['list'], { from: 'user' })

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output).toEqual([])
    })

    test('outputs accounts list with is_current flag', async () => {
      mockListAccounts.mockImplementation(() =>
        Promise.resolve([
          {
            account_id: 'user-1',
            user_id: 'user-1',
            device_type: 'tablet',
            created_at: '2024-01-01T00:00:00.000Z',
            updated_at: '2024-01-01T00:00:00.000Z',
            is_current: true,
            oauth_token: 'token-1',
            refresh_token: 'refresh-1',
            device_uuid: 'uuid-1',
          },
          {
            account_id: 'user-2',
            user_id: 'user-2',
            device_type: 'pc',
            created_at: '2024-01-02T00:00:00.000Z',
            updated_at: '2024-01-02T00:00:00.000Z',
            is_current: false,
            oauth_token: 'token-2',
            refresh_token: 'refresh-2',
            device_uuid: 'uuid-2',
          },
        ]),
      )

      await authCommand.parseAsync(['list'], { from: 'user' })

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output).toHaveLength(2)
      expect(output[0].account_id).toBe('user-1')
      expect(output[0].is_current).toBe(true)
      expect(output[1].account_id).toBe('user-2')
      expect(output[1].is_current).toBe(false)
    })
  })

  describe('use', () => {
    test('switches to specified account', async () => {
      mockGetAccount.mockImplementation(() =>
        Promise.resolve({
          account_id: 'user-1',
          user_id: 'user-1',
          device_type: 'tablet',
          oauth_token: 'token-1',
          refresh_token: 'refresh-1',
          device_uuid: 'uuid-1',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
        }),
      )

      await authCommand.parseAsync(['use', 'user-1'], { from: 'user' })

      expect(mockSetCurrentAccount).toHaveBeenCalledWith('user-1')
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output.success).toBe(true)
      expect(output.account_id).toBe('user-1')
    })

    test('outputs error and exits when account not found', async () => {
      mockGetAccount.mockImplementation(() => Promise.resolve(null))

      await expect(
        authCommand.parseAsync(['use', 'nonexistent'], { from: 'user' }),
      ).rejects.toThrow('process.exit')

      expect(processExitSpy).toHaveBeenCalledWith(1)
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output.error).toContain('nonexistent')
    })
  })

  describe('status', () => {
    test('outputs error and exits when no account configured', async () => {
      mockGetAccount.mockImplementation(() => Promise.resolve(null))

      await expect(
        authCommand.parseAsync(['status'], { from: 'user' }),
      ).rejects.toThrow('process.exit')

      expect(processExitSpy).toHaveBeenCalledWith(1)
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output.error).toBeDefined()
    })

    test('outputs account info when account exists', async () => {
      mockGetAccount.mockImplementation(() =>
        Promise.resolve({
          account_id: 'user-1',
          user_id: 'user-1',
          device_type: 'tablet',
          oauth_token: 'token-1',
          refresh_token: 'refresh-1',
          device_uuid: 'uuid-1',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
        }),
      )

      await authCommand.parseAsync(['status'], { from: 'user' })

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output.account_id).toBe('user-1')
      expect(output.user_id).toBe('user-1')
      expect(output.device_type).toBe('tablet')
      expect(output.has_refresh_token).toBe(true)
      expect(output.has_device_uuid).toBe(true)
    })

    test('outputs status for specific --account', async () => {
      mockGetAccount.mockImplementation((id?: string) => {
        if (id === 'user-2') {
          return Promise.resolve({
            account_id: 'user-2',
            user_id: 'user-2',
            device_type: 'pc',
            oauth_token: 'token-2',
            refresh_token: 'refresh-2',
            device_uuid: 'uuid-2',
            created_at: '2024-01-02T00:00:00.000Z',
            updated_at: '2024-01-02T00:00:00.000Z',
          })
        }
        return Promise.resolve(null)
      })

      await authCommand.parseAsync(['status', '--account', 'user-2'], { from: 'user' })

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output.account_id).toBe('user-2')
      expect(output.device_type).toBe('pc')
    })
  })

  describe('logout', () => {
    test('removes current account and outputs success', async () => {
      mockLoad.mockImplementation(() =>
        Promise.resolve({
          current_account: 'user-1',
          accounts: {
            'user-1': {
              account_id: 'user-1',
              user_id: 'user-1',
              device_type: 'tablet',
              oauth_token: 'token-1',
              refresh_token: 'refresh-1',
              device_uuid: 'uuid-1',
              created_at: '2024-01-01T00:00:00.000Z',
              updated_at: '2024-01-01T00:00:00.000Z',
            },
          },
        }),
      )

      await authCommand.parseAsync(['logout'], { from: 'user' })

      expect(mockRemoveAccount).toHaveBeenCalledWith('user-1')
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output.success).toBe(true)
      expect(output.removed).toBe('user-1')
    })

    test('removes specific account with --account flag', async () => {
      mockLoad.mockImplementation(() =>
        Promise.resolve({
          current_account: 'user-1',
          accounts: {
            'user-1': {
              account_id: 'user-1',
              user_id: 'user-1',
              device_type: 'tablet',
              oauth_token: 'token-1',
              refresh_token: 'refresh-1',
              device_uuid: 'uuid-1',
              created_at: '2024-01-01T00:00:00.000Z',
              updated_at: '2024-01-01T00:00:00.000Z',
            },
            'user-2': {
              account_id: 'user-2',
              user_id: 'user-2',
              device_type: 'pc',
              oauth_token: 'token-2',
              refresh_token: 'refresh-2',
              device_uuid: 'uuid-2',
              created_at: '2024-01-02T00:00:00.000Z',
              updated_at: '2024-01-02T00:00:00.000Z',
            },
          },
        }),
      )

      await authCommand.parseAsync(['logout', '--account', 'user-2'], { from: 'user' })

      expect(mockRemoveAccount).toHaveBeenCalledWith('user-2')
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output.success).toBe(true)
      expect(output.removed).toBe('user-2')
    })

    test('outputs error and exits when no account configured', async () => {
      mockLoad.mockImplementation(() =>
        Promise.resolve({ current_account: null, accounts: {} }),
      )

      await expect(
        authCommand.parseAsync(['logout'], { from: 'user' }),
      ).rejects.toThrow('process.exit')

      expect(processExitSpy).toHaveBeenCalledWith(1)
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output.error).toBeDefined()
    })
  })
})
