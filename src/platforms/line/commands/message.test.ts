import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'

const originalConsoleLog = console.log

import { LineClient } from '../client'
import { messageCommand } from './message'

let loginSpy: ReturnType<typeof spyOn>
let getMessagesSpy: ReturnType<typeof spyOn>
let sendMessageSpy: ReturnType<typeof spyOn>
let closeSpy: ReturnType<typeof spyOn>
let consoleLogSpy: ReturnType<typeof mock>

beforeEach(() => {
  loginSpy = spyOn(LineClient.prototype, 'login').mockImplementation(async function (this: LineClient) {
    return this
  })

  getMessagesSpy = spyOn(LineClient.prototype, 'getMessages').mockResolvedValue([
    {
      message_id: 'msg-1',
      chat_id: 'chat-1',
      author_id: 'u123',
      text: 'Hello world',
      content_type: 'NONE',
      sent_at: '2024-01-01T10:00:00Z',
    },
    {
      message_id: 'msg-2',
      chat_id: 'chat-1',
      author_id: 'u456',
      text: 'Hi there',
      content_type: 'NONE',
      sent_at: '2024-01-01T09:00:00Z',
    },
  ])

  sendMessageSpy = spyOn(LineClient.prototype, 'sendMessage').mockResolvedValue({
    success: true,
    chat_id: 'chat-1',
    message_id: 'msg-new',
    sent_at: '2024-01-01T11:00:00Z',
  })

  closeSpy = spyOn(LineClient.prototype, 'close').mockImplementation(() => {})
  consoleLogSpy = mock((..._args: unknown[]) => {})
  console.log = consoleLogSpy
})

afterEach(() => {
  loginSpy?.mockRestore()
  getMessagesSpy?.mockRestore()
  sendMessageSpy?.mockRestore()
  closeSpy?.mockRestore()
  console.log = originalConsoleLog
})

test('list: fetches and outputs messages for a chat', async () => {
  // when
  await messageCommand.parseAsync(['node', 'message', 'list', 'chat-1'])

  // then
  expect(loginSpy).toHaveBeenCalledTimes(1)
  expect(getMessagesSpy).toHaveBeenCalledWith('chat-1', { count: 20 })
  expect(consoleLogSpy).toHaveBeenCalledTimes(1)
  const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
  expect(output).toHaveLength(2)
  expect(output[0].message_id).toBe('msg-1')
  expect(output[0].text).toBe('Hello world')
})

test('list: uses custom count when --count option provided', async () => {
  // when
  await messageCommand.parseAsync(['node', 'message', 'list', 'chat-1', '--count', '5'])

  // then
  expect(getMessagesSpy).toHaveBeenCalledWith('chat-1', { count: 5 })
})

test('list: closes client after fetching messages', async () => {
  // when
  await messageCommand.parseAsync(['node', 'message', 'list', 'chat-1'])

  // then
  expect(closeSpy).toHaveBeenCalledTimes(1)
})

test('send: sends message and outputs result', async () => {
  // when
  await messageCommand.parseAsync(['node', 'message', 'send', 'chat-1', 'Hello!'])

  // then
  expect(loginSpy).toHaveBeenCalledTimes(1)
  expect(sendMessageSpy).toHaveBeenCalledWith('chat-1', 'Hello!')
  expect(consoleLogSpy).toHaveBeenCalledTimes(1)
  const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
  expect(output.success).toBe(true)
  expect(output.message_id).toBe('msg-new')
})

test('send: closes client after sending message', async () => {
  // when
  await messageCommand.parseAsync(['node', 'message', 'send', 'chat-1', 'Hello!'])

  // then
  expect(closeSpy).toHaveBeenCalledTimes(1)
})

test('list: outputs messages with metadata', async () => {
  // when
  await messageCommand.parseAsync(['node', 'message', 'list', 'chat-1'])

  // then
  const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
  const msg = output[0]
  expect(msg.message_id).toBeDefined()
  expect(msg.chat_id).toBeDefined()
  expect(msg.author_id).toBeDefined()
  expect(msg.sent_at).toBeDefined()
})
