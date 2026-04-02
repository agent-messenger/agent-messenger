import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { WebexError } from '../types'

const mockHandleError = mock((err: Error) => {
  throw err
})

mock.module('@/shared/utils/error-handler', () => ({
  handleError: mockHandleError,
}))

const mockSpaces = [
  { id: 'space-1', title: 'General', type: 'group', isLocked: false, lastActivity: '2024-01-15T00:00:00.000Z', created: '2024-01-01T00:00:00.000Z', creatorId: 'person-1' },
]

const mockMessages = [
  { id: 'msg-1', roomId: 'space-1', roomType: 'group', text: 'Hello', personId: 'person-1', personEmail: 'alice@example.com', created: '2024-01-15T00:00:00.000Z' },
]

const mockMembers = [
  { id: 'mem-1', roomId: 'space-1', personId: 'person-1', personEmail: 'alice@example.com', personDisplayName: 'Alice', isModerator: true, created: '2024-01-01T00:00:00.000Z' },
]

const mockListSpaces = mock(() => Promise.resolve(mockSpaces as any))
const mockListMessages = mock(() => Promise.resolve(mockMessages as any))
const mockListMemberships = mock(() => Promise.resolve(mockMembers as any))

const mockClient = {
  listSpaces: mockListSpaces,
  listMessages: mockListMessages,
  listMemberships: mockListMemberships,
}

const mockLogin = mock(() => Promise.resolve(mockClient))

mock.module('../client', () => ({
  WebexClient: class {
    login = mockLogin
  },
}))

import { snapshotAction } from './snapshot'

describe('snapshot command', () => {
  let consoleSpy: ReturnType<typeof spyOn>

  beforeEach(() => {
    mockListSpaces.mockReset().mockImplementation(() => Promise.resolve(mockSpaces as any))
    mockListMessages.mockReset().mockImplementation(() => Promise.resolve(mockMessages as any))
    mockListMemberships.mockReset().mockImplementation(() => Promise.resolve(mockMembers as any))
    mockLogin.mockReset().mockImplementation(() => Promise.resolve(mockClient))
    mockHandleError.mockReset().mockImplementation((err: Error) => {
      throw err
    })

    consoleSpy = spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  test('full snapshot includes spaces, recent_messages, members', async () => {
    await snapshotAction({})

    expect(consoleSpy).toHaveBeenCalled()
    const output = JSON.parse(consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1][0])
    expect(output.spaces).toBeDefined()
    expect(output.spaces[0].id).toBe('space-1')
    expect(output.spaces[0].title).toBe('General')
    expect(output.recent_messages).toBeDefined()
    expect(output.recent_messages[0].id).toBe('msg-1')
    expect(output.recent_messages[0].author).toBe('alice@example.com')
    expect(output.members).toBeDefined()
    expect(output.members[0].personEmail).toBe('alice@example.com')
  })

  test('--spaces-only includes only spaces (no messages, no members)', async () => {
    await snapshotAction({ spacesOnly: true })

    expect(consoleSpy).toHaveBeenCalled()
    const output = JSON.parse(consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1][0])
    expect(output.spaces).toBeDefined()
    expect(output.recent_messages).toBeUndefined()
    expect(output.members).toBeUndefined()
  })

  test('--members-only includes only members (no spaces, no messages)', async () => {
    await snapshotAction({ membersOnly: true })

    expect(consoleSpy).toHaveBeenCalled()
    const output = JSON.parse(consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1][0])
    expect(output.spaces).toBeUndefined()
    expect(output.recent_messages).toBeUndefined()
    expect(output.members).toBeDefined()
    expect(output.members[0].personEmail).toBe('alice@example.com')
  })

  test('not authenticated outputs error', async () => {
    mockLogin.mockImplementation(async () => {
      throw new WebexError('No Webex credentials found.', 'no_credentials')
    })

    await expect(snapshotAction({})).rejects.toThrow('No Webex credentials found.')

    expect(mockHandleError).toHaveBeenCalledWith(expect.any(WebexError))
  })

  test('passes limit option to listMessages', async () => {
    await snapshotAction({ limit: 5 })

    expect(mockListMessages).toHaveBeenCalledWith('space-1', { max: 5 })
  })
})
