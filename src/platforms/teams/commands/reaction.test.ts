import { afterEach, beforeEach, expect, spyOn, it } from 'bun:test'

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
  consoleLogSpy.mockClear()
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

it('add: sends correct POST request with emoji', async () => {
  await addAction('team123', 'ch123', 'msg123', 'like', { pretty: false })

  expect(addReactionSpy).toHaveBeenCalledWith('team123', 'ch123', 'msg123', 'like', undefined)
  expect(consoleLogSpy).toHaveBeenCalled()
  const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
  expect(output.success).toBe(true)
  expect(output.team_id).toBe('team123')
  expect(output.channel_id).toBe('ch123')
  expect(output.message_id).toBe('msg123')
  expect(output.emoji).toBe('like')
})

it('remove: sends correct DELETE request with emoji', async () => {
  await removeAction('team123', 'ch123', 'msg123', 'like', { pretty: false })

  expect(removeReactionSpy).toHaveBeenCalledWith('team123', 'ch123', 'msg123', 'like', undefined)
  expect(consoleLogSpy).toHaveBeenCalled()
  const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
  expect(output.success).toBe(true)
  expect(output.team_id).toBe('team123')
  expect(output.channel_id).toBe('ch123')
  expect(output.message_id).toBe('msg123')
  expect(output.emoji).toBe('like')
})

it('add: handles missing token gracefully', async () => {
  getTokenWithExpirySpy.mockImplementation(() => Promise.resolve(null))

  try {
    await addAction('team123', 'ch123', 'msg123', 'like', { pretty: false })
  } catch {}

  expect(consoleLogSpy).toHaveBeenCalled()
  const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
  expect(output.error).toBeDefined()
  expect(processExitSpy).toHaveBeenCalledWith(1)
})

it('add and remove: preserve the root ID when reacting to a reply', async () => {
  await addAction('team123', 'ch123', 'reply123', '👍', { thread: 'root123' })
  await removeAction('team123', 'ch123', 'reply123', '👍', { thread: 'root123' })
  expect(addReactionSpy).toHaveBeenCalledWith('team123', 'ch123', 'reply123', '👍', 'root123')
  expect(removeReactionSpy).toHaveBeenCalledWith('team123', 'ch123', 'reply123', '👍', 'root123')
})
