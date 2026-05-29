import { afterEach, beforeEach, expect, spyOn, it } from 'bun:test'

import { WebexClient } from '../client'
import { WebexError } from '../types'
import { whoamiCommand } from './whoami'

const mockUser = {
  id: 'person-123',
  emails: ['test@example.com'],
  displayName: 'Test User',
  nickName: 'Testy',
  firstName: 'Test',
  lastName: 'User',
  avatar: 'https://example.com/avatar.jpg',
  orgId: 'org-123',
  type: 'person' as const,
  created: '2024-01-01T00:00:00.000Z',
}

let loginSpy: ReturnType<typeof spyOn>
let testAuthSpy: ReturnType<typeof spyOn>
let consoleLogSpy: ReturnType<typeof spyOn>
let processExitSpy: ReturnType<typeof spyOn>

beforeEach(() => {
  loginSpy = spyOn(WebexClient.prototype, 'login').mockImplementation(async function (this: WebexClient) {
    return this
  })
  testAuthSpy = spyOn(WebexClient.prototype, 'testAuth').mockResolvedValue(mockUser)
  consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {})
  processExitSpy = spyOn(process, 'exit').mockImplementation((_code?: number) => undefined as never)
})

afterEach(() => {
  loginSpy?.mockRestore()
  testAuthSpy?.mockRestore()
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

it('whoami calls testAuth and outputs user fields', async () => {
  // given: authenticated webex user
  // when: running whoami
  await whoamiCommand.parseAsync([], { from: 'user' })

  // then: outputs all expected fields
  expect(consoleLogSpy).toHaveBeenCalledWith(
    JSON.stringify({
      id: 'person-123',
      emails: ['test@example.com'],
      displayName: 'Test User',
      nickName: 'Testy',
      firstName: 'Test',
      lastName: 'User',
      avatar: 'https://example.com/avatar.jpg',
      orgId: 'org-123',
      type: 'person',
    }),
  )
})

it('whoami outputs pretty-printed JSON when --pretty flag is passed', async () => {
  // given: authenticated webex user
  // when: running whoami with --pretty
  await whoamiCommand.parseAsync(['--pretty'], { from: 'user' })

  // then: output is pretty-printed
  expect(consoleLogSpy).toHaveBeenCalledWith(
    JSON.stringify(
      {
        id: 'person-123',
        emails: ['test@example.com'],
        displayName: 'Test User',
        nickName: 'Testy',
        firstName: 'Test',
        lastName: 'User',
        avatar: 'https://example.com/avatar.jpg',
        orgId: 'org-123',
        type: 'person',
      },
      null,
      2,
    ),
  )
})

it('whoami exits with code 1 when not authenticated', async () => {
  // given: no credentials
  loginSpy.mockRejectedValue(new WebexError('No Webex credentials found.', 'no_credentials'))

  // when: running whoami
  await whoamiCommand.parseAsync([], { from: 'user' })

  // then: process exits with code 1
  expect(processExitSpy).toHaveBeenCalledWith(1)
})
