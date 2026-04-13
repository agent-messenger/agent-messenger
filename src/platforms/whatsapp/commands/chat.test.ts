import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'

const originalConsoleLog = console.log

mock.module('@/shared/utils/error-handler', () => ({
  handleError: (err: Error) => {
    throw err
  },
}))

const mockGetAccount = mock(() =>
  Promise.resolve({
    account_id: 'plus-12025551234',
    phone_number: '+12025551234',
    name: 'Test User',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  }),
)
const mockEnsureAccountPaths = mock(() => Promise.resolve({ account_dir: '/tmp/test', auth_dir: '/tmp/test/auth' }))

mock.module('../credential-manager', () => ({
  WhatsAppCredentialManager: class {
    getAccount = mockGetAccount
    ensureAccountPaths = mockEnsureAccountPaths
  },
}))

const mockListChats = mock(() =>
  Promise.resolve([
    {
      id: 'chat-1',
      name: 'Alice',
      lastMessage: 'Hello',
      unreadCount: 2,
      timestamp: 1000,
    },
  ]),
)

const mockSearchChats = mock(() =>
  Promise.resolve([
    {
      id: 'chat-2',
      name: 'Bob',
      lastMessage: 'Hey',
      unreadCount: 0,
      timestamp: 2000,
    },
  ]),
)

const mockConnect = mock(() => Promise.resolve())
const mockClose = mock(() => Promise.resolve())

mock.module('../client', () => ({
  WhatsAppClient: class {
    login = mock(function (this: unknown) {
      return Promise.resolve(this)
    })
    connect = mockConnect
    close = mockClose
    listChats = mockListChats
    searchChats = mockSearchChats
  },
}))

import { chatCommand } from './chat'

describe('chat commands', () => {
  let consoleLogSpy: ReturnType<typeof mock>
  let processExitSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    mockGetAccount.mockReset()
    mockEnsureAccountPaths.mockReset()
    mockListChats.mockReset()
    mockSearchChats.mockReset()
    mockConnect.mockReset()
    mockClose.mockReset()

    mockGetAccount.mockImplementation(() =>
      Promise.resolve({
        account_id: 'plus-12025551234',
        phone_number: '+12025551234',
        name: 'Test User',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
      }),
    )
    mockEnsureAccountPaths.mockImplementation(() =>
      Promise.resolve({ account_dir: '/tmp/test', auth_dir: '/tmp/test/auth' }),
    )
    mockListChats.mockImplementation(() =>
      Promise.resolve([
        {
          id: 'chat-1',
          name: 'Alice',
          lastMessage: 'Hello',
          unreadCount: 2,
          timestamp: 1000,
        },
      ]),
    )
    mockSearchChats.mockImplementation(() =>
      Promise.resolve([
        {
          id: 'chat-2',
          name: 'Bob',
          lastMessage: 'Hey',
          unreadCount: 0,
          timestamp: 2000,
        },
      ]),
    )
    mockConnect.mockImplementation(() => Promise.resolve())
    mockClose.mockImplementation(() => Promise.resolve())

    consoleLogSpy = mock((..._args: unknown[]) => {})
    console.log = consoleLogSpy
    processExitSpy = spyOn(process, 'exit').mockImplementation((_code?: number) => {
      throw new Error(`process.exit(${_code})`)
    })
    processExitSpy.mockClear()
  })

  afterEach(() => {
    console.log = originalConsoleLog
    processExitSpy.mockRestore()
  })

  describe('list', () => {
    test('lists chats with default limit', async () => {
      await expect(chatCommand.parseAsync(['list'], { from: 'user' })).rejects.toThrow('process.exit(0)')

      expect(mockListChats).toHaveBeenCalledWith(20)
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output).toHaveLength(1)
      expect(output[0].id).toBe('chat-1')
      expect(output[0].name).toBe('Alice')
    })

    test('respects --limit option', async () => {
      await expect(chatCommand.parseAsync(['list', '--limit', '5'], { from: 'user' })).rejects.toThrow(
        'process.exit(0)',
      )

      expect(mockListChats).toHaveBeenCalledWith(5)
    })

    test('passes account option to credential manager', async () => {
      await expect(chatCommand.parseAsync(['list', '--account', 'my-account'], { from: 'user' })).rejects.toThrow(
        'process.exit(0)',
      )

      expect(mockGetAccount).toHaveBeenCalledWith('my-account')
    })

    test('exits with error when no account configured', async () => {
      mockGetAccount.mockImplementation(() => Promise.resolve(null))

      await expect(chatCommand.parseAsync(['list'], { from: 'user' })).rejects.toThrow('process.exit(1)')

      expect(processExitSpy).toHaveBeenCalledWith(1)
    })
  })

  describe('search', () => {
    test('searches chats by query', async () => {
      await expect(chatCommand.parseAsync(['search', 'Bob'], { from: 'user' })).rejects.toThrow('process.exit(0)')

      expect(mockSearchChats).toHaveBeenCalledWith('Bob', 20)
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output).toHaveLength(1)
      expect(output[0].id).toBe('chat-2')
      expect(output[0].name).toBe('Bob')
    })

    test('respects --limit option', async () => {
      await expect(chatCommand.parseAsync(['search', 'Alice', '--limit', '3'], { from: 'user' })).rejects.toThrow(
        'process.exit(0)',
      )

      expect(mockSearchChats).toHaveBeenCalledWith('Alice', 3)
    })

    test('passes account option to credential manager', async () => {
      await expect(
        chatCommand.parseAsync(['search', 'test', '--account', 'my-account'], { from: 'user' }),
      ).rejects.toThrow('process.exit(0)')

      expect(mockGetAccount).toHaveBeenCalledWith('my-account')
    })
  })
})
