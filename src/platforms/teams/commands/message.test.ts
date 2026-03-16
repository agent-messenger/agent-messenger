import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'

import { TeamsClient } from '../client'
import { TeamsCredentialManager } from '../credential-manager'
import { deleteAction, getAction, listAction, sendAction } from './message'

let clientSendMessageSpy: ReturnType<typeof spyOn>
let clientGetMessagesSpy: ReturnType<typeof spyOn>
let clientGetMessageSpy: ReturnType<typeof spyOn>
let clientDeleteMessageSpy: ReturnType<typeof spyOn>
let credManagerLoadSpy: ReturnType<typeof spyOn>
const originalConsoleLog = console.log

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

  clientGetMessageSpy = spyOn(TeamsClient.prototype, 'getMessage').mockResolvedValue({
    id: 'msg_123',
    channel_id: 'ch_456',
    author: { id: 'user_789', displayName: 'Test User' },
    content: 'Hello world',
    timestamp: '2025-01-29T10:00:00Z',
  })

  clientDeleteMessageSpy = spyOn(TeamsClient.prototype, 'deleteMessage').mockResolvedValue(undefined)

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
  clientGetMessageSpy?.mockRestore()
  clientDeleteMessageSpy?.mockRestore()
  credManagerLoadSpy?.mockRestore()
  console.log = originalConsoleLog
})

test('send: returns message with id', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await sendAction('team_123', 'ch_456', 'Hello world', { pretty: false })

  expect(consoleSpy).toHaveBeenCalled()
  const output = consoleSpy.mock.calls[0][0]
  expect(output).toContain('msg_123')
})

test('list: returns array of messages', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await listAction('team_123', 'ch_456', { limit: 50, pretty: false })

  expect(consoleSpy).toHaveBeenCalled()
  const output = consoleSpy.mock.calls[0][0]
  expect(output).toContain('msg_123')
  expect(output).toContain('msg_124')
})

test('get: returns single message', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await getAction('team_123', 'ch_456', 'msg_123', { pretty: false })

  expect(consoleSpy).toHaveBeenCalled()
  const output = consoleSpy.mock.calls[0][0]
  expect(output).toContain('msg_123')
})

test('delete: returns success', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await deleteAction('team_123', 'ch_456', 'msg_123', { force: true, pretty: false })

  expect(consoleSpy).toHaveBeenCalled()
  const output = consoleSpy.mock.calls[0][0]
  expect(output).toContain('deleted')
})
