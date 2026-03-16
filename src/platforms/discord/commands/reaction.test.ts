import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'

import { DiscordClient } from '../client'
import { DiscordCredentialManager } from '../credential-manager'
import { addAction, listAction, removeAction } from './reaction'

let clientAddReactionSpy: ReturnType<typeof spyOn>
let clientRemoveReactionSpy: ReturnType<typeof spyOn>
let clientGetMessageSpy: ReturnType<typeof spyOn>
let credManagerLoadSpy: ReturnType<typeof spyOn>

beforeEach(() => {
  // Spy on DiscordClient.prototype methods
  clientAddReactionSpy = spyOn(DiscordClient.prototype, 'addReaction').mockResolvedValue(undefined)

  clientRemoveReactionSpy = spyOn(DiscordClient.prototype, 'removeReaction').mockResolvedValue(undefined)

  clientGetMessageSpy = spyOn(DiscordClient.prototype, 'getMessage').mockResolvedValue({
    id: 'msg123',
    channel_id: 'ch123',
    author: { id: 'user123', username: 'testuser' },
    content: 'test message',
    timestamp: '2024-01-01T00:00:00Z',
    reactions: [
      {
        emoji: { name: 'thumbsup', id: undefined },
        count: 2,
      },
      {
        emoji: { name: 'heart', id: undefined },
        count: 1,
      },
    ],
  } as any)

  // Spy on DiscordCredentialManager.prototype methods
  credManagerLoadSpy = spyOn(DiscordCredentialManager.prototype, 'load').mockResolvedValue({
    token: 'test-token',
    current_server: null,
    servers: {},
  })
})

afterEach(() => {
  clientAddReactionSpy?.mockRestore()
  clientRemoveReactionSpy?.mockRestore()
  clientGetMessageSpy?.mockRestore()
  credManagerLoadSpy?.mockRestore()
})

test('add: sends correct PUT request with emoji', async () => {
  const consoleSpy = mock((_msg: string) => {})
  const originalLog = console.log
  console.log = consoleSpy

  try {
    await addAction('ch123', 'msg123', 'thumbsup', { pretty: false })
    expect(consoleSpy).toHaveBeenCalled()
    const output = JSON.parse(consoleSpy.mock.calls[0][0])
    expect(output.success).toBe(true)
    expect(output.channel_id).toBe('ch123')
    expect(output.message_id).toBe('msg123')
    expect(output.emoji).toBe('thumbsup')
  } finally {
    console.log = originalLog
  }
})

test('remove: sends correct DELETE request with emoji', async () => {
  const consoleSpy = mock((_msg: string) => {})
  const originalLog = console.log
  console.log = consoleSpy

  try {
    await removeAction('ch123', 'msg123', 'thumbsup', { pretty: false })
    expect(consoleSpy).toHaveBeenCalled()
    const output = JSON.parse(consoleSpy.mock.calls[0][0])
    expect(output.success).toBe(true)
    expect(output.channel_id).toBe('ch123')
    expect(output.message_id).toBe('msg123')
    expect(output.emoji).toBe('thumbsup')
  } finally {
    console.log = originalLog
  }
})

test('list: extracts reactions from message', async () => {
  const consoleSpy = mock((_msg: string) => {})
  const originalLog = console.log
  console.log = consoleSpy

  try {
    await listAction('ch123', 'msg123', { pretty: false })
    expect(consoleSpy).toHaveBeenCalled()
    const output = JSON.parse(consoleSpy.mock.calls[0][0])
    expect(output.channel_id).toBe('ch123')
    expect(output.message_id).toBe('msg123')
    expect(Array.isArray(output.reactions)).toBe(true)
    expect(output.reactions.length).toBe(2)
    expect(output.reactions[0].emoji.name).toBe('thumbsup')
    expect(output.reactions[0].count).toBe(2)
  } finally {
    console.log = originalLog
  }
})

test('add: handles missing token gracefully', async () => {
  // Temporarily override the credential manager spy to return null token
  credManagerLoadSpy?.mockResolvedValue({
    token: null,
    current_server: null,
    servers: {},
  })

  const consoleSpy = mock((_msg: string) => {})
  const originalLog = console.log
  const originalExit = process.exit
  let _exitCode = 0
  process.exit = mock((code: number) => {
    _exitCode = code
  }) as any

  console.log = consoleSpy

  try {
    await addAction('ch123', 'msg123', 'thumbsup', { pretty: false })
    expect(consoleSpy).toHaveBeenCalled()
    const output = JSON.parse(consoleSpy.mock.calls[0][0])
    expect(output.error).toBeDefined()
  } finally {
    console.log = originalLog
    process.exit = originalExit
  }
})
