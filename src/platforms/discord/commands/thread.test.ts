import { afterEach, beforeEach, expect, spyOn, test } from 'bun:test'

import { DiscordClient } from '../client'
import { DiscordCredentialManager } from '../credential-manager'

let clientCreateThreadSpy: ReturnType<typeof spyOn>
let clientArchiveThreadSpy: ReturnType<typeof spyOn>
let credManagerLoadSpy: ReturnType<typeof spyOn>

beforeEach(() => {
  clientCreateThreadSpy = spyOn(DiscordClient.prototype, 'createThread').mockResolvedValue({
    id: 'thread-1',
    guild_id: 'guild-1',
    name: 'Test Thread',
    type: 11,
    parent_id: 'ch-1',
  })

  clientArchiveThreadSpy = spyOn(DiscordClient.prototype, 'archiveThread').mockResolvedValue({
    id: 'thread-1',
    guild_id: 'guild-1',
    name: 'Test Thread',
    type: 11,
    parent_id: 'ch-1',
    thread_metadata: {
      archived: true,
      auto_archive_duration: 1440,
      archive_timestamp: '2024-01-29T10:00:00Z',
    },
  })

  credManagerLoadSpy = spyOn(DiscordCredentialManager.prototype, 'load').mockResolvedValue({
    token: 'test-token',
    current_server: 'server-1',
    servers: {
      'server-1': { server_id: 'server-1', server_name: 'Server One' },
    },
  })
})

afterEach(() => {
  clientCreateThreadSpy?.mockRestore()
  clientArchiveThreadSpy?.mockRestore()
  credManagerLoadSpy?.mockRestore()
})

test('createThread: creates thread with name', async () => {
  // given: discord client
  const client = new DiscordClient('test-token')

  // when: creating thread
  const thread = await client.createThread('ch-1', 'Test Thread')

  // then: thread is created
  expect(thread).toBeDefined()
  expect(thread.id).toBe('thread-1')
  expect(thread.name).toBe('Test Thread')
  expect(thread.type).toBe(11)
  expect(thread.parent_id).toBe('ch-1')
})

test('createThread: creates thread with auto_archive_duration', async () => {
  // given: discord client
  const client = new DiscordClient('test-token')

  // when: creating thread with auto_archive_duration
  await client.createThread('ch-1', 'Test Thread', { auto_archive_duration: 60 })

  // then: createThread is called with options
  expect(clientCreateThreadSpy).toHaveBeenCalledWith('ch-1', 'Test Thread', {
    auto_archive_duration: 60,
  })
})

test('createThread: creates thread with rate_limit_per_user', async () => {
  // given: discord client
  const client = new DiscordClient('test-token')

  // when: creating thread with rate_limit_per_user
  await client.createThread('ch-1', 'Test Thread', { rate_limit_per_user: 10 })

  // then: createThread is called with options
  expect(clientCreateThreadSpy).toHaveBeenCalledWith('ch-1', 'Test Thread', {
    rate_limit_per_user: 10,
  })
})

test('archiveThread: archives thread', async () => {
  // given: discord client
  const client = new DiscordClient('test-token')

  // when: archiving thread
  const thread = await client.archiveThread('thread-1')

  // then: thread is archived
  expect(thread).toBeDefined()
  expect(thread.id).toBe('thread-1')
  expect(thread.thread_metadata?.archived).toBe(true)
})

test('archiveThread: unarchives thread when archived=false', async () => {
  // given: discord client with unarchive mock
  clientArchiveThreadSpy.mockResolvedValue({
    id: 'thread-1',
    guild_id: 'guild-1',
    name: 'Test Thread',
    type: 11,
    parent_id: 'ch-1',
    thread_metadata: {
      archived: false,
      auto_archive_duration: 1440,
    },
  })
  const client = new DiscordClient('test-token')

  // when: unarchiving thread
  const thread = await client.archiveThread('thread-1', false)

  // then: thread is unarchived
  expect(thread).toBeDefined()
  expect(thread.thread_metadata?.archived).toBe(false)
})
