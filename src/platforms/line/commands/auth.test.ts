import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'

const originalConsoleLog = console.log

import { LineCredentialManager } from '../credential-manager'
import { authCommand } from './auth'

let getAccountSpy: ReturnType<typeof spyOn>
let listAccountsSpy: ReturnType<typeof spyOn>
let setCurrentAccountSpy: ReturnType<typeof spyOn>
let removeAccountSpy: ReturnType<typeof spyOn>
let clearAllSpy: ReturnType<typeof spyOn>
let consoleLogSpy: ReturnType<typeof mock>

beforeEach(() => {
  getAccountSpy = spyOn(LineCredentialManager.prototype, 'getAccount').mockResolvedValue({
    account_id: 'u123',
    auth_token: 'token-abc',
    device: 'ANDROIDSECONDARY',
    display_name: 'Test User',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  })

  listAccountsSpy = spyOn(LineCredentialManager.prototype, 'listAccounts').mockResolvedValue([
    {
      account_id: 'u123',
      display_name: 'Test User',
      device: 'ANDROIDSECONDARY',
      is_current: true,
      created_at: '2024-01-01T00:00:00Z',
    },
    {
      account_id: 'u456',
      display_name: 'Other User',
      device: 'DESKTOPMAC',
      is_current: false,
      created_at: '2024-01-02T00:00:00Z',
    },
  ])

  setCurrentAccountSpy = spyOn(LineCredentialManager.prototype, 'setCurrentAccount').mockResolvedValue(undefined)
  removeAccountSpy = spyOn(LineCredentialManager.prototype, 'removeAccount').mockResolvedValue(undefined)
  clearAllSpy = spyOn(LineCredentialManager.prototype, 'clearAll').mockResolvedValue(undefined)
  consoleLogSpy = mock((..._args: unknown[]) => {})
  console.log = consoleLogSpy
})

afterEach(() => {
  getAccountSpy?.mockRestore()
  listAccountsSpy?.mockRestore()
  setCurrentAccountSpy?.mockRestore()
  removeAccountSpy?.mockRestore()
  clearAllSpy?.mockRestore()
  console.log = originalConsoleLog
})

test('status: outputs account info when account exists', async () => {
  // when
  await authCommand.parseAsync(['node', 'auth', 'status'])

  // then
  expect(getAccountSpy).toHaveBeenCalledTimes(1)
  expect(consoleLogSpy).toHaveBeenCalledTimes(1)
  const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
  expect(output.account_id).toBe('u123')
  expect(output.display_name).toBe('Test User')
  expect(output.device).toBe('ANDROIDSECONDARY')
})

test('status: outputs error when no account configured', async () => {
  // given
  getAccountSpy.mockResolvedValue(null)

  // when
  await authCommand.parseAsync(['node', 'auth', 'status'])

  // then
  expect(consoleLogSpy).toHaveBeenCalledTimes(1)
  const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
  expect(output.error).toBe('No LINE account configured')
})

test('list: outputs all accounts', async () => {
  // when
  await authCommand.parseAsync(['node', 'auth', 'list'])

  // then
  expect(listAccountsSpy).toHaveBeenCalledTimes(1)
  expect(consoleLogSpy).toHaveBeenCalledTimes(1)
  const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
  expect(output).toHaveLength(2)
  expect(output[0].account_id).toBe('u123')
  expect(output[1].account_id).toBe('u456')
})

test('list: outputs empty array when no accounts', async () => {
  // given
  listAccountsSpy.mockResolvedValue([])

  // when
  await authCommand.parseAsync(['node', 'auth', 'list'])

  // then
  const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
  expect(output).toHaveLength(0)
})

test('use: sets current account and outputs result', async () => {
  // when
  await authCommand.parseAsync(['node', 'auth', 'use', 'u456'])

  // then
  expect(setCurrentAccountSpy).toHaveBeenCalledWith('u456')
  expect(consoleLogSpy).toHaveBeenCalledTimes(1)
  const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
  expect(output.current_account).toBe('u456')
})

test('logout: removes specific account when account-id provided', async () => {
  // when
  await authCommand.parseAsync(['node', 'auth', 'logout', 'u123'])

  // then
  expect(removeAccountSpy).toHaveBeenCalledWith('u123')
  expect(consoleLogSpy).toHaveBeenCalledTimes(1)
  const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
  expect(output.success).toBe(true)
  expect(output.message).toContain('u123')
})

test('logout: clears all accounts when no account-id provided', async () => {
  // when
  await authCommand.parseAsync(['node', 'auth', 'logout'])

  // then
  expect(clearAllSpy).toHaveBeenCalledTimes(1)
  expect(consoleLogSpy).toHaveBeenCalledTimes(1)
  const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
  expect(output.success).toBe(true)
  expect(output.message).toBe('Logged out')
})
