import { beforeEach, describe, expect, mock, test } from 'bun:test'

const mockGetBotInfo = mock(() =>
  Promise.resolve({
    userId: 'Ubot123',
    displayName: 'Test Bot',
    pictureUrl: 'https://example.com/bot.png',
  }),
)

const mockPushMessage = mock(() => Promise.resolve({ sentMessages: [{ id: 'msg1', quoteToken: 'quote1' }] }))
const mockBroadcast = mock(() => Promise.resolve({ sentMessages: [{ id: 'msg2', quoteToken: 'quote2' }] }))
const mockGetProfile = mock(() =>
  Promise.resolve({
    userId: 'U123',
    displayName: 'Alice',
    pictureUrl: 'https://example.com/alice.png',
    statusMessage: 'Hello',
    language: 'en',
  }),
)
const mockGetGroupSummary = mock(() => Promise.resolve({ groupId: 'C123', groupName: 'Team Alpha' }))
const mockGetGroupMembersIds = mock(() => Promise.resolve({ userIds: ['U1', 'U2'], next: 'cursor-1' }))

class MockHTTPFetchError extends Error {
  status: number
  statusText: string
  headers: Headers
  body: string

  constructor(message: string, status: number, headers: Record<string, string> = {}, body = '') {
    super(message)
    this.name = 'HTTPFetchError'
    this.status = status
    this.statusText = 'Error'
    this.headers = new Headers(headers)
    this.body = body
  }
}

let constructedToken: string | undefined
let callLog: string[] = []

mock.module('@line/bot-sdk', () => ({
  HTTPFetchError: MockHTTPFetchError,
  messagingApi: {
    MessagingApiClient: class MockMessagingApiClient {
      constructor(config: { channelAccessToken: string }) {
        constructedToken = config.channelAccessToken
      }

      getBotInfo = async () => {
        callLog.push('getBotInfo')
        return mockGetBotInfo()
      }

      pushMessage = async (...args: unknown[]) => {
        callLog.push('pushMessage')
        return mockPushMessage(...args)
      }

      broadcast = async (...args: unknown[]) => {
        callLog.push('broadcast')
        return mockBroadcast(...args)
      }

      getProfile = async (...args: unknown[]) => {
        callLog.push('getProfile')
        return mockGetProfile(...args)
      }

      getGroupSummary = async (...args: unknown[]) => {
        callLog.push('getGroupSummary')
        return mockGetGroupSummary(...args)
      }

      getGroupMembersIds = async (...args: unknown[]) => {
        callLog.push('getGroupMembersIds')
        return mockGetGroupMembersIds(...args)
      }
    },
  },
}))

import { LineBotClient } from './client'
import { LineBotError } from './types'

