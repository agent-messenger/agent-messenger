import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'

import { WebexError } from '../types'

const mockHandleError = mock((err: Error) => {
  throw err
})

mock.module('@/shared/utils/error-handler', () => ({
  handleError: mockHandleError,
}))

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

const mockTestAuth = mock(() => Promise.resolve(mockUser))
const mockLogin = mock(() => Promise.resolve({ testAuth: mockTestAuth }))

mock.module('../client', () => ({
  WebexClient: class {
    login = mockLogin
  },
}))

import { whoamiCommand } from './whoami'

let consoleLogSpy: ReturnType<typeof spyOn>

beforeEach(() => {
  mockTestAuth.mockReset().mockImplementation(() => Promise.resolve(mockUser))
  mockLogin.mockReset().mockImplementation(() => Promise.resolve({ testAuth: mockTestAuth }))
  mockHandleError.mockReset().mockImplementation((err: Error) => {
    throw err
  })

  consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  consoleLogSpy.mockRestore()
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

test('whoami calls testAuth and outputs user fields', async () => {
  // given: authenticated webex user
  // when: running whoami
  await whoamiCommand.parseAsync([], { from: 'user' })

  // then: outputs all expected fields
  expect(mockTestAuth).toHaveBeenCalled()
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

test('whoami outputs pretty-printed JSON when --pretty flag is passed', async () => {
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

test('whoami surfaces error when not authenticated', async () => {
  // given: no credentials
  mockLogin.mockImplementation(async () => {
    throw new WebexError('No Webex credentials found.', 'no_credentials')
  })

  // when/then: error is thrown and handleError is called
  await expect(whoamiCommand.parseAsync([], { from: 'user' })).rejects.toThrow('No Webex credentials found.')
  expect(mockHandleError).toHaveBeenCalledWith(expect.any(WebexError))
})
