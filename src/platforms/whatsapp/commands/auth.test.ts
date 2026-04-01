import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'

const originalConsoleLog = console.log

mock.module('@/shared/utils/error-handler', () => ({
  handleError: (err: Error) => { throw err },
}))

const mockGetAccount = mock(() => Promise.resolve(null))
const mockListAccounts = mock(() => Promise.resolve([]))
const mockSetCurrent = mock(() => Promise.resolve(false))
const mockRemoveAccount = mock(() => Promise.resolve(false))
const mockGetAccountPaths = mock(() => ({ account_dir: '/tmp/test', auth_dir: '/tmp/test/auth' }))

mock.module('../credential-manager', () => ({
  WhatsAppCredentialManager: class {
    getAccount = mockGetAccount
    listAccounts = mockListAccounts
    setCurrent = mockSetCurrent
    removeAccount = mockRemoveAccount
    getAccountPaths = mockGetAccountPaths
    ensureAccountPaths = mock(() => Promise.resolve({ account_dir: '/tmp/test', auth_dir: '/tmp/test/auth' }))
    setAccount = mock(() => Promise.resolve())
  },
}))

const mockConnect = mock(() => Promise.resolve())
const mockClose = mock(() => Promise.resolve())
const mockGetSocket = mock(() => null)
const mockLogin = mock(function (this: unknown) { return Promise.resolve(this) })

mock.module('../client', () => ({
  WhatsAppClient: class {
    login = mockLogin
    connect = mockConnect
    close = mockClose
    getSocket = mockGetSocket
  },
}))

import { authCommand } from './auth'

