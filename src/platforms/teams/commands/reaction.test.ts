import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'

import { TeamsClient } from '../client'
import { TeamsCredentialManager } from '../credential-manager'
import { addAction, removeAction } from './reaction'

let clientAddReactionSpy: ReturnType<typeof spyOn>
let clientRemoveReactionSpy: ReturnType<typeof spyOn>
let credManagerLoadConfigSpy: ReturnType<typeof spyOn>

beforeEach(() => {
  clientAddReactionSpy = spyOn(TeamsClient.prototype, 'addReaction').mockResolvedValue(undefined)
  clientRemoveReactionSpy = spyOn(TeamsClient.prototype, 'removeReaction').mockResolvedValue(undefined)
  credManagerLoadConfigSpy = spyOn(TeamsCredentialManager.prototype, 'loadConfig').mockResolvedValue({
    current_account: 'work',
    accounts: {
      work: {
        token: 'test-token',
        account_type: 'work' as const,
        current_team: null,
        teams: {},
      },
    },
  })
})

afterEach(() => {
  clientAddReactionSpy?.mockRestore()
  clientRemoveReactionSpy?.mockRestore()
  credManagerLoadConfigSpy?.mockRestore()
})

test('add: sends correct POST request with emoji', async () => {
  const consoleSpy = mock((_msg: string) => {})
  const originalLog = console.log
  console.log = consoleSpy

  try {
    await addAction('team123', 'ch123', 'msg123', 'like', { pretty: false })
    expect(consoleSpy).toHaveBeenCalled()
    const output = JSON.parse(consoleSpy.mock.calls[0][0])
    expect(output.success).toBe(true)
    expect(output.team_id).toBe('team123')
    expect(output.channel_id).toBe('ch123')
    expect(output.message_id).toBe('msg123')
    expect(output.emoji).toBe('like')
  } finally {
    console.log = originalLog
  }
})

test('remove: sends correct DELETE request with emoji', async () => {
  const consoleSpy = mock((_msg: string) => {})
  const originalLog = console.log
  console.log = consoleSpy

  try {
    await removeAction('team123', 'ch123', 'msg123', 'like', { pretty: false })
    expect(consoleSpy).toHaveBeenCalled()
    const output = JSON.parse(consoleSpy.mock.calls[0][0])
    expect(output.success).toBe(true)
    expect(output.team_id).toBe('team123')
    expect(output.channel_id).toBe('ch123')
    expect(output.message_id).toBe('msg123')
    expect(output.emoji).toBe('like')
  } finally {
    console.log = originalLog
  }
})

test('add: handles missing token gracefully', async () => {
  credManagerLoadConfigSpy?.mockResolvedValue(null)

  const consoleSpy = mock((_msg: string) => {})
  const originalLog = console.log
  const originalExit = process.exit
  process.exit = mock(() => {}) as any
  console.log = consoleSpy

  try {
    await addAction('team123', 'ch123', 'msg123', 'like', { pretty: false })
    expect(consoleSpy).toHaveBeenCalled()
    const output = JSON.parse(consoleSpy.mock.calls[0][0])
    expect(output.error).toBeDefined()
  } finally {
    console.log = originalLog
    process.exit = originalExit
  }
})
