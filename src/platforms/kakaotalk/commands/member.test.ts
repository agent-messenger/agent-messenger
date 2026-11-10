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

const mockGetMemberSnapshot = mock((_chatId: string, _options?: unknown) =>
  Promise.resolve({
    chat_id: '9876543210',
    active_members: 2,
    members: [{ user_id: '42', nickname: 'Alice' }],
    complete: false,
    consistency_basis: 'stable_double_read_chatinfo_getmem',
    incomplete_reason: 'member_count_mismatch',
  } as Record<string, unknown>),
)

const mockClient = {
  getMembers: mockGetMembers,
  getMemberSnapshot: mockGetMemberSnapshot,
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
    mockGetMemberSnapshot.mockClear()
    // Commander keeps parsed option values on the command between parseAsync calls.
    const listCommand = memberCommand.commands.find((command) => command.name() === 'list')
    listCommand?.setOptionValue('allowPartial', undefined)
    listCommand?.setOptionValue('allowRoomEntry', undefined)
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

    it('does not request a partial or room-entry snapshot by default', async () => {
      await memberCommand.parseAsync(['list', '9876543210'], { from: 'user' })

      expect(mockGetMembers).toHaveBeenCalledTimes(1)
      expect(mockGetMemberSnapshot).not.toHaveBeenCalled()
    })

    it('prints the snapshot object with complete and incomplete_reason for --allow-partial', async () => {
      await memberCommand.parseAsync(['list', '9876543210', '--allow-partial'], { from: 'user' })

      expect(mockGetMemberSnapshot).toHaveBeenCalledWith('9876543210', { allowPartial: true, allowRoomEntry: false })
      expect(mockGetMembers).not.toHaveBeenCalled()
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output).toMatchObject({
        chat_id: '9876543210',
        active_members: 2,
        complete: false,
        incomplete_reason: 'member_count_mismatch',
      })
      expect(output.members).toHaveLength(1)
    })

    it('passes --allow-room-entry and keeps the member array output', async () => {
      mockGetMemberSnapshot.mockImplementationOnce(() =>
        Promise.resolve({
          chat_id: '9876543210',
          active_members: 1,
          members: [{ user_id: '42', nickname: 'Alice' }],
          complete: true,
          consistency_basis: 'chatonroom_ids_member_batch',
        }),
      )

      await memberCommand.parseAsync(['list', '9876543210', '--allow-room-entry'], { from: 'user' })

      expect(mockGetMemberSnapshot).toHaveBeenCalledWith('9876543210', { allowRoomEntry: true })
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output).toEqual([{ user_id: '42', nickname: 'Alice' }])
    })

    it('combines --allow-partial and --allow-room-entry', async () => {
      await memberCommand.parseAsync(['list', '9876543210', '--allow-partial', '--allow-room-entry'], { from: 'user' })

      expect(mockGetMemberSnapshot).toHaveBeenCalledWith('9876543210', { allowPartial: true, allowRoomEntry: true })
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
      expect(output.complete).toBe(false)
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
