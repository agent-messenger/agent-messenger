import { describe, expect, mock, test } from 'bun:test'

const mockPushMessage = mock(() => Promise.resolve({ sentMessages: [{ id: 'msg1', quoteToken: 'quote1' }] }))
const mockBroadcast = mock(() => Promise.resolve({ sentMessages: [{ id: 'msg2', quoteToken: 'quote2' }] }))

let capturedPushArgs: unknown[] = []
let capturedBroadcastArgs: unknown[] = []

mock.module('./shared', () => ({
  getClient: async () => ({
    pushMessage: (...args: unknown[]) => {
      capturedPushArgs = args
      return mockPushMessage(...args)
    },
    broadcast: (...args: unknown[]) => {
      capturedBroadcastArgs = args
      return mockBroadcast(...args)
    },
  }),
}))

import { broadcastAction, sendAction } from './message'

describe('linebot message commands', () => {
  test('sendAction pushes a single text message', async () => {
    const result = await sendAction('U123', 'Hello LINE', {})

    expect(result.error).toBeUndefined()
    expect(result.success).toBe(true)
    expect(result.to).toBe('U123')
    expect(result.message_count).toBe(1)
    expect(capturedPushArgs).toEqual(['U123', [{ type: 'text', text: 'Hello LINE' }]])
  })

  test('broadcastAction broadcasts a single text message', async () => {
    const result = await broadcastAction('Hello everyone', {})

    expect(result.error).toBeUndefined()
    expect(result.success).toBe(true)
    expect(result.message_count).toBe(1)
    expect(capturedBroadcastArgs).toEqual([[{ type: 'text', text: 'Hello everyone' }]])
  })

  test('maps sent message metadata into output', async () => {
    const result = await sendAction('U123', 'Hello LINE', {})

    expect(result.sent_messages?.[0]).toEqual({ id: 'msg1', quote_token: 'quote1' })
  })

  test('returns error object when push fails', async () => {
    mockPushMessage.mockImplementationOnce(() => Promise.reject(new Error('Push failed')))

    const result = await sendAction('U123', 'Hello LINE', {})

    expect(result.error).toContain('Push failed')
  })
})
