import { afterEach, beforeEach, expect, spyOn, test } from 'bun:test'

import { TeamsClient } from '@/platforms/teams/client'
import { whoamiAction, whoamiCommand } from '@/platforms/teams/commands/whoami'
import { TeamsCredentialManager } from '@/platforms/teams/credential-manager'

let credManagerSpy: ReturnType<typeof spyOn>
let clientTestAuthSpy: ReturnType<typeof spyOn>
let consoleLogSpy: ReturnType<typeof spyOn>
let processExitSpy: ReturnType<typeof spyOn>

const mockCred = {
  token: 'test-teams-token',
  tokenExpiresAt: '2099-01-01T00:00:00.000Z',
}

const mockUser = {
  id: 'ME',
  displayName: 'Test User',
}

beforeEach(() => {
  credManagerSpy = spyOn(TeamsCredentialManager.prototype, 'getTokenWithExpiry').mockResolvedValue(mockCred)
  clientTestAuthSpy = spyOn(TeamsClient.prototype, 'testAuth').mockResolvedValue(mockUser)
  consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {})
  processExitSpy = spyOn(process, 'exit').mockImplementation((_code?: number) => undefined as never)
})

afterEach(() => {
  credManagerSpy?.mockRestore()
  clientTestAuthSpy?.mockRestore()
  consoleLogSpy?.mockRestore()
  processExitSpy?.mockRestore()
})

test('whoami command is defined with correct name and description', () => {
  expect(whoamiCommand).toBeDefined()
  expect(whoamiCommand.name()).toBe('whoami')
  expect(whoamiCommand.description()).toBe('Show current authenticated user')
})

test('whoami command has --pretty option', () => {
  const options = whoamiCommand.options
  const hasPretty = options.some((opt: { long?: string }) => opt.long === '--pretty')
  expect(hasPretty).toBe(true)
})

test('whoami outputs id and displayName', async () => {
  await whoamiAction({})

  expect(consoleLogSpy).toHaveBeenCalledWith(
    JSON.stringify({
      id: 'ME',
      displayName: 'Test User',
    }),
  )
})

test('whoami outputs pretty-printed JSON when pretty is true', async () => {
  await whoamiAction({ pretty: true })

  expect(consoleLogSpy).toHaveBeenCalledWith(
    JSON.stringify(
      {
        id: 'ME',
        displayName: 'Test User',
      },
      null,
      2,
    ),
  )
})

test('whoami exits with error when not authenticated', async () => {
  credManagerSpy.mockResolvedValue(null)

  await whoamiAction({})

  expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify({ error: 'Not authenticated. Run "auth extract" first.' }))
  expect(processExitSpy).toHaveBeenCalledWith(1)
})
