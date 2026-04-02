import { afterEach, beforeEach, expect, spyOn, test } from 'bun:test'

import { TeamsClient } from '../client'
import { TeamsCredentialManager } from '../credential-manager'
import { addAction, removeAction } from './reaction'

let addReactionSpy: ReturnType<typeof spyOn>
let removeReactionSpy: ReturnType<typeof spyOn>
let getTokenWithExpirySpy: ReturnType<typeof spyOn>
let consoleLogSpy: ReturnType<typeof spyOn>
let processExitSpy: ReturnType<typeof spyOn>

beforeEach(() => {
  addReactionSpy = spyOn(TeamsClient.prototype, 'addReaction').mockResolvedValue(undefined)
  removeReactionSpy = spyOn(TeamsClient.prototype, 'removeReaction').mockResolvedValue(undefined)
  getTokenWithExpirySpy = spyOn(TeamsCredentialManager.prototype, 'getTokenWithExpiry').mockImplementation(() =>
    Promise.resolve({ token: 'test-token', tokenExpiresAt: undefined }),
  )

  consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {})
  processExitSpy = spyOn(process, 'exit').mockImplementation((_code?: number) => {
    throw new Error(`process.exit(${_code})`)
  })
})

afterEach(() => {
  addReactionSpy.mockRestore()
  removeReactionSpy.mockRestore()
  getTokenWithExpirySpy.mockRestore()
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
  getTokenWithExpirySpy.mockImplementation(() => Promise.resolve(null))

  try {
    await addAction('team123', 'ch123', 'msg123', 'like', { pretty: false })
  } catch {}

  expect(consoleLogSpy).toHaveBeenCalled()
  const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
  expect(output.error).toBeDefined()
  expect(processExitSpy).toHaveBeenCalledWith(1)
})
