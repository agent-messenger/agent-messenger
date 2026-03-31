import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { WebexClient } from '../client'
import { WebexError } from '../types'
import { snapshotAction } from './snapshot'

describe('snapshot command', () => {
  let consoleSpy: ReturnType<typeof spyOn>
  let consoleErrorSpy: ReturnType<typeof spyOn>

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
    spyOn(WebexClient.prototype, 'login').mockResolvedValue(new WebexClient() as any)
    spyOn(WebexClient.prototype, 'listSpaces').mockResolvedValue(mockSpaces as any)
    spyOn(WebexClient.prototype, 'listMessages').mockResolvedValue(mockMessages as any)
    spyOn(WebexClient.prototype, 'listMemberships').mockResolvedValue(mockMembers as any)
  })

  afterEach(() => { mock.restore() })

  test('full snapshot includes spaces, recent_messages, members', async () => {
    await snapshotAction({})

    expect(consoleSpy).toHaveBeenCalled()
    const output = JSON.parse(consoleSpy.mock.calls[0][0])
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
    const output = JSON.parse(consoleSpy.mock.calls[0][0])
    expect(output.spaces).toBeDefined()
    expect(output.recent_messages).toBeUndefined()
    expect(output.members).toBeUndefined()
  })

  test('--members-only includes only members (no spaces, no messages)', async () => {
    await snapshotAction({ membersOnly: true })

    expect(consoleSpy).toHaveBeenCalled()
    const output = JSON.parse(consoleSpy.mock.calls[0][0])
    expect(output.spaces).toBeUndefined()
    expect(output.recent_messages).toBeUndefined()
    expect(output.members).toBeDefined()
    expect(output.members[0].personEmail).toBe('alice@example.com')
  })

  test('not authenticated outputs error', async () => {
    spyOn(WebexClient.prototype, 'login').mockRejectedValue(
      new WebexError('No Webex credentials found.', 'no_credentials'),
    )

    const originalExit = process.exit
    process.exit = mock((_code?: number) => { throw new Error('process.exit called') }) as never

    try {
      await snapshotAction({})
    } catch {
    } finally {
      process.exit = originalExit
    }

    expect(consoleErrorSpy).toHaveBeenCalled()
    const output = consoleErrorSpy.mock.calls[0][0]
    expect(output).toContain('No Webex credentials found')
  })

  test('passes limit option to listMessages', async () => {
    const listMessagesSpy = spyOn(WebexClient.prototype, 'listMessages').mockResolvedValue(mockMessages as any)

    await snapshotAction({ limit: 5 })

    expect(listMessagesSpy).toHaveBeenCalledWith('space-1', { max: 5 })
  })
})
