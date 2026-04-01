import { afterAll, afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'

import { WebexError } from '../types'

const mockMembers = [
  {
    id: 'mem-1',
    roomId: 'room-1',
    personId: 'person-1',
    personEmail: 'alice@example.com',
    personDisplayName: 'Alice',
    isModerator: true,
    created: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'mem-2',
    roomId: 'room-1',
    personId: 'person-2',
    personEmail: 'bob@example.com',
    personDisplayName: 'Bob',
    isModerator: false,
    created: '2024-01-02T00:00:00.000Z',
  },
]

const mockListMemberships = mock(() => Promise.resolve(mockMembers))
const mockLogin = mock(() => Promise.resolve({ listMemberships: mockListMemberships }))

mock.module('../client', () => ({
  WebexClient: class {
    login = mockLogin
  },
}))

import { listAction } from './member'

afterAll(() => {
  mock.restore()
})

describe('member commands', () => {
  let consoleSpy: ReturnType<typeof spyOn>
  let processExitSpy: ReturnType<typeof spyOn>
  let stderrOutput: string
  let origStderrWrite: typeof process.stderr.write

  beforeEach(() => {
    mockListMemberships.mockReset().mockImplementation(() => Promise.resolve(mockMembers))
    mockLogin.mockReset().mockImplementation(() =>
      Promise.resolve({ listMemberships: mockListMemberships }),
    )

    consoleSpy = spyOn(console, 'log').mockImplementation(() => {})
    processExitSpy = spyOn(process, 'exit').mockImplementation((_code?: number) => {
      throw new Error(`process.exit(${_code})`)
    })
    stderrOutput = ''
    origStderrWrite = process.stderr.write
    process.stderr.write = ((chunk: string | Uint8Array) => {
      stderrOutput += typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk)
      return true
    }) as typeof process.stderr.write
  })

  afterEach(() => {
    process.stderr.write = origStderrWrite
    consoleSpy.mockRestore()
    processExitSpy.mockRestore()
  })

  test('listAction calls listMemberships with spaceId and outputs mapped members', async () => {
    await listAction('room-1', {})

    expect(mockListMemberships).toHaveBeenCalledWith('room-1', { max: undefined })
    expect(consoleSpy).toHaveBeenCalledWith(
      JSON.stringify([
        {
          id: 'mem-1',
          personId: 'person-1',
          personEmail: 'alice@example.com',
          personDisplayName: 'Alice',
          isModerator: true,
          created: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'mem-2',
          personId: 'person-2',
          personEmail: 'bob@example.com',
          personDisplayName: 'Bob',
          isModerator: false,
          created: '2024-01-02T00:00:00.000Z',
        },
      ]),
    )
  })

  test('listAction passes limit option to listMemberships', async () => {
    await listAction('room-1', { limit: 25 })

    expect(mockListMemberships).toHaveBeenCalledWith('room-1', { max: 25 })
  })

  test('listAction handles not-authenticated case', async () => {
    mockLogin.mockImplementation(async () => {
      throw new WebexError('No Webex credentials found.', 'no_credentials')
    })

    try {
      await listAction('room-1', {})
    } catch {}

    expect(processExitSpy).toHaveBeenCalledWith(1)
    expect(stderrOutput).toContain('No Webex credentials found')
  })

  test('listAction handles API error', async () => {
    mockListMemberships.mockImplementation(async () => {
      throw new Error('API failure')
    })

    try {
      await listAction('room-1', {})
    } catch {}

    expect(processExitSpy).toHaveBeenCalledWith(1)
  })
})
