import { describe, expect, mock, test } from 'bun:test'

const mockSendMessage = mock(() =>
  Promise.resolve({
    recipient_id: 'user1',
    message_id: 'mid1',
  }),
)

let capturedSendArgs: unknown[] = []

mock.module('../client', () => ({
  InstagramBotClient: class MockInstagramBotClient {
    sendMessage = (...args: unknown[]) => {
      capturedSendArgs = args
      return mockSendMessage()
    }
  },
}))

mock.module('./shared', () => ({
  getClient: async () => new (await import('../client')).InstagramBotClient('page', 'token'),
}))

import { sendAction } from './message'

describe('message commands', () => {
  test('sends a message to instagram scoped user id', async () => {
    capturedSendArgs = []
    mockSendMessage.mockClear()

    const result = await sendAction('user1', 'Hello world', {})

    expect(result.error).toBeUndefined()
    expect(result.recipient_id).toBe('user1')
    expect(result.message_id).toBe('mid1')
    expect(capturedSendArgs).toEqual(['user1', 'Hello world'])
  })

  test('returns client errors as error result', async () => {
    mockSendMessage.mockImplementationOnce(() => Promise.reject(new Error('24-hour window expired')))

    const result = await sendAction('user1', 'Hello world', {})

    expect(result.error).toBe('24-hour window expired')
  })
})
