import { afterEach, beforeEach, expect, mock, spyOn, it } from 'bun:test'

import { TeamsClient } from '../client'
import { TeamsCredentialManager } from '../credential-manager'
import { deleteAction, getAction, listAction, repliesAction, searchAction, sendAction, strictParseInt } from './message'

let clientSendMessageSpy: ReturnType<typeof spyOn>
let clientGetMessagesSpy: ReturnType<typeof spyOn>
let clientGetThreadRepliesSpy: ReturnType<typeof spyOn>
let clientGetMessageSpy: ReturnType<typeof spyOn>
let clientDeleteMessageSpy: ReturnType<typeof spyOn>
let clientSearchMessagesSpy: ReturnType<typeof spyOn>
let credManagerLoadSpy: ReturnType<typeof spyOn>
const originalConsoleLog = console.log
const originalConsoleError = console.error

beforeEach(() => {
  clientSendMessageSpy = spyOn(TeamsClient.prototype, 'sendMessage').mockResolvedValue({
    id: 'msg_123',
    channel_id: 'ch_456',
    author: { id: 'user_789', displayName: 'Test User' },
    content: 'Hello world',
    timestamp: '2025-01-29T10:00:00Z',
  })

  clientGetMessagesSpy = spyOn(TeamsClient.prototype, 'getMessages').mockResolvedValue([
    {
      id: 'msg_123',
      channel_id: 'ch_456',
      author: { id: 'user_789', displayName: 'Test User' },
      content: 'Hello world',
      timestamp: '2025-01-29T10:00:00Z',
    },
    {
      id: 'msg_124',
      channel_id: 'ch_456',
      author: { id: 'user_789', displayName: 'Test User' },
      content: 'Second message',
      timestamp: '2025-01-29T10:01:00Z',
    },
  ])

  clientGetThreadRepliesSpy = spyOn(TeamsClient.prototype, 'getThreadReplies').mockResolvedValue([
    {
      id: 'reply_123',
      channel_id: 'ch_456',
      author: { id: 'user_789', displayName: 'Test User' },
      content: 'Thread reply',
      timestamp: '2025-01-29T10:02:00Z',
      root_message_id: 'msg_123',
      is_thread_reply: true,
    },
  ])

  clientGetMessageSpy = spyOn(TeamsClient.prototype, 'getMessage').mockResolvedValue({
    id: 'msg_123',
    channel_id: 'ch_456',
    author: { id: 'user_789', displayName: 'Test User' },
    content: 'Hello world',
    timestamp: '2025-01-29T10:00:00Z',
  })

  clientDeleteMessageSpy = spyOn(TeamsClient.prototype, 'deleteMessage').mockResolvedValue(undefined)

  clientSearchMessagesSpy = spyOn(TeamsClient.prototype, 'searchMessages').mockResolvedValue([
    {
      id: 'search_123',
      content: 'Deploy complete',
      author: { id: 'user_789', displayName: 'Test User' },
      channel_id: 'ch_456',
      thread_id: 'thread_123',
      team_name: 'Test Team',
      channel_name: 'General',
      timestamp: '2025-01-29T10:03:00Z',
      permalink: 'https://teams.microsoft.com/l/message/search_123',
    },
  ])

  credManagerLoadSpy = spyOn(TeamsCredentialManager.prototype, 'loadConfig').mockResolvedValue({
    current_account: 'work',
    accounts: {
      work: {
        token: 'test_token',
        account_type: 'work' as const,
        current_team: 'team_123',
        teams: { team_123: { team_id: 'team_123', team_name: 'Test Team' } },
      },
    },
  })
})

afterEach(() => {
  clientSendMessageSpy?.mockRestore()
  clientGetMessagesSpy?.mockRestore()
  clientGetThreadRepliesSpy?.mockRestore()
  clientGetMessageSpy?.mockRestore()
  clientDeleteMessageSpy?.mockRestore()
  clientSearchMessagesSpy?.mockRestore()
  credManagerLoadSpy?.mockRestore()
  console.log = originalConsoleLog
  console.error = originalConsoleError
})

it('send: returns message with id', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await sendAction('team_123', 'ch_456', 'Hello world', { pretty: false })

  expect(consoleSpy).toHaveBeenCalled()
  const output = consoleSpy.mock.calls[0][0]
  expect(output).toContain('msg_123')
})

it('list: returns array of messages', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await listAction('team_123', 'ch_456', { limit: 50, pretty: false })

  expect(consoleSpy).toHaveBeenCalled()
  const output = consoleSpy.mock.calls[0][0]
  expect(output).toContain('msg_123')
  expect(output).toContain('msg_124')
})

