import { afterEach, beforeEach, describe, expect, mock, it } from 'bun:test'

const originalConsoleLog = console.log
const originalExit = process.exit

const mockWithKakaoClient = mock(async (_options: unknown, fn: (client: unknown) => Promise<unknown>) => {
  return fn(mockClient)
})

const mockGetMembers = mock(() =>
  Promise.resolve([
    {
      user_id: '42',
      nickname: 'Alice',
      profile_image_url: null,
      full_profile_image_url: null,
      original_profile_image_url: null,
      status_message: null,
      country_iso: null,
      user_type: 100,
      open_token: null,
      open_profile_link_id: null,
      open_permission: null,
    },
  ]),
)

const mockKickMember = mock((_chatId: string, _userId: string) =>
  Promise.resolve({ success: true, status_code: 0, chat_id: '300', user_id: '42' }),
)
const mockGetKickList = mock((_chatId: string) =>
  Promise.resolve({
    success: true,
    status_code: 0,
    chat_id: '300',
    members: [{ user_id: '42', nickname: 'Spammer', chat_id: '300', kicked_at: null }],
  }),
)
const mockUnkickMember = mock((_chatId: string, _userId: string) =>
  Promise.resolve({ success: true, status_code: 0, chat_id: '300', user_id: '42' }),
)

const mockClient = {
  getMembers: mockGetMembers,
  kickMember: mockKickMember,
  getKickList: mockGetKickList,
  unkickMember: mockUnkickMember,
}

mock.module('./shared', () => ({
  withKakaoClient: mockWithKakaoClient,
}))

import { memberCommand } from './member'

