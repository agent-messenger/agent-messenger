import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'

import { WebexClient } from '../client'
import { WebexError } from '../types'
import { listAction } from './member'

describe('member commands', () => {
  let consoleSpy: ReturnType<typeof spyOn>
  let consoleErrorSpy: ReturnType<typeof spyOn>
  let processExitSpy: ReturnType<typeof spyOn>
  let stderrOutput: string
  let origStderrWrite: typeof process.stderr.write
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

  beforeEach(() => {
    consoleSpy = spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {})
    processExitSpy = spyOn(process, 'exit').mockImplementation((_code?: number) => {
      throw new Error(`process.exit(${_code})`)
    })
    stderrOutput = ''
    origStderrWrite = process.stderr.write
    process.stderr.write = ((chunk: string | Uint8Array) => {
      stderrOutput += typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk)
      return true
    }) as typeof process.stderr.write
    spyOn(WebexClient.prototype, 'login').mockResolvedValue(new WebexClient() as any)
    spyOn(WebexClient.prototype, 'listMemberships').mockResolvedValue(mockMembers)
  })

  afterEach(() => {
    process.stderr.write = origStderrWrite
    mock.restore()
  })

  test('listAction calls listMemberships with spaceId and outputs mapped members', async () => {
    const listMembershipsSpy = spyOn(WebexClient.prototype, 'listMemberships').mockResolvedValue(
      mockMembers,
    )

    await listAction('room-1', {})

    expect(listMembershipsSpy).toHaveBeenCalledWith('room-1', { max: undefined })
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
    const listMembershipsSpy = spyOn(WebexClient.prototype, 'listMemberships').mockResolvedValue(
      mockMembers,
    )

    await listAction('room-1', { limit: 25 })

    expect(listMembershipsSpy).toHaveBeenCalledWith('room-1', { max: 25 })
  })

  test('listAction handles not-authenticated case', async () => {
    spyOn(WebexClient.prototype, 'login').mockRejectedValue(
      new WebexError('No Webex credentials found.', 'no_credentials'),
    )

    await expect(listAction('room-1', {})).rejects.toThrow('process.exit(1)')

    expect(stderrOutput).toContain('No Webex credentials found')
  })

  test('listAction handles API error', async () => {
    spyOn(WebexClient.prototype, 'listMemberships').mockRejectedValue(new Error('API failure'))

    await expect(listAction('room-1', {})).rejects.toThrow('process.exit(1)')

    expect(processExitSpy).toHaveBeenCalledWith(1)
  })
})