describe('LineBotClient', () => {
  beforeEach(() => {
    constructedToken = undefined
    callLog = []
    mockGetBotInfo.mockReset()
    mockGetBotInfo.mockImplementation(() =>
      Promise.resolve({
        userId: 'Ubot123',
        displayName: 'Test Bot',
        pictureUrl: 'https://example.com/bot.png',
      }),
    )
    mockPushMessage.mockReset()
    mockPushMessage.mockImplementation(() => Promise.resolve({ sentMessages: [{ id: 'msg1', quoteToken: 'quote1' }] }))
    mockBroadcast.mockReset()
    mockBroadcast.mockImplementation(() => Promise.resolve({ sentMessages: [{ id: 'msg2', quoteToken: 'quote2' }] }))
    mockGetProfile.mockReset()
    mockGetProfile.mockImplementation(() =>
      Promise.resolve({
        userId: 'U123',
        displayName: 'Alice',
        pictureUrl: 'https://example.com/alice.png',
        statusMessage: 'Hello',
        language: 'en',
      }),
    )
    mockGetGroupSummary.mockReset()
    mockGetGroupSummary.mockImplementation(() => Promise.resolve({ groupId: 'C123', groupName: 'Team Alpha' }))
    mockGetGroupMembersIds.mockReset()
    mockGetGroupMembersIds.mockImplementation(() => Promise.resolve({ userIds: ['U1', 'U2'], next: 'cursor-1' }))
  })

  test('constructs sdk client with channel access token', async () => {
    const client = new LineBotClient('token-123')

    await client.getBotInfo()

    expect(constructedToken).toBe('token-123')
  })

  test('getBotInfo returns parsed bot info', async () => {
    const client = new LineBotClient('token-123')
    const botInfo = await client.getBotInfo()

    expect(botInfo.userId).toBe('Ubot123')
    expect(botInfo.displayName).toBe('Test Bot')
  })

  test('pushMessage sends text messages through sdk', async () => {
    const client = new LineBotClient('token-123')
    const result = await client.pushMessage('U123', [{ type: 'text', text: 'Hello' }])

    expect(result.sentMessages?.[0]?.id).toBe('msg1')
    expect(mockPushMessage).toHaveBeenCalledWith({
      to: 'U123',
      messages: [{ type: 'text', text: 'Hello' }],
    })
  })

  test('broadcast sends text messages through sdk', async () => {
    const client = new LineBotClient('token-123')
    const result = await client.broadcast([{ type: 'text', text: 'Broadcast' }])

    expect(result.sentMessages?.[0]?.id).toBe('msg2')
    expect(mockBroadcast).toHaveBeenCalledWith({
      messages: [{ type: 'text', text: 'Broadcast' }],
    })
  })

  test('getProfile returns parsed profile', async () => {
    const client = new LineBotClient('token-123')
    const profile = await client.getProfile('U123')

    expect(profile.displayName).toBe('Alice')
    expect(mockGetProfile).toHaveBeenCalledWith('U123')
  })

  test('getGroupSummary returns parsed group summary', async () => {
    const client = new LineBotClient('token-123')
    const group = await client.getGroupSummary('C123')

    expect(group.groupId).toBe('C123')
    expect(group.groupName).toBe('Team Alpha')
  })

  test('getGroupMembersIds returns parsed member ids', async () => {
    const client = new LineBotClient('token-123')
    const members = await client.getGroupMembersIds('C123', 'cursor-1')

    expect(members.userIds).toEqual(['U1', 'U2'])
    expect(mockGetGroupMembersIds).toHaveBeenCalledWith('C123', 'cursor-1')
  })

  test('429 retries with Retry-After wait', async () => {
    mockGetBotInfo.mockImplementationOnce(() => {
      throw new MockHTTPFetchError('Rate limited', 429, { 'Retry-After': '0.05' }, '{"message":"Rate limited"}')
    })

    const client = new LineBotClient('token-123')
    const start = Date.now()
    const result = await client.getBotInfo()
    const elapsed = Date.now() - start

    expect(result.userId).toBe('Ubot123')
    expect(mockGetBotInfo).toHaveBeenCalledTimes(2)
    expect(elapsed).toBeGreaterThanOrEqual(40)
  })

  test('500 retries with exponential backoff', async () => {
    mockGetProfile
      .mockImplementationOnce(() => {
        throw new MockHTTPFetchError('Server error', 500, {}, '{"message":"Server error"}')
      })
      .mockImplementationOnce(() => {
        throw new MockHTTPFetchError('Server error', 500, {}, '{"message":"Server error"}')
      })

    const client = new LineBotClient('token-123')
    const start = Date.now()
    const result = await client.getProfile('U123')
    const elapsed = Date.now() - start

    expect(result.userId).toBe('U123')
    expect(mockGetProfile).toHaveBeenCalledTimes(3)
    expect(elapsed).toBeGreaterThanOrEqual(280)
  })

  test('4xx non-429 throws LineBotError immediately', async () => {
    mockGetBotInfo.mockImplementationOnce(() => {
      throw new MockHTTPFetchError('Forbidden', 403, {}, '{"message":"Forbidden"}')
    })

    const client = new LineBotClient('token-123')

    await expect(client.getBotInfo()).rejects.toThrow(LineBotError)
    expect(mockGetBotInfo).toHaveBeenCalledTimes(1)
  })

  test('throws when more than five messages are sent', async () => {
    const client = new LineBotClient('token-123')

    await expect(
      client.pushMessage(
        'U123',
        Array.from({ length: 6 }, (_, index) => ({ type: 'text' as const, text: `msg-${index}` })),
      ),
    ).rejects.toThrow(LineBotError)
  })
})
