import { afterEach, beforeEach, expect, spyOn, test } from 'bun:test'

import { TeamsClient } from '../client'
import { TeamsCredentialManager } from '../credential-manager'
import { addAction, removeAction } from './reaction'

let clientAddReactionSpy: ReturnType<typeof spyOn>
let clientRemoveReactionSpy: ReturnType<typeof spyOn>
let credManagerLoadConfigSpy: ReturnType<typeof spyOn>
let consoleLogSpy: ReturnType<typeof spyOn>
let processExitSpy: ReturnType<typeof spyOn>

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
  consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {})
  processExitSpy = spyOn(process, 'exit').mockImplementation((_code?: number) => {
    throw new Error(`process.exit(${_code})`)
  })
})

afterEach(() => {
  clientAddReactionSpy.mockRestore()
  clientRemoveReactionSpy.mockRestore()
  credManagerLoadConfigSpy.mockRestore()
  consoleLogSpy.mockRestore()
  processExitSpy.mockRestore()
})

test('add: sends correct POST request with emoji', async () => {
  try {
    await addAction('team123', 'ch123', 'msg123', 'like', { pretty: false })
  } catch {}

  expect(consoleLogSpy).toHaveBeenCalled()
  const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
  expect(output.success).toBe(true)
  expect(output.team_id).toBe('team123')
  expect(output.channel_id).toBe('ch123')
  expect(output.message_id).toBe('msg123')
  expect(output.emoji).toBe('like')
})

test('remove: sends correct DELETE request with emoji', async () => {
  try {
    await removeAction('team123', 'ch123', 'msg123', 'like', { pretty: false })
  } catch {}

  expect(consoleLogSpy).toHaveBeenCalled()
  const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
  expect(output.success).toBe(true)
  expect(output.team_id).toBe('team123')
  expect(output.channel_id).toBe('ch123')
  expect(output.message_id).toBe('msg123')
  expect(output.emoji).toBe('like')
})

test('add: handles missing token gracefully', async () => {
  credManagerLoadConfigSpy.mockResolvedValue(null)

  try {
    await addAction('team123', 'ch123', 'msg123', 'like', { pretty: false })
  } catch {}

  expect(consoleLogSpy).toHaveBeenCalled()
  const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
  expect(output.error).toBeDefined()
  expect(processExitSpy).toHaveBeenCalledWith(1)
})
