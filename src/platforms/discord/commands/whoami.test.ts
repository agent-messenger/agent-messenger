import { afterEach, beforeEach, expect, spyOn, it } from 'bun:test'

import { DiscordClient } from '@/platforms/discord/client'
import { whoamiAction, whoamiCommand } from '@/platforms/discord/commands/whoami'
import { DiscordCredentialManager } from '@/platforms/discord/credential-manager'

let credManagerSpy: ReturnType<typeof spyOn>
let clientTestAuthSpy: ReturnType<typeof spyOn>
let consoleLogSpy: ReturnType<typeof spyOn>
let processExitSpy: ReturnType<typeof spyOn>

const mockConfig = {
  token: 'test-discord-token',
}

const mockUser = {
  id: 'user123',
  username: 'testuser',
  global_name: 'Test User',
  avatar: 'avatar_hash',
  bot: false,
}

beforeEach(() => {
  credManagerSpy = spyOn(DiscordCredentialManager.prototype, 'load').mockResolvedValue(mockConfig)
  clientTestAuthSpy = spyOn(DiscordClient.prototype, 'testAuth').mockResolvedValue(mockUser)
  consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {})
  processExitSpy = spyOn(process, 'exit').mockImplementation((_code?: number) => undefined as never)
})

afterEach(() => {
  credManagerSpy?.mockRestore()
  clientTestAuthSpy?.mockRestore()
  consoleLogSpy?.mockRestore()
  processExitSpy?.mockRestore()
})

it('whoami command is defined with correct name and description', () => {
  expect(whoamiCommand).toBeDefined()
  expect(whoamiCommand.name()).toBe('whoami')
  expect(whoamiCommand.description()).toBe('Show current authenticated user')
})

it('whoami command has --pretty option', () => {
  const options = whoamiCommand.options
  const hasPretty = options.some((opt: { long?: string }) => opt.long === '--pretty')
  expect(hasPretty).toBe(true)
})

it('whoami outputs expected user fields', async () => {
  await whoamiAction({})

  expect(consoleLogSpy).toHaveBeenCalledWith(
    JSON.stringify({
      id: 'user123',
      username: 'testuser',
      global_name: 'Test User',
      avatar: 'avatar_hash',
      bot: false,
    }),
  )
})

it('whoami outputs pretty-printed JSON when pretty is true', async () => {
  await whoamiAction({ pretty: true })

  expect(consoleLogSpy).toHaveBeenCalledWith(
    JSON.stringify(
      {
        id: 'user123',
        username: 'testuser',
        global_name: 'Test User',
        avatar: 'avatar_hash',
        bot: false,
      },
      null,
      2,
    ),
  )
})

it('whoami exits with error when not authenticated', async () => {
  credManagerSpy.mockResolvedValue({ token: undefined })

  await whoamiAction({})

  expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify({ error: 'Not authenticated. Run "auth extract" first.' }))
  expect(processExitSpy).toHaveBeenCalledWith(1)
})
