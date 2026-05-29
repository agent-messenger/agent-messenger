import { afterEach, beforeEach, describe, expect, spyOn, it } from 'bun:test'

import { WebexClient } from '../client'
import { WebexError } from '../types'

const mockSpaces = [
  {
    id: 'space-1',
    title: 'General',
    type: 'group' as const,
    isLocked: false,
    lastActivity: '2024-01-02T00:00:00.000Z',
    created: '2024-01-01T00:00:00.000Z',
    creatorId: 'person-1',
  },
  {
    id: 'space-2',
    title: 'Direct with Alice',
    type: 'direct' as const,
    isLocked: false,
    lastActivity: '2024-01-03T00:00:00.000Z',
    created: '2024-01-01T00:00:00.000Z',
    creatorId: 'person-2',
  },
]

const mockSpace = {
  id: 'space-1',
  title: 'General',
  type: 'group' as const,
  isLocked: false,
  teamId: 'team-abc',
  lastActivity: '2024-01-02T00:00:00.000Z',
  created: '2024-01-01T00:00:00.000Z',
  creatorId: 'person-1',
}

import { infoAction, listAction } from './space'

let mockListSpaces: ReturnType<typeof spyOn>
let mockGetSpace: ReturnType<typeof spyOn>
let mockLogin: ReturnType<typeof spyOn>
let consoleLogSpy: ReturnType<typeof spyOn>
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
  mockListSpaces = protoSpy('listSpaces').mockResolvedValue(mockSpaces)
  mockGetSpace = protoSpy('getSpace').mockResolvedValue(mockSpace)

  consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {})
  consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {})
  processExitSpy = spyOn(process, 'exit').mockImplementation((_code?: number) => undefined as never)
})

afterEach(() => {
  consoleLogSpy.mockRestore()
  consoleErrorSpy.mockRestore()
  processExitSpy.mockRestore()
  for (const s of protoSpies) s.mockRestore()
  protoSpies.length = 0
})

describe('listAction', () => {
  it('calls listSpaces and outputs mapped array', async () => {
    await listAction({})

    expect(mockListSpaces).toHaveBeenCalled()
    expect(consoleLogSpy).toHaveBeenCalledWith(
      JSON.stringify([
        {
          id: 'space-1',
          title: 'General',
          type: 'group',
          lastActivity: '2024-01-02T00:00:00.000Z',
          created: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'space-2',
          title: 'Direct with Alice',
          type: 'direct',
          lastActivity: '2024-01-03T00:00:00.000Z',
          created: '2024-01-01T00:00:00.000Z',
        },
      ]),
    )
  })

  it('passes type and limit options to listSpaces', async () => {
    await listAction({ type: 'group', limit: 10 })

    expect(mockListSpaces).toHaveBeenCalledWith({ type: 'group', max: 10 })
  })

  it('passes undefined type and limit when not provided', async () => {
    await listAction({})

    expect(mockListSpaces).toHaveBeenCalledWith({ type: undefined, max: undefined })
  })

  it('outputs pretty-printed JSON when pretty is true', async () => {
    await listAction({ pretty: true })

    expect(consoleLogSpy).toHaveBeenCalledWith(
      JSON.stringify(
        [
          {
            id: 'space-1',
            title: 'General',
            type: 'group',
            lastActivity: '2024-01-02T00:00:00.000Z',
            created: '2024-01-01T00:00:00.000Z',
          },
          {
            id: 'space-2',
            title: 'Direct with Alice',
            type: 'direct',
            lastActivity: '2024-01-03T00:00:00.000Z',
            created: '2024-01-01T00:00:00.000Z',
          },
        ],
        null,
        2,
      ),
    )
  })

  it('exits with code 1 when not authenticated', async () => {
    mockLogin.mockRejectedValue(new WebexError('No Webex credentials found.', 'no_credentials'))

    await listAction({})

    expect(mockListSpaces).not.toHaveBeenCalled()
    expect(processExitSpy).toHaveBeenCalledWith(1)
  })
})

describe('infoAction', () => {
  it('calls getSpace with spaceId and outputs space details', async () => {
    await infoAction('space-1', {})

    expect(mockGetSpace).toHaveBeenCalledWith('space-1')
    expect(consoleLogSpy).toHaveBeenCalledWith(
      JSON.stringify({
        id: 'space-1',
        title: 'General',
        type: 'group',
        isLocked: false,
        teamId: 'team-abc',
        lastActivity: '2024-01-02T00:00:00.000Z',
        created: '2024-01-01T00:00:00.000Z',
        creatorId: 'person-1',
      }),
    )
  })

  it('outputs null for teamId when not present', async () => {
    mockGetSpace.mockImplementation(() => Promise.resolve({ ...mockSpace, teamId: undefined }))

    await infoAction('space-1', {})

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string) as {
      teamId: null
    }
    expect(output.teamId).toBeNull()
  })

  it('outputs pretty-printed JSON when pretty is true', async () => {
    await infoAction('space-1', { pretty: true })

    expect(consoleLogSpy).toHaveBeenCalledWith(
      JSON.stringify(
        {
          id: 'space-1',
          title: 'General',
          type: 'group',
          isLocked: false,
          teamId: 'team-abc',
          lastActivity: '2024-01-02T00:00:00.000Z',
          created: '2024-01-01T00:00:00.000Z',
          creatorId: 'person-1',
        },
        null,
        2,
      ),
    )
  })

  it('exits with code 1 when not authenticated', async () => {
    mockLogin.mockRejectedValue(new WebexError('No Webex credentials found.', 'no_credentials'))

    await infoAction('space-1', {})

    expect(mockGetSpace).not.toHaveBeenCalled()
    expect(processExitSpy).toHaveBeenCalledWith(1)
  })
})