it('replies: returns array of thread replies', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await repliesAction('team_123', 'ch_456', 'msg_123', { limit: 10, pretty: false })

  expect(clientGetThreadRepliesSpy).toHaveBeenCalledWith('team_123', 'ch_456', 'msg_123', 10)
  expect(consoleSpy).toHaveBeenCalled()
  const output = consoleSpy.mock.calls[0][0]
  expect(output).toContain('reply_123')
  expect(output).toContain('msg_123')
})

it('search: returns search results and passes pagination options', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await searchAction('deploy', { limit: 10, from: 5, pretty: false })

  expect(clientSearchMessagesSpy).toHaveBeenCalledWith('deploy', { limit: 10, from: 5 })
  expect(consoleSpy).toHaveBeenCalled()
  const output = consoleSpy.mock.calls[0][0]
  expect(output).toContain('search_123')
  expect(output).toContain('Deploy complete')
})

it.each([
  ['abc', Number.NaN],
  ['1.5', Number.NaN],
  ['1abc', Number.NaN],
  ['', Number.NaN],
  ['10', 10],
  [' 10 ', 10],
  ['-1', -1],
])('strictParseInt(%p) -> %p (rejects truncatable strings)', (input, expected) => {
  const result = strictParseInt(input)
  if (Number.isNaN(expected)) {
    expect(Number.isNaN(result)).toBe(true)
  } else {
    expect(result).toBe(expected as number)
  }
})

it.each([
  ['--limit abc', { limit: Number.NaN, from: 0 }],
  ['--limit 0', { limit: 0, from: 0 }],
  ['--limit -1', { limit: -1, from: 0 }],
  ['--from -1', { limit: 20, from: -1 }],
])('search: rejects invalid pagination %s', async (_label, options) => {
  const consoleErrorSpy = mock((_msg: string) => {})
  console.error = consoleErrorSpy
  const exitSpy = spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
    throw new Error(`exit:${code}`)
  })

  await expect(searchAction('deploy', { ...options, pretty: false })).rejects.toThrow('exit:1')

  expect(consoleErrorSpy).toHaveBeenCalled()
  expect(clientSearchMessagesSpy).not.toHaveBeenCalled()
  exitSpy.mockRestore()
})

it('get: returns single message', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await getAction('team_123', 'ch_456', 'msg_123', { pretty: false })

  expect(consoleSpy).toHaveBeenCalled()
  const output = consoleSpy.mock.calls[0][0]
  expect(output).toContain('msg_123')
})

it('delete: returns success', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await deleteAction('team_123', 'ch_456', 'msg_123', { force: true, pretty: false })

  expect(consoleSpy).toHaveBeenCalled()
  const output = consoleSpy.mock.calls[0][0]
  expect(output).toContain('deleted')
})

it('send: passes markdown format to the client', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await sendAction('team_123', 'ch_456', '**bold**', { pretty: false, format: 'markdown' })

  expect(clientSendMessageSpy).toHaveBeenCalledWith('team_123', 'ch_456', '**bold**', undefined, 'markdown')
})

it('send: defaults to text format when --format is omitted', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await sendAction('team_123', 'ch_456', 'plain', { pretty: false })

  expect(clientSendMessageSpy).toHaveBeenCalledWith('team_123', 'ch_456', 'plain', undefined, 'text')
})

it('send: rejects an invalid format', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy
  const exitSpy = spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
    throw new Error(`exit:${code}`)
  })

  try {
    await expect(sendAction('team_123', 'ch_456', 'hi', { pretty: false, format: 'invalid' })).rejects.toThrow('exit:1')

    expect(consoleSpy).toHaveBeenCalled()
    expect(consoleSpy.mock.calls[0][0]).toContain('Invalid format')
    expect(clientSendMessageSpy).not.toHaveBeenCalled()
  } finally {
    // Restore in finally: a failing assertion above would otherwise leave
    // process.exit mocked, so every later test would throw instead of exiting.
    exitSpy.mockRestore()
  }
})

it('send: passes html format to the client', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await sendAction('team_123', 'ch_456', '<at id="29:x">John</at>', { pretty: false, format: 'html' })

  expect(clientSendMessageSpy).toHaveBeenCalledWith('team_123', 'ch_456', '<at id="29:x">John</at>', undefined, 'html')
})

it('send: passes markdown format together with --thread', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await sendAction('team_123', 'ch_456', '**bold**', { pretty: false, thread: 'root_1', format: 'markdown' })

  expect(clientSendMessageSpy).toHaveBeenCalledWith('team_123', 'ch_456', '**bold**', 'root_1', 'markdown')
})
