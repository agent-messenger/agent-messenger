import { afterEach, beforeEach, describe, expect, spyOn, it } from 'bun:test'

import { WebexClient } from '../client'
import { WebexError } from '../types'

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

import { snapshotAction } from './snapshot'

describe('snapshot command', () => {
  let mockLogin: ReturnType<typeof spyOn>
  let consoleSpy: ReturnType<typeof spyOn>
  let consoleErrorSpy: ReturnType<typeof spyOn>
  let processExitSpy: ReturnType<typeof spyOn>
  const protoSpies: ReturnType<typeof spyOn>[] = []

  function protoSpy(method: keyof WebexClient) {
    const s = spyOn(WebexClient.prototype, method as never)
    protoSpies.push(s)
    return s
  }

  beforeEach(() => {
    mockLogin = protoSpy('login').mockImplementation(async function (this: WebexClient) {
      return this
    })
    protoSpy('listSpaces').mockResolvedValue(mockSpaces as any)
    protoSpy('listMyMemberships').mockResolvedValue(mockMyMemberships as any)

    consoleSpy = spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {})
    processExitSpy = spyOn(process, 'exit').mockImplementation((_code?: number) => undefined as never)
  })

  afterEach(() => {
    consoleSpy.mockRestore()
    consoleErrorSpy.mockRestore()
    processExitSpy.mockRestore()
    for (const s of protoSpies) s.mockRestore()
    protoSpies.length = 0
  })

  it('returns spaces with id and title only in brief mode', async () => {
    await snapshotAction({})

    expect(consoleSpy).toHaveBeenCalled()
    const output = JSON.parse(consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1][0])
    expect(output.spaces).toHaveLength(1)
    expect(output.spaces[0].id).toBe('space-1')
    expect(output.spaces[0].title).toBe('General')
    expect(output.spaces[0].type).toBeUndefined()
    expect(output.hint).toBeDefined()
  })

  it('returns spaces with id, title, type, and lastActivity in full mode', async () => {
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

  it('filters spaces to only those in my memberships', async () => {
    await snapshotAction({})

    const output = JSON.parse(consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1][0])
    expect(output.spaces).toHaveLength(1)
    expect(output.spaces[0].id).toBe('space-1')
  })

  it('exits with code 1 when not authenticated', async () => {
    mockLogin.mockRejectedValue(new WebexError('No Webex credentials found.', 'no_credentials'))

    await snapshotAction({})

    expect(processExitSpy).toHaveBeenCalledWith(1)
  })
})
