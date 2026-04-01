import { afterEach, beforeEach, expect, spyOn, test } from 'bun:test'

import { WebexClient } from '../client'
import { WebexError } from '../types'
import { deleteAction, dmAction, editAction, getAction, listAction, sendAction } from './message'

let clientSendMessageSpy: ReturnType<typeof spyOn>
let clientSendDirectMessageSpy: ReturnType<typeof spyOn>
let clientListMessagesSpy: ReturnType<typeof spyOn>
let clientGetMessageSpy: ReturnType<typeof spyOn>
let clientDeleteMessageSpy: ReturnType<typeof spyOn>
let clientEditMessageSpy: ReturnType<typeof spyOn>
let clientLoginSpy: ReturnType<typeof spyOn>
let consoleLogSpy: ReturnType<typeof spyOn>
let consoleErrorSpy: ReturnType<typeof spyOn>
let processExitSpy: ReturnType<typeof spyOn>

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

beforeEach(() => {
  consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {})
  consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {})
  processExitSpy = spyOn(process, 'exit').mockImplementation((_code?: number) => {
    throw new Error(`process.exit(${_code})`)
  })

  clientLoginSpy = spyOn(WebexClient.prototype, 'login').mockResolvedValue(new WebexClient() as any)

  clientSendMessageSpy = spyOn(WebexClient.prototype, 'sendMessage').mockResolvedValue(mockMessage)

  clientSendDirectMessageSpy = spyOn(WebexClient.prototype, 'sendDirectMessage').mockResolvedValue(mockMessage)

  clientListMessagesSpy = spyOn(WebexClient.prototype, 'listMessages').mockResolvedValue([
    mockMessage,
    mockMessage2,
  ])

  clientGetMessageSpy = spyOn(WebexClient.prototype, 'getMessage').mockResolvedValue(mockMessage)

  clientDeleteMessageSpy = spyOn(WebexClient.prototype, 'deleteMessage').mockResolvedValue(
    undefined,
  )

  clientEditMessageSpy = spyOn(WebexClient.prototype, 'editMessage').mockResolvedValue({
    ...mockMessage,
    text: 'Updated message',
  })
})

afterEach(() => {
  consoleLogSpy.mockRestore()
  consoleErrorSpy.mockRestore()
  processExitSpy.mockRestore()
  clientLoginSpy.mockRestore()
  clientSendMessageSpy.mockRestore()
  clientSendDirectMessageSpy.mockRestore()
  clientListMessagesSpy.mockRestore()
  clientGetMessageSpy.mockRestore()
  clientDeleteMessageSpy.mockRestore()
  clientEditMessageSpy.mockRestore()
})

test('send: calls sendMessage with correct args and outputs result', async () => {
  await sendAction('space_456', 'Hello world', { pretty: false })

  expect(clientSendMessageSpy).toHaveBeenCalledWith('space_456', 'Hello world', {
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

  expect(clientSendMessageSpy).toHaveBeenCalledWith('space_456', '**bold**', { markdown: true })
})

test('send: not authenticated shows error', async () => {
  clientLoginSpy.mockImplementation(async () => {
    throw new WebexError('No Webex credentials found.', 'no_credentials')
  })

  let stderrOutput = ''
  const origWrite = process.stderr.write
  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderrOutput += typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk)
    return true
  }) as typeof process.stderr.write

  try {
    await sendAction('space_456', 'Hello', { pretty: false })
  } catch {
  } finally {
    process.stderr.write = origWrite
  }

  expect(processExitSpy).toHaveBeenCalledWith(1)
  expect(stderrOutput).toContain('No Webex credentials found')
})

test('dm: calls sendDirectMessage with email and text', async () => {
  await dmAction('alice@example.com', 'Hello!', { pretty: false })

  expect(clientSendDirectMessageSpy).toHaveBeenCalledWith('alice@example.com', 'Hello!', {
    markdown: undefined,
  })
  expect(consoleLogSpy).toHaveBeenCalled()
  const output = consoleLogSpy.mock.calls[0][0]
  expect(output).toContain('msg_123')
})

test('dm: with --markdown passes markdown option', async () => {
  await dmAction('alice@example.com', '**bold**', { markdown: true, pretty: false })

  expect(clientSendDirectMessageSpy).toHaveBeenCalledWith('alice@example.com', '**bold**', {
    markdown: true,
  })
})

test('list: calls listMessages with limit and outputs array', async () => {
  await listAction('space_456', { limit: 50, pretty: false })

  expect(clientListMessagesSpy).toHaveBeenCalledWith('space_456', { max: 50 })
  expect(consoleLogSpy).toHaveBeenCalled()
  const output = consoleLogSpy.mock.calls[0][0]
  expect(output).toContain('msg_123')
  expect(output).toContain('msg_124')
})

test('get: calls getMessage with correct id and outputs result', async () => {
  await getAction('msg_123', { pretty: false })

  expect(clientGetMessageSpy).toHaveBeenCalledWith('msg_123')
  expect(consoleLogSpy).toHaveBeenCalled()
  const output = consoleLogSpy.mock.calls[0][0]
  expect(output).toContain('msg_123')
  expect(output).toContain('user@example.com')
})

test('delete: with --force calls deleteMessage and outputs deleted id', async () => {
  await deleteAction('msg_123', { force: true, pretty: false })

  expect(clientDeleteMessageSpy).toHaveBeenCalledWith('msg_123')
  expect(consoleLogSpy).toHaveBeenCalled()
  const output = consoleLogSpy.mock.calls[0][0]
  expect(output).toContain('deleted')
  expect(output).toContain('msg_123')
})

test('delete: without --force shows warning and does not delete', async () => {
  try {
    await deleteAction('msg_123', { force: false, pretty: false })
  } catch {}

  expect(clientDeleteMessageSpy).not.toHaveBeenCalled()
  expect(consoleLogSpy).toHaveBeenCalled()
  const output = consoleLogSpy.mock.calls[0][0]
  expect(output).toContain('warning')
  expect(output).toContain('--force')
})

test('edit: calls editMessage with roomId in args and outputs result', async () => {
  await editAction('msg_123', 'space_456', 'Updated message', { pretty: false })

  expect(clientEditMessageSpy).toHaveBeenCalledWith('msg_123', 'space_456', 'Updated message', {
    markdown: undefined,
  })
  expect(consoleLogSpy).toHaveBeenCalled()
  const output = consoleLogSpy.mock.calls[0][0]
  expect(output).toContain('msg_123')
  expect(output).toContain('Updated message')
})

test('edit: with --markdown passes markdown option', async () => {
  await editAction('msg_123', 'space_456', '**updated**', { markdown: true, pretty: false })

  expect(clientEditMessageSpy).toHaveBeenCalledWith('msg_123', 'space_456', '**updated**', {
    markdown: true,
  })
})
