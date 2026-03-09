import { afterEach, beforeEach, expect, mock, spyOn, test } from 'bun:test'

import { DiscordClient } from '../client'
import { DiscordCredentialManager } from '../credential-manager'
import { ackAction, deleteAction, getAction, listAction, searchAction, sendAction } from './message'

let clientSendMessageSpy: ReturnType<typeof spyOn>
let clientGetMessagesSpy: ReturnType<typeof spyOn>
let clientGetMessageSpy: ReturnType<typeof spyOn>
let clientDeleteMessageSpy: ReturnType<typeof spyOn>
let clientAckMessageSpy: ReturnType<typeof spyOn>
let clientSearchMessagesSpy: ReturnType<typeof spyOn>
let credManagerLoadSpy: ReturnType<typeof spyOn>

beforeEach(() => {
  // Spy on DiscordClient.prototype methods
  clientSendMessageSpy = spyOn(DiscordClient.prototype, 'sendMessage').mockResolvedValue({
    id: 'msg_123',
    channel_id: 'ch_456',
    author: { id: 'user_789', username: 'testuser' },
    content: 'Hello world',
    timestamp: '2025-01-29T10:00:00Z',
  })

  clientGetMessagesSpy = spyOn(DiscordClient.prototype, 'getMessages').mockResolvedValue([
    {
      id: 'msg_123',
      channel_id: 'ch_456',
      author: { id: 'user_789', username: 'testuser' },
      content: 'Hello world',
      timestamp: '2025-01-29T10:00:00Z',
    },
    {
      id: 'msg_124',
      channel_id: 'ch_456',
      author: { id: 'user_789', username: 'testuser' },
      content: 'Second message',
      timestamp: '2025-01-29T10:01:00Z',
    },
  ])

  clientGetMessageSpy = spyOn(DiscordClient.prototype, 'getMessage').mockResolvedValue({
    id: 'msg_123',
    channel_id: 'ch_456',
    author: { id: 'user_789', username: 'testuser' },
    content: 'Hello world',
    timestamp: '2025-01-29T10:00:00Z',
  })

  clientDeleteMessageSpy = spyOn(DiscordClient.prototype, 'deleteMessage').mockResolvedValue(undefined)

  clientAckMessageSpy = spyOn(DiscordClient.prototype, 'ackMessage').mockResolvedValue(undefined)

  clientSearchMessagesSpy = spyOn(DiscordClient.prototype, 'searchMessages').mockResolvedValue({
    results: [
      {
        id: 'msg_search_1',
        channel_id: 'ch_456',
        guild_id: 'server_123',
        content: 'Hello world',
        author: { id: 'user_789', username: 'testuser' },
        timestamp: '2025-01-29T10:00:00Z',
        hit: true,
      },
      {
        id: 'msg_search_2',
        channel_id: 'ch_456',
        guild_id: 'server_123',
        content: 'Hello again',
        author: { id: 'user_789', username: 'testuser' },
        timestamp: '2025-01-29T10:01:00Z',
        hit: true,
      },
    ],
    total: 2,
  })

  // Spy on DiscordCredentialManager.prototype methods
  credManagerLoadSpy = spyOn(DiscordCredentialManager.prototype, 'load').mockResolvedValue({
    token: 'test_token',
    current_server: 'server_123',
    servers: {},
  })
})

afterEach(() => {
  clientSendMessageSpy?.mockRestore()
  clientGetMessagesSpy?.mockRestore()
  clientGetMessageSpy?.mockRestore()
  clientDeleteMessageSpy?.mockRestore()
  clientAckMessageSpy?.mockRestore()
  clientSearchMessagesSpy?.mockRestore()
  credManagerLoadSpy?.mockRestore()
})

test('send: returns message with id', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await sendAction('ch_456', 'Hello world', { pretty: false })

  expect(consoleSpy).toHaveBeenCalled()
  const output = consoleSpy.mock.calls[0][0]
  expect(output).toContain('msg_123')
})

test('list: returns array of messages', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await listAction('ch_456', { limit: 50, pretty: false })

  expect(consoleSpy).toHaveBeenCalled()
  const output = consoleSpy.mock.calls[0][0]
  expect(output).toContain('msg_123')
  expect(output).toContain('msg_124')
})

test('get: returns single message', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await getAction('ch_456', 'msg_123', { pretty: false })

  expect(consoleSpy).toHaveBeenCalled()
  const output = consoleSpy.mock.calls[0][0]
  expect(output).toContain('msg_123')
})

test('delete: returns success', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await deleteAction('ch_456', 'msg_123', { force: true, pretty: false })

  expect(consoleSpy).toHaveBeenCalled()
  const output = consoleSpy.mock.calls[0][0]
  expect(output).toContain('deleted')
})

test('ack: returns success', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await ackAction('ch_456', 'msg_123', { pretty: false })

  expect(consoleSpy).toHaveBeenCalled()
  const output = consoleSpy.mock.calls[0][0]
  expect(output).toContain('acknowledged')
})

test('search: returns search results with query', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await searchAction('Hello', { pretty: false })

  expect(consoleSpy).toHaveBeenCalled()
  const output = consoleSpy.mock.calls[0][0]
  expect(output).toContain('msg_search_1')
  expect(output).toContain('msg_search_2')
  expect(output).toContain('Hello world')
})

test('search: includes total_results in output', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await searchAction('Hello', { pretty: false })

  expect(consoleSpy).toHaveBeenCalled()
  const output = consoleSpy.mock.calls[0][0]
  expect(output).toContain('total_results')
  expect(output).toContain('2')
})

test('search: passes options to client', async () => {
  const consoleSpy = mock((_msg: string) => {})
  console.log = consoleSpy

  await searchAction('test', {
    channel: 'ch_specific',
    author: 'user_specific',
    has: 'image',
    sort: 'timestamp',
    sortDir: 'asc',
    limit: 10,
    offset: 5,
    pretty: false,
  })

  expect(clientSearchMessagesSpy).toHaveBeenCalledWith('server_123', 'test', {
    channelId: 'ch_specific',
    authorId: 'user_specific',
    has: 'image',
    sortBy: 'timestamp',
    sortOrder: 'asc',
    limit: 10,
    offset: 5,
  })
})
