import { expect, test } from 'bun:test'

import {
  WebexConfigSchema,
  WebexError,
  WebexMembershipSchema,
  WebexMessageSchema,
  WebexPersonSchema,
  WebexSpaceSchema,
} from './types'

test('WebexSpaceSchema validates valid space', () => {
  const result = WebexSpaceSchema.safeParse({
    id: 'Y2lzY29zcGFyazovL3VzL1JPT00vYWJj',
    title: 'Project Alpha',
    type: 'group',
    isLocked: false,
    lastActivity: '2024-01-15T10:30:00.000Z',
    created: '2024-01-01T00:00:00.000Z',
    creatorId: 'Y2lzY29zcGFyazovL3VzL1BFT1BMRS9hYmM',
  })
  expect(result.success).toBe(true)
})

test('WebexSpaceSchema validates space with optional teamId', () => {
  const result = WebexSpaceSchema.safeParse({
    id: 'Y2lzY29zcGFyazovL3VzL1JPT00vYWJj',
    title: 'Project Alpha',
    type: 'group',
    isLocked: true,
    teamId: 'Y2lzY29zcGFyazovL3VzL1RFQU0vdGVhbQ',
    lastActivity: '2024-01-15T10:30:00.000Z',
    created: '2024-01-01T00:00:00.000Z',
    creatorId: 'Y2lzY29zcGFyazovL3VzL1BFT1BMRS9hYmM',
  })
  expect(result.success).toBe(true)
})

test('WebexSpaceSchema validates direct space type', () => {
  const result = WebexSpaceSchema.safeParse({
    id: 'Y2lzY29zcGFyazovL3VzL1JPT00vZGlyZWN0',
    title: 'Direct Message',
    type: 'direct',
    isLocked: false,
    lastActivity: '2024-01-15T10:30:00.000Z',
    created: '2024-01-01T00:00:00.000Z',
    creatorId: 'Y2lzY29zcGFyazovL3VzL1BFT1BMRS9hYmM',
  })
  expect(result.success).toBe(true)
})

test('WebexSpaceSchema rejects missing required fields', () => {
  const result = WebexSpaceSchema.safeParse({
    id: 'Y2lzY29zcGFyazovL3VzL1JPT00vYWJj',
    title: 'Project Alpha',
  })
  expect(result.success).toBe(false)
})

test('WebexSpaceSchema rejects invalid type', () => {
  const result = WebexSpaceSchema.safeParse({
    id: 'Y2lzY29zcGFyazovL3VzL1JPT00vYWJj',
    title: 'Project Alpha',
    type: 'channel',
    isLocked: false,
    lastActivity: '2024-01-15T10:30:00.000Z',
    created: '2024-01-01T00:00:00.000Z',
    creatorId: 'Y2lzY29zcGFyazovL3VzL1BFT1BMRS9hYmM',
  })
  expect(result.success).toBe(false)
})

test('WebexMessageSchema validates valid message', () => {
  const result = WebexMessageSchema.safeParse({
    id: 'Y2lzY29zcGFyazovL3VzL01FU1NBR0UvbXNn',
    roomId: 'Y2lzY29zcGFyazovL3VzL1JPT00vYWJj',
    roomType: 'group',
    text: 'Hello world',
    personId: 'Y2lzY29zcGFyazovL3VzL1BFT1BMRS9hYmM',
    personEmail: 'user@example.com',
    created: '2024-01-15T10:30:00.000Z',
  })
  expect(result.success).toBe(true)
})

test('WebexMessageSchema validates message with optional fields', () => {
  const result = WebexMessageSchema.safeParse({
    id: 'Y2lzY29zcGFyazovL3VzL01FU1NBR0UvbXNn',
    roomId: 'Y2lzY29zcGFyazovL3VzL1JPT00vYWJj',
    roomType: 'group',
    text: 'Hello world',
    markdown: '**Hello world**',
    html: '<strong>Hello world</strong>',
    files: ['https://webexapis.com/v1/contents/file1'],
    personId: 'Y2lzY29zcGFyazovL3VzL1BFT1BMRS9hYmM',
    personEmail: 'user@example.com',
    created: '2024-01-15T10:30:00.000Z',
    parentId: 'Y2lzY29zcGFyazovL3VzL01FU1NBR0UvcGFyZW50',
    mentionedPeople: ['Y2lzY29zcGFyazovL3VzL1BFT1BMRS9tZW50aW9u'],
  })
  expect(result.success).toBe(true)
})

