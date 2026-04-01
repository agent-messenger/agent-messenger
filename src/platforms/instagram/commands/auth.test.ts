import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'

const originalConsoleLog = console.log
import type { Command } from 'commander'

const mockGetAccount = mock(() => Promise.resolve(null))
const mockListAccounts = mock(() => Promise.resolve([]))
const mockSetCurrent = mock(() => Promise.resolve(true))
const mockRemoveAccount = mock(() => Promise.resolve(true))

mock.module('../credential-manager', () => ({
  InstagramCredentialManager: class {
    getAccount = mockGetAccount
    listAccounts = mockListAccounts
    setCurrent = mockSetCurrent
    removeAccount = mockRemoveAccount
  },
}))

import { authCommand } from './auth'

function resetCommandState(cmd: Command): void {
  for (const sub of cmd.commands) {
    (sub as unknown as { _optionValues: Record<string, unknown>; _optionValueSources: Record<string, unknown> })._optionValues = {}
    ;(sub as unknown as { _optionValues: Record<string, unknown>; _optionValueSources: Record<string, unknown> })._optionValueSources = {}
  }
}

describe('auth commands', () => {
  let consoleLogSpy: ReturnType<typeof mock>
  let processExitSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    resetCommandState(authCommand)

    mockGetAccount.mockReset()
    mockListAccounts.mockReset()
    mockSetCurrent.mockReset()
    mockRemoveAccount.mockReset()

    consoleLogSpy = mock((..._args: unknown[]) => {}); console.log = consoleLogSpy
    processExitSpy = spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called')
    })
  })

  afterEach(() => {
    console.log = originalConsoleLog
    processExitSpy.mockRestore()
  })

  describe('status', () => {
    test('outputs error and exits when no account found', async () => {
      mockGetAccount.mockImplementation(() => Promise.resolve(null))

      await expect(
        authCommand.parseAsync(['status'], { from: 'user' }),
      ).rejects.toThrow('process.exit called')

      expect(processExitSpy).toHaveBeenCalledWith(1)
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output.error).toContain('No Instagram account configured')
    })

    test('outputs account info when account exists', async () => {
      mockGetAccount.mockImplementation(() =>
        Promise.resolve({
          account_id: 'user_testuser',
          username: 'testuser',
          pk: '12345',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
        }),
      )

      await authCommand.parseAsync(['status'], { from: 'user' })

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output.account_id).toBe('user_testuser')
      expect(output.username).toBe('testuser')
      expect(output.pk).toBe('12345')
    })

    test('outputs error for specific account not found', async () => {
      mockGetAccount.mockImplementation(() => Promise.resolve(null))

      await expect(
        authCommand.parseAsync(['status', '--account', 'missing_account'], { from: 'user' }),
      ).rejects.toThrow('process.exit called')

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output.error).toContain('missing_account')
    })
  })

  describe('list', () => {
    test('outputs empty array when no accounts', async () => {
      mockListAccounts.mockImplementation(() => Promise.resolve([]))

      await authCommand.parseAsync(['list'], { from: 'user' })

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output).toEqual([])
    })

    test('outputs accounts list', async () => {
      mockListAccounts.mockImplementation(() =>
        Promise.resolve([
          {
            account_id: 'user_alice',
            username: 'alice',
            pk: '111',
            created_at: '2024-01-01T00:00:00.000Z',
            updated_at: '2024-01-01T00:00:00.000Z',
            is_current: true,
          },
          {
            account_id: 'user_bob',
            username: 'bob',
            pk: '222',
            created_at: '2024-01-02T00:00:00.000Z',
            updated_at: '2024-01-02T00:00:00.000Z',
            is_current: false,
          },
        ]),
      )

      await authCommand.parseAsync(['list'], { from: 'user' })

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output).toHaveLength(2)
      expect(output[0].account_id).toBe('user_alice')
      expect(output[0].is_current).toBe(true)
      expect(output[1].account_id).toBe('user_bob')
      expect(output[1].is_current).toBe(false)
    })
  })

  describe('use', () => {
    test('switches to specified account', async () => {
      mockSetCurrent.mockImplementation(() => Promise.resolve(true))
      mockGetAccount.mockImplementation(() =>
        Promise.resolve({
          account_id: 'user_alice',
          username: 'alice',
          pk: '111',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
        }),
      )

      await authCommand.parseAsync(['use', 'user_alice'], { from: 'user' })

      expect(mockSetCurrent).toHaveBeenCalledWith('user_alice')
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output.success).toBe(true)
      expect(output.account_id).toBe('user_alice')
    })

    test('outputs error when account not found', async () => {
      mockSetCurrent.mockImplementation(() => Promise.resolve(false))

      await expect(
        authCommand.parseAsync(['use', 'missing_account'], { from: 'user' }),
      ).rejects.toThrow('process.exit called')

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output.error).toContain('missing_account')
    })
  })

  describe('logout', () => {
    test('removes account and outputs success', async () => {
      mockGetAccount.mockImplementation(() =>
        Promise.resolve({
          account_id: 'user_alice',
          username: 'alice',
          pk: '111',
          created_at: '2024-01-01T00:00:00.000Z',
          updated_at: '2024-01-01T00:00:00.000Z',
        }),
      )
      mockRemoveAccount.mockImplementation(() => Promise.resolve(true))

      await authCommand.parseAsync(['logout'], { from: 'user' })

      expect(mockRemoveAccount).toHaveBeenCalledWith('user_alice')
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output.success).toBe(true)
      expect(output.logged_out).toBe(true)
      expect(output.account_id).toBe('user_alice')
    })

    test('outputs error when no account configured', async () => {
      mockGetAccount.mockImplementation(() => Promise.resolve(null))

      await expect(
        authCommand.parseAsync(['logout'], { from: 'user' }),
      ).rejects.toThrow('process.exit called')

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output.error).toContain('No Instagram account configured')
    })

    test('outputs error for specific account not found', async () => {
      mockGetAccount.mockImplementation(() => Promise.resolve(null))

      await expect(
        authCommand.parseAsync(['logout', '--account', 'missing_account'], { from: 'user' }),
      ).rejects.toThrow('process.exit called')

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output.error).toContain('missing_account')
    })
  })
})
