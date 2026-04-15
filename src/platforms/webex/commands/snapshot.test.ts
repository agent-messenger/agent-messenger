import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'

import { WebexError } from '../types'

const mockHandleError = mock((err: Error) => {
  throw err
})

mock.module('@/shared/utils/error-handler', () => ({
  handleError: mockHandleError,
}))

const mockSpaces = [
  {
    id: 'space-1',
    title: 'General',
    type: 'group',
    isLocked: false,
    lastActivity: '2024-01-15T00:00:00.000Z',
    created: '2024-01-01T00:00:00.000Z',
    creatorId: 'person-1',
  },
  {
    id: 'space-2',
    title: 'Random',
    type: 'group',
    isLocked: false,
    lastActivity: '2024-01-14T00:00:00.000Z',
    created: '2024-01-01T00:00:00.000Z',
    creatorId: 'person-1',
  },
]

const mockMyMemberships = [
  {
    id: 'mem-1',
    roomId: 'space-1',
    personId: 'person-1',
    personEmail: 'alice@example.com',
    personDisplayName: 'Alice',
    isModerator: true,
    created: '2024-01-01T00:00:00.000Z',
  },
]

const mockListSpaces = mock(() => Promise.resolve(mockSpaces as any))
const mockListMyMemberships = mock(() => Promise.resolve(mockMyMemberships as any))

const mockClient = {
  listSpaces: mockListSpaces,
  listMyMemberships: mockListMyMemberships,
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
    mockListMyMemberships.mockReset().mockImplementation(() => Promise.resolve(mockMyMemberships as any))
    mockLogin.mockReset().mockImplementation(() => Promise.resolve(mockClient))
    mockHandleError.mockReset().mockImplementation((err: Error) => {
      throw err
    })

    consoleSpy = spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  test('brief snapshot returns spaces with id and title only', async () => {
    await snapshotAction({})

    expect(consoleSpy).toHaveBeenCalled()
    const output = JSON.parse(consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1][0])
    expect(output.spaces).toHaveLength(1)
    expect(output.spaces[0].id).toBe('space-1')
    expect(output.spaces[0].title).toBe('General')
    expect(output.spaces[0].type).toBeUndefined()
    expect(output.hint).toBeDefined()
  })

  test('full snapshot returns spaces with id, title, type, lastActivity', async () => {
    await snapshotAction({ full: true })

    expect(consoleSpy).toHaveBeenCalled()
    const output = JSON.parse(consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1][0])
    expect(output.spaces).toHaveLength(1)
    expect(output.spaces[0].id).toBe('space-1')
    expect(output.spaces[0].title).toBe('General')
    expect(output.spaces[0].type).toBe('group')
    expect(output.spaces[0].lastActivity).toBe('2024-01-15T00:00:00.000Z')
    expect(output.hint).toBeUndefined()
  })

  test('filters spaces to only those in my memberships', async () => {
    await snapshotAction({})

    const output = JSON.parse(consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1][0])
    expect(output.spaces).toHaveLength(1)
    expect(output.spaces[0].id).toBe('space-1')
  })

  test('not authenticated outputs error', async () => {
    mockLogin.mockImplementation(async () => {
      throw new WebexError('No Webex credentials found.', 'no_credentials')
    })

    await expect(snapshotAction({})).rejects.toThrow('No Webex credentials found.')

    expect(mockHandleError).toHaveBeenCalledWith(expect.any(WebexError))
  })
})