describe('auth commands', () => {
  let consoleLogSpy: ReturnType<typeof mock>
  let processExitSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    mockGetAccount.mockReset()
    mockListAccounts.mockReset()
    mockSetCurrent.mockReset()
    mockRemoveAccount.mockReset()
    mockGetAccountPaths.mockReset()
    mockConnect.mockReset()
    mockClose.mockReset()
    mockGetSocket.mockReset()
    mockLogin.mockReset()

    mockGetAccount.mockImplementation(() => Promise.resolve(null))
    mockListAccounts.mockImplementation(() => Promise.resolve([]))
    mockSetCurrent.mockImplementation(() => Promise.resolve(false))
    mockRemoveAccount.mockImplementation(() => Promise.resolve(false))
    mockGetAccountPaths.mockImplementation(() => ({ account_dir: '/tmp/test', auth_dir: '/tmp/test/auth' }))
    mockConnect.mockImplementation(() => Promise.resolve())
    mockClose.mockImplementation(() => Promise.resolve())
    mockGetSocket.mockImplementation(() => null)
    mockLogin.mockImplementation(function (this: unknown) { return Promise.resolve(this) })

    consoleLogSpy = mock((..._args: unknown[]) => {}); console.log = consoleLogSpy
    processExitSpy = spyOn(process, 'exit').mockImplementation((_code?: number) => {
      throw new Error(`process.exit(${_code})`)
    })
    processExitSpy.mockClear()
  })

  afterEach(() => {
    console.log = originalConsoleLog
    processExitSpy.mockRestore()
  })

  // list has no throwing tests — run first to avoid Commander state corruption
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
            account_id: 'plus-12025551234',
            phone_number: '+12025551234',
            name: 'Alice',
            created_at: '2024-01-01T00:00:00.000Z',
            updated_at: '2024-01-01T00:00:00.000Z',
            is_current: true,
          },
          {
            account_id: 'plus-19995551234',
            phone_number: '+19995551234',
            name: null,
            created_at: '2024-01-02T00:00:00.000Z',
            updated_at: '2024-01-02T00:00:00.000Z',
            is_current: false,
          },
        ]),
      )

      await authCommand.parseAsync(['list'], { from: 'user' })

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output).toHaveLength(2)
      expect(output[0].account_id).toBe('plus-12025551234')
      expect(output[0].is_current).toBe(true)
      expect(output[1].account_id).toBe('plus-19995551234')
      expect(output[1].is_current).toBe(false)
    })
  })

  // use: success test first, then throwing test last
  describe('use', () => {
    test('switches to specified account and outputs success', async () => {
      mockSetCurrent.mockImplementation(() => Promise.resolve(true))
      mockGetAccount.mockImplementation(() =>
        Promise.resolve({
          account_id: 'plus-12025551234',
          phone_number: '+12025551234',
          name: 'Alice',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
        }),
      )

      await authCommand.parseAsync(['use', 'plus-12025551234'], { from: 'user' })

      expect(mockSetCurrent).toHaveBeenCalledWith('plus-12025551234')
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output.success).toBe(true)
      expect(output.account_id).toBe('plus-12025551234')
    })

    test('outputs error and exits when account not found', async () => {
      mockSetCurrent.mockImplementation(() => Promise.resolve(false))

      await expect(
        authCommand.parseAsync(['use', 'nonexistent'], { from: 'user' }),
      ).rejects.toThrow('process.exit(1)')

      expect(processExitSpy).toHaveBeenCalledWith(1)
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output.error).toContain('nonexistent')
    })
  })

  // status: no-account tests first, --account tests last (avoids Commander option caching)
  describe('status', () => {
    test('outputs account info when account exists', async () => {
      mockGetAccount.mockImplementation(() =>
        Promise.resolve({
          account_id: 'plus-12025551234',
          phone_number: '+12025551234',
          name: 'Test User',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
        }),
      )

      await authCommand.parseAsync(['status'], { from: 'user' })

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output.account_id).toBe('plus-12025551234')
      expect(output.phone_number).toBe('+12025551234')
      expect(output.name).toBe('Test User')
    })

    test('outputs error and exits when no account configured', async () => {
      mockGetAccount.mockImplementation(() => Promise.resolve(null))

      await expect(
        authCommand.parseAsync(['status'], { from: 'user' }),
      ).rejects.toThrow('process.exit(1)')

      expect(processExitSpy).toHaveBeenCalledWith(1)
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output.error).toBeDefined()
      expect(output.error).toContain('No WhatsApp account configured')
    })

    test('passes --account option to getAccount', async () => {
      mockGetAccount.mockImplementation((id?: string) => {
        if (id === 'plus-19995551234') {
          return Promise.resolve({
            account_id: 'plus-19995551234',
            phone_number: '+19995551234',
            name: null,
            created_at: '2024-01-01T00:00:00.000Z',
            updated_at: '2024-01-01T00:00:00.000Z',
          })
        }
        return Promise.resolve(null)
      })

      await authCommand.parseAsync(['status', '--account', 'plus-19995551234'], { from: 'user' })

      expect(mockGetAccount).toHaveBeenCalledWith('plus-19995551234')
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output.account_id).toBe('plus-19995551234')
    })

    test('outputs error for specific missing account', async () => {
      mockGetAccount.mockImplementation(() => Promise.resolve(null))

      await expect(
        authCommand.parseAsync(['status', '--account', 'missing-id'], { from: 'user' }),
      ).rejects.toThrow('process.exit(1)')

      expect(processExitSpy).toHaveBeenCalledWith(1)
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output.error).toContain('missing-id')
    })
  })

  // logout: no-account tests first, --account test last (avoids Commander option caching)
  describe('logout', () => {
    test('removes current account and outputs success', async () => {
      mockGetAccount.mockImplementation(() =>
        Promise.resolve({
          account_id: 'plus-12025551234',
          phone_number: '+12025551234',
          name: 'Alice',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
        }),
      )
      mockRemoveAccount.mockImplementation(() => Promise.resolve(true))

      await expect(
        authCommand.parseAsync(['logout'], { from: 'user' }),
      ).rejects.toThrow('process.exit(0)')

      expect(mockRemoveAccount).toHaveBeenCalledWith('plus-12025551234')
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output.success).toBe(true)
      expect(output.account_id).toBe('plus-12025551234')
      expect(output.logged_out).toBe(true)
    })

    test('outputs error and exits when no account configured', async () => {
      mockGetAccount.mockImplementation(() => Promise.resolve(null))

      await expect(
        authCommand.parseAsync(['logout'], { from: 'user' }),
      ).rejects.toThrow('process.exit(1)')

      expect(processExitSpy).toHaveBeenCalledWith(1)
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output.error).toBeDefined()
    })

    test('proceeds with local cleanup even when client connection fails', async () => {
      mockGetAccount.mockImplementation(() =>
        Promise.resolve({
          account_id: 'plus-12025551234',
          phone_number: '+12025551234',
          name: 'Alice',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
        }),
      )
      mockConnect.mockImplementation(() => Promise.reject(new Error('Connection failed')))
      mockRemoveAccount.mockImplementation(() => Promise.resolve(true))

      await expect(
        authCommand.parseAsync(['logout'], { from: 'user' }),
      ).rejects.toThrow('process.exit(0)')

      expect(mockRemoveAccount).toHaveBeenCalledWith('plus-12025551234')
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output.success).toBe(true)
    })

    test('removes specific account with --account flag', async () => {
      mockGetAccount.mockImplementation((id?: string) => {
        if (id === 'plus-19995551234') {
          return Promise.resolve({
            account_id: 'plus-19995551234',
            phone_number: '+19995551234',
            name: null,
            created_at: '2024-01-01T00:00:00.000Z',
            updated_at: '2024-01-01T00:00:00.000Z',
          })
        }
        return Promise.resolve(null)
      })
      mockRemoveAccount.mockImplementation(() => Promise.resolve(true))

      await expect(
        authCommand.parseAsync(['logout', '--account', 'plus-19995551234'], { from: 'user' }),
      ).rejects.toThrow('process.exit(0)')

      expect(mockRemoveAccount).toHaveBeenCalledWith('plus-19995551234')
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output.success).toBe(true)
      expect(output.account_id).toBe('plus-19995551234')
    })
  })
})
