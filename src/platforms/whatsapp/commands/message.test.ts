import { afterEach, beforeEach, describe, expect, mock, spyOn, it } from 'bun:test'

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

const mockGetMessages = mock(() =>
  Promise.resolve([
    {
      id: 'msg-1',
      text: 'Hello',
      from: '12025551234@s.whatsapp.net',
      timestamp: 1000,
      fromMe: false,
    },
  ]),
)

const mockSendMessage = mock(() =>
  Promise.resolve({
    id: 'msg-2',
    text: 'Hi there',
    from: 'me@s.whatsapp.net',
    timestamp: 2000,
    fromMe: true,
  }),
)

const mockSendReaction = mock(() => Promise.resolve())
const mockConnect = mock(() => Promise.resolve())
const mockClose = mock(() => Promise.resolve())

mock.module('../client', () => ({
  WhatsAppClient: class {
    login = mock(function (this: unknown) {
      return Promise.resolve(this)
    })
    connect = mockConnect
    close = mockClose
    getMessages = mockGetMessages
    sendMessage = mockSendMessage
    sendReaction = mockSendReaction
  },
}))

import { messageCommand } from './message'

describe('message commands', () => {
  let consoleLogSpy: ReturnType<typeof mock>
  let processExitSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    mockGetAccount.mockReset()
    mockEnsureAccountPaths.mockReset()
    mockGetMessages.mockReset()
    mockSendMessage.mockReset()
    mockSendReaction.mockReset()
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
    mockGetMessages.mockImplementation(() =>
      Promise.resolve([
        {
          id: 'msg-1',
          text: 'Hello',
          from: '12025551234@s.whatsapp.net',
          timestamp: 1000,
          fromMe: false,
        },
      ]),
    )
    mockSendMessage.mockImplementation(() =>
      Promise.resolve({
        id: 'msg-2',
        text: 'Hi there',
        from: 'me@s.whatsapp.net',
        timestamp: 2000,
        fromMe: true,
      }),
    )
    mockSendReaction.mockImplementation(() => Promise.resolve())
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
    it('fetches messages for a chat', async () => {
      await expect(messageCommand.parseAsync(['list', '12025551234@s.whatsapp.net'], { from: 'user' })).rejects.toThrow(
        'process.exit(0)',
      )

      expect(mockGetMessages).toHaveBeenCalledWith('12025551234@s.whatsapp.net', 25)
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output).toHaveLength(1)
      expect(output[0].id).toBe('msg-1')
      expect(output[0].text).toBe('Hello')
    })

    it('respects --limit option', async () => {
      await expect(
        messageCommand.parseAsync(['list', '12025551234@s.whatsapp.net', '--limit', '10'], { from: 'user' }),
      ).rejects.toThrow('process.exit(0)')

      expect(mockGetMessages).toHaveBeenCalledWith('12025551234@s.whatsapp.net', 10)
    })

    it('passes account option to credential manager', async () => {
      await expect(
        messageCommand.parseAsync(['list', '12025551234@s.whatsapp.net', '--account', 'my-account'], { from: 'user' }),
      ).rejects.toThrow('process.exit(0)')

      expect(mockGetAccount).toHaveBeenCalledWith('my-account')
    })

    it('exits with error when no account configured', async () => {
      mockGetAccount.mockImplementation(() => Promise.resolve(null))

      await expect(messageCommand.parseAsync(['list', '12025551234@s.whatsapp.net'], { from: 'user' })).rejects.toThrow(
        'process.exit(1)',
      )

      expect(processExitSpy).toHaveBeenCalledWith(1)
    })
  })

  describe('send', () => {
    it('sends a message to a chat', async () => {
      await expect(
        messageCommand.parseAsync(['send', '12025551234@s.whatsapp.net', 'Hello world'], { from: 'user' }),
      ).rejects.toThrow('process.exit(0)')

      expect(mockSendMessage).toHaveBeenCalledWith('12025551234@s.whatsapp.net', 'Hello world')
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output.id).toBe('msg-2')
      expect(output.text).toBe('Hi there')
    })

    it('passes account option to credential manager', async () => {
      await expect(
        messageCommand.parseAsync(['send', '12025551234@s.whatsapp.net', 'Hi', '--account', 'my-account'], {
          from: 'user',
        }),
      ).rejects.toThrow('process.exit(0)')

      expect(mockGetAccount).toHaveBeenCalledWith('my-account')
    })
  })

  describe('react', () => {
    it('sends a reaction to a message', async () => {
      await expect(
        messageCommand.parseAsync(['react', '12025551234@s.whatsapp.net', 'msg-1', '👍'], { from: 'user' }),
      ).rejects.toThrow('process.exit(0)')

      expect(mockSendReaction).toHaveBeenCalledWith('12025551234@s.whatsapp.net', 'msg-1', '👍', undefined)
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output.success).toBe(true)
      expect(output.chat).toBe('12025551234@s.whatsapp.net')
      expect(output.message_id).toBe('msg-1')
      expect(output.emoji).toBe('👍')
    })

    it('passes --from-me flag to sendReaction', async () => {
      await expect(
        messageCommand.parseAsync(['react', '12025551234@s.whatsapp.net', 'msg-1', '❤️', '--from-me'], {
          from: 'user',
        }),
      ).rejects.toThrow('process.exit(0)')

      expect(mockSendReaction).toHaveBeenCalledWith('12025551234@s.whatsapp.net', 'msg-1', '❤️', true)
    })

    it('passes account option to credential manager', async () => {
      await expect(
        messageCommand.parseAsync(['react', '12025551234@s.whatsapp.net', 'msg-1', '👍', '--account', 'my-account'], {
          from: 'user',
        }),
      ).rejects.toThrow('process.exit(0)')

      expect(mockGetAccount).toHaveBeenCalledWith('my-account')
    })
  })
})
