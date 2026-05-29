import { afterEach, beforeEach, describe, expect, mock, spyOn, it } from 'bun:test'

const originalConsoleLog = console.log

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
  let consoleErrorSpy: ReturnType<typeof spyOn>
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
    consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {})
    processExitSpy = spyOn(process, 'exit').mockImplementation((_code?: number) => undefined as never)
    processExitSpy.mockClear()
  })

  afterEach(() => {
    console.log = originalConsoleLog
    consoleErrorSpy.mockRestore()
    processExitSpy.mockRestore()
  })

  describe('list', () => {
    it('lists chats with default limit', async () => {
      await chatCommand.parseAsync(['list'], { from: 'user' })

      expect(processExitSpy).toHaveBeenCalledWith(0)
      expect(mockListChats).toHaveBeenCalledWith(20)
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output).toHaveLength(1)
      expect(output[0].id).toBe('chat-1')
      expect(output[0].name).toBe('Alice')
    })

    it('respects --limit option', async () => {
      await chatCommand.parseAsync(['list', '--limit', '5'], { from: 'user' })

      expect(processExitSpy).toHaveBeenCalledWith(0)
      expect(mockListChats).toHaveBeenCalledWith(5)
    })

    it('passes account option to credential manager', async () => {
      await chatCommand.parseAsync(['list', '--account', 'my-account'], { from: 'user' })

      expect(processExitSpy).toHaveBeenCalledWith(0)
      expect(mockGetAccount).toHaveBeenCalledWith('my-account')
    })

    it('exits with error when no account configured', async () => {
      mockGetAccount.mockImplementation(() => Promise.resolve(null))

      await chatCommand.parseAsync(['list'], { from: 'user' })

      expect(processExitSpy).toHaveBeenCalledWith(1)
    })
  })

  describe('search', () => {
    it('searches chats by query', async () => {
      await chatCommand.parseAsync(['search', 'Bob'], { from: 'user' })

      expect(processExitSpy).toHaveBeenCalledWith(0)
      expect(mockSearchChats).toHaveBeenCalledWith('Bob', 20)
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output).toHaveLength(1)
      expect(output[0].id).toBe('chat-2')
      expect(output[0].name).toBe('Bob')
    })

    it('respects --limit option', async () => {
      await chatCommand.parseAsync(['search', 'Alice', '--limit', '3'], { from: 'user' })

      expect(processExitSpy).toHaveBeenCalledWith(0)
      expect(mockSearchChats).toHaveBeenCalledWith('Alice', 3)
    })

    it('passes account option to credential manager', async () => {
      await chatCommand.parseAsync(['search', 'test', '--account', 'my-account'], { from: 'user' })

      expect(processExitSpy).toHaveBeenCalledWith(0)
      expect(mockGetAccount).toHaveBeenCalledWith('my-account')
    })
  })
})
