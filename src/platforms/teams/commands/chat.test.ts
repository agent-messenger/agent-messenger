import { afterEach, beforeEach, expect, mock, spyOn, it } from 'bun:test'

import { TeamsClient } from '../client'
import { TeamsCredentialManager } from '../credential-manager'
import { editAction, historyAction, listAction, sendAction } from './chat'

let clientListChatsSpy: ReturnType<typeof spyOn>
let clientGetChatMessagesSpy: ReturnType<typeof spyOn>
let clientSendChatMessageSpy: ReturnType<typeof spyOn>
let clientEditChatMessageSpy: ReturnType<typeof spyOn>
let credManagerLoadSpy: ReturnType<typeof spyOn>
const originalConsoleLog = console.log

beforeEach(() => {
  clientListChatsSpy = spyOn(TeamsClient.prototype, 'listChats').mockResolvedValue([
    { id: '19:1on1@unq.gbl.spaces', type: 'oneOnOne', last_message: 'Hi', last_message_at: '2025-01-29T10:00:00Z' },
    { id: '19:group@thread.tacv2', type: 'group', topic: 'Group Chat' },
  ])

  clientGetChatMessagesSpy = spyOn(TeamsClient.prototype, 'getChatMessages').mockResolvedValue([
    {
      id: 'msg_123',
      channel_id: '19:1on1@unq.gbl.spaces',
      author: { id: 'user_789', displayName: 'Alice' },
      content: 'Hello world',
      timestamp: '2025-01-29T10:00:00Z',
    },
  ])

  clientSendChatMessageSpy = spyOn(TeamsClient.prototype, 'sendChatMessage').mockResolvedValue({
    id: '1704067200000',
    channel_id: '19:1on1@unq.gbl.spaces',
    author: { id: 'ME', displayName: 'Me' },
    content: 'Hello world',
    timestamp: '2025-01-29T10:00:00Z',
  })

  clientEditChatMessageSpy = spyOn(TeamsClient.prototype, 'editChatMessage').mockResolvedValue({
    id: 'msg_123',
    channel_id: '19:1on1@unq.gbl.spaces',
    author: { id: 'ME', displayName: 'Me' },
    content: 'Edited content',
    timestamp: '2025-01-29T10:05:00Z',
  })

  credManagerLoadSpy = spyOn(TeamsCredentialManager.prototype, 'loadConfig').mockResolvedValue({
    current_account: 'personal',
    accounts: {
      personal: {
        token: 'test_token',
        account_type: 'personal' as const,
        current_team: null,
        teams: {},
      },
    },
  })
})

afterEach(() => {
  clientListChatsSpy?.mockRestore()
  clientGetChatMessagesSpy?.mockRestore()
  clientSendChatMessageSpy?.mockRestore()
  clientEditChatMessageSpy?.mockRestore()
  credManagerLoadSpy?.mockRestore()
  console.log = originalConsoleLog
})

it('list: returns array of chats', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await listAction({ pretty: false })

  expect(consoleSpy).toHaveBeenCalled()
  const output = consoleSpy.mock.calls[0][0]
  expect(output).toContain('19:1on1@unq.gbl.spaces')
  expect(output).toContain('19:group@thread.tacv2')
})

it('history: returns array of messages', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await historyAction('19:1on1@unq.gbl.spaces', { limit: 50, pretty: false })

  expect(consoleSpy).toHaveBeenCalled()
  const output = consoleSpy.mock.calls[0][0]
  expect(output).toContain('msg_123')
  expect(output).toContain('Alice')
})

it('history: falls back to default limit when given a non-positive value', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await historyAction('19:1on1@unq.gbl.spaces', { limit: -5, pretty: false })

  expect(clientGetChatMessagesSpy).toHaveBeenCalledWith('19:1on1@unq.gbl.spaces', 50)
})

it('send: returns sent message', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await sendAction('19:1on1@unq.gbl.spaces', 'Hello world', { pretty: false })

  expect(consoleSpy).toHaveBeenCalled()
  const output = consoleSpy.mock.calls[0][0]
  expect(output).toContain('Hello world')
})

it('edit: edits a chat message and returns updated content', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await editAction('19:1on1@unq.gbl.spaces', 'msg_123', 'Edited content', { pretty: false })

  expect(clientEditChatMessageSpy).toHaveBeenCalledWith('19:1on1@unq.gbl.spaces', 'msg_123', 'Edited content', 'text')
  expect(consoleSpy).toHaveBeenCalled()
  const output = consoleSpy.mock.calls[0][0]
  expect(output).toContain('Edited content')
})

it('send: passes markdown format to the client', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await sendAction('19:1on1@unq.gbl.spaces', '**bold**', { pretty: false, format: 'markdown' })

  expect(clientSendChatMessageSpy).toHaveBeenCalledWith('19:1on1@unq.gbl.spaces', '**bold**', 'markdown')
})

it('send: defaults to text format when --format is omitted', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await sendAction('19:1on1@unq.gbl.spaces', 'plain', { pretty: false })

  expect(clientSendChatMessageSpy).toHaveBeenCalledWith('19:1on1@unq.gbl.spaces', 'plain', 'text')
})

it('send: rejects an invalid format', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy
  const exitSpy = spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
    throw new Error(`exit:${code}`)
  })

  await expect(sendAction('19:1on1@unq.gbl.spaces', 'hi', { pretty: false, format: 'html' })).rejects.toThrow(
    'exit:1',
  )

  expect(consoleSpy.mock.calls[0][0]).toContain('Invalid format')
  expect(clientSendChatMessageSpy).not.toHaveBeenCalled()
  exitSpy.mockRestore()
})

it('edit: passes markdown format to the client', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await editAction('19:1on1@unq.gbl.spaces', 'msg_123', '**bold**', { pretty: false, format: 'markdown' })

  expect(clientEditChatMessageSpy).toHaveBeenCalledWith('19:1on1@unq.gbl.spaces', 'msg_123', '**bold**', 'markdown')
})

it('edit: rejects an invalid format', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy
  const exitSpy = spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
    throw new Error(`exit:${code}`)
  })

  await expect(
    editAction('19:1on1@unq.gbl.spaces', 'msg_123', 'hi', { pretty: false, format: 'html' }),
  ).rejects.toThrow('exit:1')

  expect(clientEditChatMessageSpy).not.toHaveBeenCalled()
  exitSpy.mockRestore()
})