describe('member commands', () => {
  let consoleLogSpy: ReturnType<typeof mock>

  beforeEach(() => {
    mockWithKakaoClient.mockReset()
    mockGetMembers.mockReset()
    mockKickMember.mockClear()
    mockGetKickList.mockClear()
    mockUnkickMember.mockClear()

    mockWithKakaoClient.mockImplementation(async (_options: unknown, fn: (client: unknown) => Promise<unknown>) => {
      return fn(mockClient)
    })
    mockGetMembers.mockImplementation(() =>
      Promise.resolve([
        {
          user_id: '42',
          nickname: 'Alice',
          profile_image_url: null,
          full_profile_image_url: null,
          original_profile_image_url: null,
          status_message: null,
          country_iso: null,
          user_type: 100,
          open_token: null,
          open_profile_link_id: null,
          open_permission: null,
        },
      ]),
    )

    consoleLogSpy = mock((..._args: unknown[]) => {})
    console.log = consoleLogSpy
  })

  afterEach(() => {
    console.log = originalConsoleLog
    process.exit = originalExit
  })

  const EXIT_SENTINEL = 'process.exit called'

  function stubExit(): ReturnType<typeof mock> {
    const exitSpy = mock((_code?: number): never => {
      throw new Error(EXIT_SENTINEL)
    })
    process.exit = exitSpy as unknown as typeof process.exit
    return exitSpy
  }

  async function parseExpectingExit(args: string[]): Promise<void> {
    try {
      await memberCommand.parseAsync(args, { from: 'user' })
    } catch (error) {
      // The process.exit stub throws to abort the action; anything else is a real failure.
      if (!(error instanceof Error) || error.message !== EXIT_SENTINEL) throw error
    }
  }

  describe('list', () => {
    it('lists members of a chat room', async () => {
      await memberCommand.parseAsync(['list', '9876543210'], { from: 'user' })

      expect(mockGetMembers).toHaveBeenCalledWith('9876543210')
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output).toHaveLength(1)
      expect(output[0].user_id).toBe('42')
      expect(output[0].nickname).toBe('Alice')
    })

    it('passes --account option to withKakaoClient', async () => {
      await memberCommand.parseAsync(['list', '9876543210', '--account', 'my-account'], { from: 'user' })

      expect(mockWithKakaoClient).toHaveBeenCalledWith(
        expect.objectContaining({ account: 'my-account' }),
        expect.any(Function),
      )
    })

    it('outputs empty array when chat has no members', async () => {
      mockGetMembers.mockImplementation(() => Promise.resolve([]))

      await memberCommand.parseAsync(['list', '9876543210'], { from: 'user' })

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output).toEqual([])
    })
  })

  describe('kick', () => {
    it('refuses without --force, prints a preview, and never connects', async () => {
      const exitSpy = stubExit()

      await parseExpectingExit(['kick', '300', '42'])

      expect(exitSpy).toHaveBeenCalledWith(1)
      expect(exitSpy).toHaveBeenCalledTimes(1)
      expect(mockWithKakaoClient).not.toHaveBeenCalled()
      expect(mockKickMember).not.toHaveBeenCalled()
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output).toEqual({
        warning: 'Kicking is irreversible and blocks the member from rejoining. Use --force to confirm.',
        action: 'kick',
        chat_id: '300',
        user_id: '42',
      })
    })

    it('kicks the member with --force', async () => {
      await memberCommand.parseAsync(['kick', '300', '42', '--force'], { from: 'user' })

      expect(mockKickMember).toHaveBeenCalledWith('300', '42')
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output).toEqual({ success: true, status_code: 0, chat_id: '300', user_id: '42' })
    })

    it('passes --account option to withKakaoClient', async () => {
      await memberCommand.parseAsync(['kick', '300', '42', '--force', '--account', 'my-account'], { from: 'user' })

      expect(mockWithKakaoClient).toHaveBeenCalledWith(
        expect.objectContaining({ account: 'my-account' }),
        expect.any(Function),
      )
    })

    it('prints the server rejection and exits 1 when success is false', async () => {
      mockKickMember.mockImplementationOnce(() =>
        Promise.resolve({ success: false, status_code: -805, chat_id: '300', user_id: '42' }),
      )
      const exitSpy = stubExit()

      await parseExpectingExit(['kick', '300', '42', '--force'])

      expect(exitSpy).toHaveBeenCalledWith(1)
      expect(exitSpy).toHaveBeenCalledTimes(1)
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output.success).toBe(false)
      expect(output.status_code).toBe(-805)
    })

    it('reports a thrown client error on stderr and exits 1', async () => {
      mockKickMember.mockImplementationOnce(() => Promise.reject(new Error('KICKMEM failed: connection closed')))
      const exitSpy = stubExit()
      const originalStderrWrite = process.stderr.write
      const stderrSpy = mock((_chunk: unknown) => true)
      process.stderr.write = stderrSpy as unknown as typeof process.stderr.write

      try {
        await parseExpectingExit(['kick', '300', '42', '--force'])
      } finally {
        process.stderr.write = originalStderrWrite
      }

      expect(exitSpy).toHaveBeenCalledWith(1)
      expect(exitSpy).toHaveBeenCalledTimes(1)
      expect(consoleLogSpy).not.toHaveBeenCalled()
      expect(String(stderrSpy.mock.calls[0][0])).toContain('KICKMEM failed: connection closed')
    })
  })

  describe('kick-list', () => {
    it('lists kicked members of an open chat', async () => {
      await memberCommand.parseAsync(['kick-list', '300'], { from: 'user' })

      expect(mockGetKickList).toHaveBeenCalledWith('300')
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output.members).toHaveLength(1)
      expect(output.members[0].user_id).toBe('42')
    })

    it('exits 1 when the server rejects the request', async () => {
      mockGetKickList.mockImplementationOnce(() =>
        Promise.resolve({ success: false, status_code: -805, chat_id: '300', members: [] }),
      )
      const exitSpy = stubExit()

      await parseExpectingExit(['kick-list', '300'])

      expect(exitSpy).toHaveBeenCalledWith(1)
      expect(exitSpy).toHaveBeenCalledTimes(1)
    })
  })

  describe('unkick', () => {
    it('removes the member from the kick list without requiring --force', async () => {
      await memberCommand.parseAsync(['unkick', '300', '42'], { from: 'user' })

      expect(mockUnkickMember).toHaveBeenCalledWith('300', '42')
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output).toEqual({ success: true, status_code: 0, chat_id: '300', user_id: '42' })
    })

    it('exits 1 when the server rejects the request', async () => {
      mockUnkickMember.mockImplementationOnce(() =>
        Promise.resolve({ success: false, status_code: -805, chat_id: '300', user_id: '42' }),
      )
      const exitSpy = stubExit()

      await parseExpectingExit(['unkick', '300', '42'])

      expect(exitSpy).toHaveBeenCalledWith(1)
      expect(exitSpy).toHaveBeenCalledTimes(1)
    })
  })
})
