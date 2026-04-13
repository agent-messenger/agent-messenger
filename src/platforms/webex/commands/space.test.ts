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

const mockListSpaces = mock(() => Promise.resolve(mockSpaces))
const mockGetSpace = mock(() => Promise.resolve(mockSpace))
const mockLogin = mock(() => Promise.resolve({ listSpaces: mockListSpaces, getSpace: mockGetSpace }))

mock.module('../client', () => ({
  WebexClient: class {
    login = mockLogin
  },
}))

import { infoAction, listAction } from './space'

let consoleLogSpy: ReturnType<typeof spyOn>

beforeEach(() => {
  mockListSpaces.mockReset().mockImplementation(() => Promise.resolve(mockSpaces))
  mockGetSpace.mockReset().mockImplementation(() => Promise.resolve(mockSpace))
  mockLogin
    .mockReset()
    .mockImplementation(() => Promise.resolve({ listSpaces: mockListSpaces, getSpace: mockGetSpace }))
  mockHandleError.mockReset().mockImplementation((err: Error) => {
    throw err
  })

  consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  consoleLogSpy.mockRestore()
})

describe('listAction', () => {
  test('calls listSpaces and outputs mapped array', async () => {
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

  test('passes type and limit options to listSpaces', async () => {
    await listAction({ type: 'group', limit: 10 })

    expect(mockListSpaces).toHaveBeenCalledWith({ type: 'group', max: 10 })
  })

  test('passes undefined type and limit when not provided', async () => {
    await listAction({})

    expect(mockListSpaces).toHaveBeenCalledWith({ type: undefined, max: undefined })
  })

  test('outputs pretty-printed JSON when pretty is true', async () => {
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

  test('not authenticated: outputs error and exits', async () => {
    mockLogin.mockImplementation(async () => {
      throw new WebexError('No Webex credentials found.', 'no_credentials')
    })

    await expect(listAction({})).rejects.toThrow('No Webex credentials found.')

    expect(mockListSpaces).not.toHaveBeenCalled()
    expect(mockHandleError).toHaveBeenCalledWith(expect.any(WebexError))
  })
})

describe('infoAction', () => {
  test('calls getSpace with spaceId and outputs space details', async () => {
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

  test('outputs null for teamId when not present', async () => {
    mockGetSpace.mockImplementation(() => Promise.resolve({ ...mockSpace, teamId: undefined }))

    await infoAction('space-1', {})

    const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string) as {
      teamId: null
    }
    expect(output.teamId).toBeNull()
  })

  test('outputs pretty-printed JSON when pretty is true', async () => {
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

  test('not authenticated: outputs error and exits', async () => {
    mockLogin.mockImplementation(async () => {
      throw new WebexError('No Webex credentials found.', 'no_credentials')
    })

    await expect(infoAction('space-1', {})).rejects.toThrow('No Webex credentials found.')

    expect(mockGetSpace).not.toHaveBeenCalled()
    expect(mockHandleError).toHaveBeenCalledWith(expect.any(WebexError))
  })
})
