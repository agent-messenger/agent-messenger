import { afterAll, afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'

const mockAddReaction = mock(() => Promise.resolve(undefined))
const mockRemoveReaction = mock(() => Promise.resolve(undefined))
const mockLogin = mock(function (this: unknown) {
  return Promise.resolve(this)
})
const mockGetTokenWithExpiry = mock(() =>
  Promise.resolve({ token: 'test-token', tokenExpiresAt: undefined }),
)

mock.module('../client', () => ({
  TeamsClient: class {
    login = mockLogin
    addReaction = mockAddReaction
    removeReaction = mockRemoveReaction
  },
}))

mock.module('../credential-manager', () => ({
  TeamsCredentialManager: class {
    getTokenWithExpiry = mockGetTokenWithExpiry
  },
}))

import { addAction, removeAction } from './reaction'

let consoleLogSpy: ReturnType<typeof spyOn>
let processExitSpy: ReturnType<typeof spyOn>

afterAll(() => {
  mock.restore()
})

beforeEach(() => {
  mockAddReaction.mockReset().mockImplementation(() => Promise.resolve(undefined))
  mockRemoveReaction.mockReset().mockImplementation(() => Promise.resolve(undefined))
  mockLogin.mockReset().mockImplementation(function (this: unknown) {
    return Promise.resolve(this)
  })
  mockGetTokenWithExpiry.mockReset().mockImplementation(() =>
    Promise.resolve({ token: 'test-token', tokenExpiresAt: undefined }),
  )

  consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {})
  processExitSpy = spyOn(process, 'exit').mockImplementation((_code?: number) => {
    throw new Error(`process.exit(${_code})`)
  })
})

afterEach(() => {
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
  mockGetTokenWithExpiry.mockImplementation(() => Promise.resolve(null))

  try {
    await addAction('team123', 'ch123', 'msg123', 'like', { pretty: false })
  } catch {}

  expect(consoleLogSpy).toHaveBeenCalled()
  const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
  expect(output.error).toBeDefined()
  expect(processExitSpy).toHaveBeenCalledWith(1)
})