test('WebexMessageSchema rejects missing required fields', () => {
  const result = WebexMessageSchema.safeParse({
    id: 'Y2lzY29zcGFyazovL3VzL01FU1NBR0UvbXNn',
    roomId: 'Y2lzY29zcGFyazovL3VzL1JPT00vYWJj',
    text: 'Hello world',
  })
  expect(result.success).toBe(false)
})

test('WebexMessageSchema rejects invalid roomType', () => {
  const result = WebexMessageSchema.safeParse({
    id: 'Y2lzY29zcGFyazovL3VzL01FU1NBR0UvbXNn',
    roomId: 'Y2lzY29zcGFyazovL3VzL1JPT00vYWJj',
    roomType: 'team',
    personId: 'Y2lzY29zcGFyazovL3VzL1BFT1BMRS9hYmM',
    personEmail: 'user@example.com',
    created: '2024-01-15T10:30:00.000Z',
  })
  expect(result.success).toBe(false)
})

test('WebexPersonSchema validates valid person', () => {
  const result = WebexPersonSchema.safeParse({
    id: 'Y2lzY29zcGFyazovL3VzL1BFT1BMRS9hYmM',
    emails: ['user@example.com'],
    displayName: 'Test User',
    orgId: 'Y2lzY29zcGFyazovL3VzL09SR0FOSVpBVElPTi9vcmc',
    type: 'person',
    created: '2024-01-01T00:00:00.000Z',
  })
  expect(result.success).toBe(true)
})

test('WebexPersonSchema validates person with optional fields', () => {
  const result = WebexPersonSchema.safeParse({
    id: 'Y2lzY29zcGFyazovL3VzL1BFT1BMRS9hYmM',
    emails: ['user@example.com', 'user@work.com'],
    displayName: 'Test User',
    nickName: 'Tester',
    firstName: 'Test',
    lastName: 'User',
    avatar: 'https://example.com/avatar.jpg',
    orgId: 'Y2lzY29zcGFyazovL3VzL09SR0FOSVpBVElPTi9vcmc',
    type: 'person',
    created: '2024-01-01T00:00:00.000Z',
  })
  expect(result.success).toBe(true)
})

test('WebexPersonSchema validates bot type', () => {
  const result = WebexPersonSchema.safeParse({
    id: 'Y2lzY29zcGFyazovL3VzL1BFT1BMRS9ib3Q',
    emails: ['bot@webex.bot'],
    displayName: 'My Bot',
    orgId: 'Y2lzY29zcGFyazovL3VzL09SR0FOSVpBVElPTi9vcmc',
    type: 'bot',
    created: '2024-01-01T00:00:00.000Z',
  })
  expect(result.success).toBe(true)
})

test('WebexPersonSchema rejects missing required fields', () => {
  const result = WebexPersonSchema.safeParse({
    id: 'Y2lzY29zcGFyazovL3VzL1BFT1BMRS9hYmM',
    displayName: 'Test User',
  })
  expect(result.success).toBe(false)
})

test('WebexPersonSchema rejects invalid type', () => {
  const result = WebexPersonSchema.safeParse({
    id: 'Y2lzY29zcGFyazovL3VzL1BFT1BMRS9hYmM',
    emails: ['user@example.com'],
    displayName: 'Test User',
    orgId: 'Y2lzY29zcGFyazovL3VzL09SR0FOSVpBVElPTi9vcmc',
    type: 'admin',
    created: '2024-01-01T00:00:00.000Z',
  })
  expect(result.success).toBe(false)
})

