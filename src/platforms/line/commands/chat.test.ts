import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'

const originalConsoleLog = console.log

import { LineClient } from '../client'
import { chatCommand } from './chat'

let loginSpy: ReturnType<typeof spyOn>
let getChatsSpy: ReturnType<typeof spyOn>
let closeSpy: ReturnType<typeof spyOn>
let consoleLogSpy: ReturnType<typeof mock>

beforeEach(() => {
  loginSpy = spyOn(LineClient.prototype, 'login').mockImplementation(async function (this: LineClient) {
    return this
  })

  getChatsSpy = spyOn(LineClient.prototype, 'getChats').mockResolvedValue([
    {
      chat_id: 'c111',
      type: 'user',
      display_name: 'Alice',
      member_count: 2,
    },
    {
      chat_id: 'c222',
      type: 'group',
      display_name: 'Team Chat',
      member_count: 10,
    },
    {
      chat_id: 'c333',
      type: 'room',
      display_name: 'Project Room',
      member_count: 5,
    },
  ])

  closeSpy = spyOn(LineClient.prototype, 'close').mockImplementation(() => {})
  consoleLogSpy = mock((..._args: unknown[]) => {})
  console.log = consoleLogSpy
})

afterEach(() => {
  loginSpy?.mockRestore()
  getChatsSpy?.mockRestore()
  closeSpy?.mockRestore()
  console.log = originalConsoleLog
})

test('list: fetches and outputs chats', async () => {
  // when
  await chatCommand.parseAsync(['node', 'chat', 'list'])

  // then
  expect(loginSpy).toHaveBeenCalledTimes(1)
  expect(getChatsSpy).toHaveBeenCalledWith({ limit: 50 })
  expect(consoleLogSpy).toHaveBeenCalledTimes(1)
  const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
  expect(output).toHaveLength(3)
  expect(output[0].chat_id).toBe('c111')
  expect(output[1].chat_id).toBe('c222')
})

test('list: uses default limit of 50 when no limit provided', async () => {
  // when
  await chatCommand.parseAsync(['node', 'chat', 'list'])

  // then
  expect(getChatsSpy).toHaveBeenCalledWith({ limit: 50 })
})

test('list: uses custom limit when --limit option provided', async () => {
  // when
  await chatCommand.parseAsync(['node', 'chat', 'list', '--limit', '10'])

  // then
  expect(getChatsSpy).toHaveBeenCalledWith({ limit: 10 })
})

test('list: closes client after fetching chats', async () => {
  // when
  await chatCommand.parseAsync(['node', 'chat', 'list'])

  // then
  expect(closeSpy).toHaveBeenCalledTimes(1)
})

test('list: outputs chat metadata', async () => {
  // when
  await chatCommand.parseAsync(['node', 'chat', 'list'])

  // then
  const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
  const chat = output[0]
  expect(chat.chat_id).toBeDefined()
  expect(chat.type).toBeDefined()
  expect(chat.display_name).toBeDefined()
})

test('list: includes different chat types', async () => {
  // when
  await chatCommand.parseAsync(['node', 'chat', 'list'])

  // then
  const output = JSON.parse(consoleLogSpy.mock.calls[0][0])
  const types = output.map((c: { type: string }) => c.type)
  expect(types).toContain('user')
  expect(types).toContain('group')
  expect(types).toContain('room')
})
