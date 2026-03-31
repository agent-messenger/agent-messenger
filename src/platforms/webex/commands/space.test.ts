import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'

import { WebexClient } from '../client'
import { WebexError } from '../types'
import { infoAction, listAction } from './space'

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

let clientLoginSpy: ReturnType<typeof spyOn>
let clientListSpacesSpy: ReturnType<typeof spyOn>
let clientGetSpaceSpy: ReturnType<typeof spyOn>
let consoleLogSpy: ReturnType<typeof spyOn>
let consoleErrorSpy: ReturnType<typeof spyOn>
let processExitSpy: ReturnType<typeof spyOn>

beforeEach(() => {
  clientLoginSpy = spyOn(WebexClient.prototype, 'login').mockResolvedValue(
    new WebexClient() as InstanceType<typeof WebexClient>,
  )

  clientListSpacesSpy = spyOn(WebexClient.prototype, 'listSpaces').mockResolvedValue(mockSpaces)

  clientGetSpaceSpy = spyOn(WebexClient.prototype, 'getSpace').mockResolvedValue(mockSpace)

  consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {})
  consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {})

  processExitSpy = spyOn(process, 'exit').mockImplementation((_code?: number) => {
    throw new Error(`process.exit(${_code})`)
  })
})

afterEach(() => {
  clientLoginSpy?.mockRestore()
  clientListSpacesSpy?.mockRestore()
  clientGetSpaceSpy?.mockRestore()
  consoleLogSpy?.mockRestore()
  consoleErrorSpy?.mockRestore()
  processExitSpy?.mockRestore()
})

describe('listAction', () => {
  test('calls listSpaces and outputs mapped array', async () => {
    await listAction({})

    expect(clientListSpacesSpy).toHaveBeenCalled()
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

    expect(clientListSpacesSpy).toHaveBeenCalledWith({ type: 'group', max: 10 })
  })

  test('passes undefined type and limit when not provided', async () => {
    await listAction({})

    expect(clientListSpacesSpy).toHaveBeenCalledWith({ type: undefined, max: undefined })
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
    clientLoginSpy.mockRejectedValue(new WebexError('No Webex credentials found.', 'no_credentials'))

    await expect(listAction({})).rejects.toThrow('process.exit(1)')

    expect(clientListSpacesSpy).not.toHaveBeenCalled()
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('No Webex credentials found'))
  })
})

describe('infoAction', () => {
  test('calls getSpace with spaceId and outputs space details', async () => {
    await infoAction('space-1', {})

    expect(clientGetSpaceSpy).toHaveBeenCalledWith('space-1')
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
    const spaceWithoutTeam = { ...mockSpace, teamId: undefined }
    clientGetSpaceSpy.mockResolvedValue(spaceWithoutTeam)

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
    clientLoginSpy.mockRejectedValue(new WebexError('No Webex credentials found.', 'no_credentials'))

    await expect(infoAction('space-1', {})).rejects.toThrow('process.exit(1)')

    expect(clientGetSpaceSpy).not.toHaveBeenCalled()
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('No Webex credentials found'))
  })
})
