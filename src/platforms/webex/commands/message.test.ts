import { afterAll, afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'

import { WebexError } from '../types'

const mockHandleError = mock((err: Error) => {
  throw err
})

mock.module('@/shared/utils/error-handler', () => ({
  handleError: mockHandleError,
}))

const mockMessage = {
  id: 'msg_123',
  roomId: 'space_456',
  roomType: 'group' as const,
  text: 'Hello world',
  personId: 'person_789',
  personEmail: 'user@example.com',
  created: '2025-01-29T10:00:00.000Z',
}

const mockMessage2 = {
  id: 'msg_124',
  roomId: 'space_456',
  roomType: 'group' as const,
  text: 'Second message',
  personId: 'person_789',
  personEmail: 'user@example.com',
  created: '2025-01-29T10:01:00.000Z',
}

const mockSendMessage = mock(() => Promise.resolve(mockMessage))
const mockSendDirectMessage = mock(() => Promise.resolve(mockMessage))
const mockListMessages = mock(() => Promise.resolve([mockMessage, mockMessage2]))
const mockGetMessage = mock(() => Promise.resolve(mockMessage))
const mockDeleteMessage = mock(() => Promise.resolve(undefined))
const mockEditMessage = mock(() => Promise.resolve({ ...mockMessage, text: 'Updated message' }))

const mockClient = {
  sendMessage: mockSendMessage,
  sendDirectMessage: mockSendDirectMessage,
  listMessages: mockListMessages,
  getMessage: mockGetMessage,
  deleteMessage: mockDeleteMessage,
  editMessage: mockEditMessage,
}

const mockLogin = mock(() => Promise.resolve(mockClient))

mock.module('../client', () => ({
  WebexClient: class {
    login = mockLogin
  },
}))

import { deleteAction, dmAction, editAction, getAction, listAction, sendAction } from './message'

afterAll(() => {
  mock.restore()
})

let consoleLogSpy: ReturnType<typeof spyOn>

beforeEach(() => {
  mockSendMessage.mockReset().mockImplementation(() => Promise.resolve(mockMessage))
  mockSendDirectMessage.mockReset().mockImplementation(() => Promise.resolve(mockMessage))
  mockListMessages.mockReset().mockImplementation(() => Promise.resolve([mockMessage, mockMessage2]))
  mockGetMessage.mockReset().mockImplementation(() => Promise.resolve(mockMessage))
  mockDeleteMessage.mockReset().mockImplementation(() => Promise.resolve(undefined))
  mockEditMessage.mockReset().mockImplementation(() => Promise.resolve({ ...mockMessage, text: 'Updated message' }))
  mockLogin.mockReset().mockImplementation(() => Promise.resolve(mockClient))
  mockHandleError.mockReset().mockImplementation((err: Error) => {
    throw err
  })

  consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  consoleLogSpy.mockRestore()
})

test('send: calls sendMessage with correct args and outputs result', async () => {
  await sendAction('space_456', 'Hello world', { pretty: false })

  expect(mockSendMessage).toHaveBeenCalledWith('space_456', 'Hello world', {
    markdown: undefined,
  })
  expect(consoleLogSpy).toHaveBeenCalled()
  const output = consoleLogSpy.mock.calls[0][0]
  expect(output).toContain('msg_123')
  expect(output).toContain('space_456')
  expect(output).toContain('user@example.com')
})

test('send: with --markdown passes markdown option', async () => {
  await sendAction('space_456', '**bold**', { markdown: true, pretty: false })

  expect(mockSendMessage).toHaveBeenCalledWith('space_456', '**bold**', { markdown: true })
})

test('send: not authenticated shows error', async () => {
  mockLogin.mockImplementation(async () => {
    throw new WebexError('No Webex credentials found.', 'no_credentials')
  })

  await expect(sendAction('space_456', 'Hello', { pretty: false })).rejects.toThrow('No Webex credentials found.')

  expect(mockHandleError).toHaveBeenCalledWith(expect.any(WebexError))
})

test('dm: calls sendDirectMessage with email and text', async () => {
  await dmAction('alice@example.com', 'Hello!', { pretty: false })

  expect(mockSendDirectMessage).toHaveBeenCalledWith('alice@example.com', 'Hello!', {
    markdown: undefined,
  })
  expect(consoleLogSpy).toHaveBeenCalled()
  const output = consoleLogSpy.mock.calls[0][0]
  expect(output).toContain('msg_123')
})

test('dm: with --markdown passes markdown option', async () => {
  await dmAction('alice@example.com', '**bold**', { markdown: true, pretty: false })

  expect(mockSendDirectMessage).toHaveBeenCalledWith('alice@example.com', '**bold**', {
    markdown: true,
  })
})

test('list: calls listMessages with limit and outputs array', async () => {
  await listAction('space_456', { limit: 50, pretty: false })

  expect(mockListMessages).toHaveBeenCalledWith('space_456', { max: 50 })
  expect(consoleLogSpy).toHaveBeenCalled()
  const output = consoleLogSpy.mock.calls[0][0]
  expect(output).toContain('msg_123')
  expect(output).toContain('msg_124')
})

test('get: calls getMessage with correct id and outputs result', async () => {
  await getAction('msg_123', { pretty: false })

  expect(mockGetMessage).toHaveBeenCalledWith('msg_123')
  expect(consoleLogSpy).toHaveBeenCalled()
  const output = consoleLogSpy.mock.calls[0][0]
  expect(output).toContain('msg_123')
  expect(output).toContain('user@example.com')
})

test('delete: with --force calls deleteMessage and outputs deleted id', async () => {
  await deleteAction('msg_123', { force: true, pretty: false })

  expect(mockDeleteMessage).toHaveBeenCalledWith('msg_123')
  expect(consoleLogSpy).toHaveBeenCalled()
  const output = consoleLogSpy.mock.calls[0][0]
  expect(output).toContain('deleted')
  expect(output).toContain('msg_123')
})

test('delete: without --force shows warning and does not delete', async () => {
  try {
    await deleteAction('msg_123', { force: false, pretty: false })
  } catch {}

  expect(mockDeleteMessage).not.toHaveBeenCalled()
  expect(consoleLogSpy).toHaveBeenCalled()
  const output = consoleLogSpy.mock.calls[0][0]
  expect(output).toContain('warning')
  expect(output).toContain('--force')
})

test('edit: calls editMessage with roomId in args and outputs result', async () => {
  await editAction('msg_123', 'space_456', 'Updated message', { pretty: false })

  expect(mockEditMessage).toHaveBeenCalledWith('msg_123', 'space_456', 'Updated message', {
    markdown: undefined,
  })
  expect(consoleLogSpy).toHaveBeenCalled()
  const output = consoleLogSpy.mock.calls[0][0]
  expect(output).toContain('msg_123')
  expect(output).toContain('Updated message')
})

test('edit: with --markdown passes markdown option', async () => {
  await editAction('msg_123', 'space_456', '**updated**', { markdown: true, pretty: false })

  expect(mockEditMessage).toHaveBeenCalledWith('msg_123', 'space_456', '**updated**', {
    markdown: true,
  })
})
