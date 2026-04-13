import { afterEach, beforeEach, expect, spyOn, test } from 'bun:test'

import { SlackClient } from '@/platforms/slack/client'
import { whoamiAction, whoamiCommand } from '@/platforms/slack/commands/whoami'
import { CredentialManager } from '@/platforms/slack/credential-manager'

let credManagerSpy: ReturnType<typeof spyOn>
let clientTestAuthSpy: ReturnType<typeof spyOn>
let clientGetUserSpy: ReturnType<typeof spyOn>
let consoleLogSpy: ReturnType<typeof spyOn>
let processExitSpy: ReturnType<typeof spyOn>

const mockWorkspace = {
  workspace_id: 'T123',
  workspace_name: 'Test Workspace',
  token: 'xoxc-test',
  cookie: 'test-cookie',
}

const mockAuthInfo = {
  user_id: 'U123',
  team_id: 'T123',
  user: 'alice',
  team: 'Test Workspace',
}

const mockUser = {
  id: 'U123',
  name: 'alice',
  real_name: 'Alice Smith',
  is_admin: true,
  is_owner: false,
  is_bot: false,
  is_app_user: false,
  profile: {
    email: 'alice@example.com',
    title: 'Engineer',
  },
}

beforeEach(() => {
  credManagerSpy = spyOn(CredentialManager.prototype, 'getWorkspace').mockResolvedValue(mockWorkspace)
  clientTestAuthSpy = spyOn(SlackClient.prototype, 'testAuth').mockResolvedValue(mockAuthInfo)
  clientGetUserSpy = spyOn(SlackClient.prototype, 'getUser').mockResolvedValue(mockUser)
  consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {})
  processExitSpy = spyOn(process, 'exit').mockImplementation((_code?: number) => undefined as never)
})

afterEach(() => {
  credManagerSpy?.mockRestore()
  clientTestAuthSpy?.mockRestore()
  clientGetUserSpy?.mockRestore()
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

test('whoami outputs expected fields', async () => {
  await whoamiAction({})

  expect(consoleLogSpy).toHaveBeenCalledWith(
    JSON.stringify({
      id: 'U123',
      name: 'alice',
      real_name: 'Alice Smith',
      is_admin: true,
      is_owner: false,
      is_bot: false,
      is_app_user: false,
      team_id: 'T123',
      team: 'Test Workspace',
      profile: {
        email: 'alice@example.com',
        title: 'Engineer',
      },
    }),
  )
})

test('whoami outputs pretty-printed JSON when pretty is true', async () => {
  await whoamiAction({ pretty: true })

  expect(consoleLogSpy).toHaveBeenCalledWith(
    JSON.stringify(
      {
        id: 'U123',
        name: 'alice',
        real_name: 'Alice Smith',
        is_admin: true,
        is_owner: false,
        is_bot: false,
        is_app_user: false,
        team_id: 'T123',
        team: 'Test Workspace',
        profile: {
          email: 'alice@example.com',
          title: 'Engineer',
        },
      },
      null,
      2,
    ),
  )
})

test('whoami exits with error when no workspace is set', async () => {
  credManagerSpy.mockResolvedValue(null)

  await whoamiAction({})

  expect(consoleLogSpy).toHaveBeenCalledWith(
    JSON.stringify({ error: 'No current workspace set. Run "auth extract" first.' }),
  )
  expect(processExitSpy).toHaveBeenCalledWith(1)
})