test('WebexMembershipSchema validates valid membership', () => {
  const result = WebexMembershipSchema.safeParse({
    id: 'Y2lzY29zcGFyazovL3VzL01FTUJFUlNISVAvbWVt',
    roomId: 'Y2lzY29zcGFyazovL3VzL1JPT00vYWJj',
    personId: 'Y2lzY29zcGFyazovL3VzL1BFT1BMRS9hYmM',
    personEmail: 'user@example.com',
    personDisplayName: 'Test User',
    isModerator: false,
    created: '2024-01-01T00:00:00.000Z',
  })
  expect(result.success).toBe(true)
})

test('WebexMembershipSchema validates moderator membership', () => {
  const result = WebexMembershipSchema.safeParse({
    id: 'Y2lzY29zcGFyazovL3VzL01FTUJFUlNISVAvbWVt',
    roomId: 'Y2lzY29zcGFyazovL3VzL1JPT00vYWJj',
    personId: 'Y2lzY29zcGFyazovL3VzL1BFT1BMRS9hYmM',
    personEmail: 'moderator@example.com',
    personDisplayName: 'Moderator User',
    isModerator: true,
    created: '2024-01-01T00:00:00.000Z',
  })
  expect(result.success).toBe(true)
})

test('WebexMembershipSchema rejects missing required fields', () => {
  const result = WebexMembershipSchema.safeParse({
    id: 'Y2lzY29zcGFyazovL3VzL01FTUJFUlNISVAvbWVt',
    roomId: 'Y2lzY29zcGFyazovL3VzL1JPT00vYWJj',
  })
  expect(result.success).toBe(false)
})

test('WebexConfigSchema validates valid OAuth config', () => {
  const result = WebexConfigSchema.safeParse({
    accessToken: 'test',
    refreshToken: 'test',
    expiresAt: 1234567890,
  })
  expect(result.success).toBe(true)
})

test('WebexConfigSchema validates config with clientId and clientSecret', () => {
  const result = WebexConfigSchema.safeParse({
    accessToken: 'test',
    refreshToken: 'test',
    expiresAt: 1234567890,
    clientId: 'C123abc',
    clientSecret: 'secret456',
  })
  expect(result.success).toBe(true)
  if (result.success) {
    expect(result.data.clientId).toBe('C123abc')
    expect(result.data.clientSecret).toBe('secret456')
  }
})

test('WebexConfigSchema validates config with tokenType oauth', () => {
  const result = WebexConfigSchema.safeParse({
    accessToken: 'test',
    refreshToken: 'test',
    expiresAt: 1234567890,
    tokenType: 'oauth',
  })
  expect(result.success).toBe(true)
  if (result.success) {
    expect(result.data.tokenType).toBe('oauth')
  }
})

test('WebexConfigSchema validates config with tokenType manual', () => {
  const result = WebexConfigSchema.safeParse({
    accessToken: 'test',
    refreshToken: '',
    expiresAt: 0,
    tokenType: 'manual',
  })
  expect(result.success).toBe(true)
  if (result.success) {
    expect(result.data.tokenType).toBe('manual')
  }
})

test('WebexConfigSchema rejects invalid tokenType', () => {
  const result = WebexConfigSchema.safeParse({
    accessToken: 'test',
    refreshToken: 'test',
    expiresAt: 1234567890,
    tokenType: 'invalid',
  })
  expect(result.success).toBe(false)
})

test('WebexConfigSchema accepts config without clientId/clientSecret (backward compat)', () => {
  const result = WebexConfigSchema.safeParse({
    accessToken: 'test',
    refreshToken: 'test',
    expiresAt: 1234567890,
  })
  expect(result.success).toBe(true)
  if (result.success) {
    expect(result.data.clientId).toBeUndefined()
    expect(result.data.clientSecret).toBeUndefined()
  }
})

test('WebexConfigSchema rejects missing fields', () => {
  const result = WebexConfigSchema.safeParse({})
  expect(result.success).toBe(false)
})

test('WebexError has correct name and code', () => {
  const error = new WebexError('Not found', 'NOT_FOUND')
  expect(error.name).toBe('WebexError')
  expect(error.message).toBe('Not found')
  expect(error.code).toBe('NOT_FOUND')
})

test('WebexError is instance of Error', () => {
  const error = new WebexError('Unauthorized', 'UNAUTHORIZED')
  expect(error instanceof Error).toBe(true)
})
