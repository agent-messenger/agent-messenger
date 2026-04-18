import { afterEach, describe, expect, spyOn, it } from 'bun:test'

import { InstagramListener } from '@/platforms/instagram/listener'
import type { InstagramChatSummary } from '@/platforms/instagram/types'

function makeMockClient(chats: InstagramChatSummary[] = []) {
  return {
    listChats: spyOn({ listChats: async () => chats }, 'listChats'),
    getUserId: () => '123',
  } as any
}

function makeChat(overrides: Partial<InstagramChatSummary> = {}): InstagramChatSummary {
  return {
    id: 'thread-1',
    name: 'Test',
    type: 'private',
    is_group: false,
    participant_count: 2,
    unread_count: 0,
    last_message: {
      id: 'msg-1',
      thread_id: 'thread-1',
      from: '456',
      timestamp: '2026-01-01T00:00:00.000Z',
      is_outgoing: false,
      type: 'text',
      text: 'hello',
    },
    ...overrides,
  }
}

describe('InstagramListener', () => {
  let listener: InstagramListener

  afterEach(() => {
    listener?.stop()
  })

  it('emits connected on start', async () => {
    const client = makeMockClient([makeChat()])
    listener = new InstagramListener(client, { pollInterval: 60_000 })

    const connected = new Promise<{ userId: string }>((resolve) => {
      listener.on('connected', resolve)
    })

    await listener.start()
    const result = await connected
    expect(result.userId).toBe('123')
  })

  it('emits disconnected on stop', async () => {
    const client = makeMockClient([])
    listener = new InstagramListener(client, { pollInterval: 60_000 })

    const disconnected = new Promise<void>((resolve) => {
      listener.on('disconnected', resolve)
    })

    await listener.start()
    listener.stop()
    await disconnected
  })

  it('does not emit message for initial poll', async () => {
    const client = makeMockClient([makeChat()])
    listener = new InstagramListener(client, { pollInterval: 60_000 })

    const messages: unknown[] = []
    listener.on('message', (msg) => messages.push(msg))

    await listener.start()
    await new Promise((r) => setTimeout(r, 50))

    expect(messages).toHaveLength(0)
  })

  it('multiple start calls are idempotent', async () => {
    const client = makeMockClient([])
    listener = new InstagramListener(client, { pollInterval: 60_000 })

    await listener.start()
    await listener.start()

    expect(client.listChats).toHaveBeenCalledTimes(1)
  })

  it('emits error when listChats throws', async () => {
    const client = makeMockClient()
    client.listChats.mockRejectedValueOnce(new Error('network error'))
    listener = new InstagramListener(client, { pollInterval: 60_000 })

    const errorPromise = new Promise<Error>((resolve) => {
      listener.on('error', resolve)
    })

    await listener.start()
    const err = await errorPromise
    expect(err.message).toBe('network error')
  })

  it('on/off registers and unregisters handlers', () => {
    const client = makeMockClient()
    listener = new InstagramListener(client, { pollInterval: 60_000 })

    let called = false
    const handler = () => {
      called = true
    }
    listener.on('disconnected', handler)
    listener.off('disconnected', handler)
    listener.stop()

    expect(called).toBe(false)
  })

  it('once fires handler only once', async () => {
    const client = makeMockClient([])
    listener = new InstagramListener(client, { pollInterval: 60_000 })

    let count = 0
    listener.once('connected', () => {
      count++
    })

    await listener.start()
    listener.stop()
    await listener.start()

    expect(count).toBe(1)
  })
})
