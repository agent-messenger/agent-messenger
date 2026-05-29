import { afterEach, beforeEach, expect, spyOn, it } from 'bun:test'

import { WebexClient } from '../client'
import { WebexError } from '../types'

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

import { deleteAction, dmAction, editAction, getAction, listAction, sendAction } from './message'

let mockSendMessage: ReturnType<typeof spyOn>
let mockSendDirectMessage: ReturnType<typeof spyOn>
let mockListMessages: ReturnType<typeof spyOn>
let mockGetMessage: ReturnType<typeof spyOn>
let mockDeleteMessage: ReturnType<typeof spyOn>
let mockEditMessage: ReturnType<typeof spyOn>
let mockLogin: ReturnType<typeof spyOn>
let consoleLogSpy: ReturnType<typeof spyOn>
let consoleErrorSpy: ReturnType<typeof spyOn>
let processExitSpy: ReturnType<typeof spyOn>
const protoSpies: ReturnType<typeof spyOn>[] = []

function protoSpy(method: keyof WebexClient) {
  const s = spyOn(WebexClient.prototype, method as never)
  protoSpies.push(s)
  return s
}

beforeEach(() => {
  mockLogin = protoSpy('login').mockImplementation(async function (this: WebexClient) {
    return this
  })
  mockSendMessage = protoSpy('sendMessage').mockResolvedValue(mockMessage)
  mockSendDirectMessage = protoSpy('sendDirectMessage').mockResolvedValue(mockMessage)
  mockListMessages = protoSpy('listMessages').mockResolvedValue([mockMessage, mockMessage2])
  mockGetMessage = protoSpy('getMessage').mockResolvedValue(mockMessage)
  mockDeleteMessage = protoSpy('deleteMessage').mockResolvedValue(undefined)
  mockEditMessage = protoSpy('editMessage').mockResolvedValue({ ...mockMessage, text: 'Updated message' })

  consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {})
  consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {})
  processExitSpy = spyOn(process, 'exit').mockImplementation((_code?: number) => undefined as never)
})

afterEach(() => {
  consoleLogSpy.mockRestore()
  consoleErrorSpy.mockRestore()
  processExitSpy.mockRestore()
  for (const s of protoSpies) s.mockRestore()
  protoSpies.length = 0
})

it('calls sendMessage with correct args and outputs result', async () => {
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

it('passes markdown option when --markdown flag is set on send', async () => {
  await sendAction('space_456', '**bold**', { markdown: true, pretty: false })

  expect(mockSendMessage).toHaveBeenCalledWith('space_456', '**bold**', { markdown: true })
})

it('exits with code 1 when not authenticated on send', async () => {
  mockLogin.mockRejectedValue(new WebexError('No Webex credentials found.', 'no_credentials'))

  await sendAction('space_456', 'Hello', { pretty: false })

  expect(mockSendMessage).not.toHaveBeenCalled()
  expect(processExitSpy).toHaveBeenCalledWith(1)
})

it('calls sendDirectMessage with email and text', async () => {
  await dmAction('alice@example.com', 'Hello!', { pretty: false })

  expect(mockSendDirectMessage).toHaveBeenCalledWith('alice@example.com', 'Hello!', {
    markdown: undefined,
  })
  expect(consoleLogSpy).toHaveBeenCalled()
  const output = consoleLogSpy.mock.calls[0][0]
  expect(output).toContain('msg_123')
})

it('passes markdown option to sendDirectMessage when --markdown flag is set', async () => {
  await dmAction('alice@example.com', '**bold**', { markdown: true, pretty: false })

  expect(mockSendDirectMessage).toHaveBeenCalledWith('alice@example.com', '**bold**', {
    markdown: true,
  })
})

it('calls listMessages with limit and outputs array', async () => {
  await listAction('space_456', { limit: 50, pretty: false })

  expect(mockListMessages).toHaveBeenCalledWith('space_456', { max: 50 })
  expect(consoleLogSpy).toHaveBeenCalled()
  const output = consoleLogSpy.mock.calls[0][0]
  expect(output).toContain('msg_123')
  expect(output).toContain('msg_124')
})

it('calls getMessage with correct id and outputs result', async () => {
  await getAction('msg_123', { pretty: false })

  expect(mockGetMessage).toHaveBeenCalledWith('msg_123')
  expect(consoleLogSpy).toHaveBeenCalled()
  const output = consoleLogSpy.mock.calls[0][0]
  expect(output).toContain('msg_123')
  expect(output).toContain('user@example.com')
})

it('calls deleteMessage and outputs deleted id when --force flag is set', async () => {
  await deleteAction('msg_123', { force: true, pretty: false })

  expect(mockDeleteMessage).toHaveBeenCalledWith('msg_123')
  expect(consoleLogSpy).toHaveBeenCalled()
  const output = consoleLogSpy.mock.calls[0][0]
  expect(output).toContain('deleted')
  expect(output).toContain('msg_123')
})

it('shows warning and does not delete without --force flag', async () => {
  try {
    await deleteAction('msg_123', { force: false, pretty: false })
  } catch {}

  expect(mockDeleteMessage).not.toHaveBeenCalled()
  expect(consoleLogSpy).toHaveBeenCalled()
  const output = consoleLogSpy.mock.calls[0][0]
  expect(output).toContain('warning')
  expect(output).toContain('--force')
})

it('calls editMessage with roomId in args and outputs result', async () => {
  await editAction('msg_123', 'space_456', 'Updated message', { pretty: false })

  expect(mockEditMessage).toHaveBeenCalledWith('msg_123', 'space_456', 'Updated message', {
    markdown: undefined,
  })
  expect(consoleLogSpy).toHaveBeenCalled()
  const output = consoleLogSpy.mock.calls[0][0]
  expect(output).toContain('msg_123')
  expect(output).toContain('Updated message')
})

it('passes markdown option to editMessage when --markdown flag is set', async () => {
  await editAction('msg_123', 'space_456', '**updated**', { markdown: true, pretty: false })

  expect(mockEditMessage).toHaveBeenCalledWith('msg_123', 'space_456', '**updated**', {
    markdown: true,
  })
})
