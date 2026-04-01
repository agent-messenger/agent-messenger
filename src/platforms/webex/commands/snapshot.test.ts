import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { WebexClient } from '../client'
import { WebexError } from '../types'
import { snapshotAction } from './snapshot'

describe('snapshot command', () => {
  let consoleSpy: ReturnType<typeof spyOn>
  let consoleErrorSpy: ReturnType<typeof spyOn>
  let processExitSpy: ReturnType<typeof spyOn>
  let clientLoginSpy: ReturnType<typeof spyOn>
  let clientListSpacesSpy: ReturnType<typeof spyOn>
  let clientListMessagesSpy: ReturnType<typeof spyOn>
  let clientListMembershipsSpy: ReturnType<typeof spyOn>
  let stderrOutput: string
  let origStderrWrite: typeof process.stderr.write

  const mockSpaces = [
    { id: 'space-1', title: 'General', type: 'group', isLocked: false, lastActivity: '2024-01-15T00:00:00.000Z', created: '2024-01-01T00:00:00.000Z', creatorId: 'person-1' },
  ]

  const mockMessages = [
    { id: 'msg-1', roomId: 'space-1', roomType: 'group', text: 'Hello', personId: 'person-1', personEmail: 'alice@example.com', created: '2024-01-15T00:00:00.000Z' },
  ]

  const mockMembers = [
    { id: 'mem-1', roomId: 'space-1', personId: 'person-1', personEmail: 'alice@example.com', personDisplayName: 'Alice', isModerator: true, created: '2024-01-01T00:00:00.000Z' },
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
    clientLoginSpy = spyOn(WebexClient.prototype, 'login').mockResolvedValue(new WebexClient() as any)
    clientListSpacesSpy = spyOn(WebexClient.prototype, 'listSpaces').mockResolvedValue(mockSpaces as any)
    clientListMessagesSpy = spyOn(WebexClient.prototype, 'listMessages').mockResolvedValue(mockMessages as any)
    clientListMembershipsSpy = spyOn(WebexClient.prototype, 'listMemberships').mockResolvedValue(mockMembers as any)
  })

  afterEach(() => {
    process.stderr.write = origStderrWrite
    consoleSpy.mockRestore()
    consoleErrorSpy.mockRestore()
    processExitSpy.mockRestore()
    clientLoginSpy.mockRestore()
    clientListSpacesSpy.mockRestore()
    clientListMessagesSpy.mockRestore()
    clientListMembershipsSpy.mockRestore()
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
    clientLoginSpy.mockImplementation(async () => {
      throw new WebexError('No Webex credentials found.', 'no_credentials')
    })

    try {
      await snapshotAction({})
    } catch {}

    expect(processExitSpy).toHaveBeenCalledWith(1)
    expect(stderrOutput).toContain('No Webex credentials found')
  })

  test('passes limit option to listMessages', async () => {
    const listMessagesSpy = spyOn(WebexClient.prototype, 'listMessages').mockResolvedValue(mockMessages as any)

    await snapshotAction({ limit: 5 })

    expect(listMessagesSpy).toHaveBeenCalledWith('space-1', { max: 5 })

    listMessagesSpy.mockRestore()
  })
})
