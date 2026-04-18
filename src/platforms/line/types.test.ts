import { describe, it, expect } from 'bun:test'

import {
  LineError,
  LineChatSchema,
  LineMessageSchema,
  LineSendResultSchema,
  LineAccountCredentialsSchema,
} from './types'

describe('LineError', () => {
  it('has correct name and code', () => {
    const error = new LineError('AUTH_FAILED', 'Authentication failed')
    expect(error.name).toBe('LineError')
    expect(error.code).toBe('AUTH_FAILED')
    expect(error.message).toBe('Authentication failed')
    expect(error).toBeInstanceOf(Error)
  })
})

describe('LineChatSchema', () => {
  it('parses valid data', () => {
    const data = {
      chat_id: 'u1234567890abcdef',
      type: 'user',
      display_name: 'Test User',
    }
    const result = LineChatSchema.parse(data)
    expect(result.chat_id).toBe('u1234567890abcdef')
    expect(result.type).toBe('user')
    expect(result.display_name).toBe('Test User')
  })

  it('parses valid data with optional fields', () => {
    const data = {
      chat_id: 'g1234567890abcdef',
      type: 'group',
      display_name: 'Test Group',
      member_count: 10,
      picture_url: 'https://example.com/pic.jpg',
    }
    const result = LineChatSchema.parse(data)
    expect(result.member_count).toBe(10)
    expect(result.picture_url).toBe('https://example.com/pic.jpg')
  })

  it('rejects invalid type', () => {
    const data = {
      chat_id: 'u1234',
      type: 'invalid',
      display_name: 'Test',
    }
    expect(() => LineChatSchema.parse(data)).toThrow()
  })

  it('rejects missing required fields', () => {
    expect(() => LineChatSchema.parse({ chat_id: 'u1234' })).toThrow()
  })
})

describe('LineMessageSchema', () => {
  it('parses valid data', () => {
    const data = {
      message_id: 'msg123',
      chat_id: 'u1234567890abcdef',
      author_id: 'u9876543210fedcba',
      text: 'Hello, World!',
      content_type: 'NONE',
      sent_at: '2026-03-29T00:00:00.000Z',
    }
    const result = LineMessageSchema.parse(data)
    expect(result.message_id).toBe('msg123')
    expect(result.text).toBe('Hello, World!')
    expect(result.content_type).toBe('NONE')
  })

  it('parses message with null text', () => {
    const data = {
      message_id: 'msg456',
      chat_id: 'u1234567890abcdef',
      author_id: 'u9876543210fedcba',
      text: null,
      content_type: 'IMAGE',
      sent_at: '2026-03-29T00:00:00.000Z',
    }
    const result = LineMessageSchema.parse(data)
    expect(result.text).toBeNull()
  })

  it('rejects missing required fields', () => {
    expect(() => LineMessageSchema.parse({ message_id: 'msg123' })).toThrow()
  })
})

describe('LineSendResultSchema', () => {
  it('parses valid data', () => {
    const data = {
      success: true,
      chat_id: 'u1234567890abcdef',
      message_id: 'msg789',
      sent_at: '2026-03-29T00:00:00.000Z',
    }
    const result = LineSendResultSchema.parse(data)
    expect(result.success).toBe(true)
    expect(result.message_id).toBe('msg789')
  })

  it('rejects invalid success type', () => {
    const data = {
      success: 'yes',
      chat_id: 'u1234',
      message_id: 'msg789',
      sent_at: '2026-03-29T00:00:00.000Z',
    }
    expect(() => LineSendResultSchema.parse(data)).toThrow()
  })
})

describe('LineAccountCredentialsSchema', () => {
  it('parses valid data', () => {
    const data = {
      account_id: 'u1234567890abcdef1234567890abcdef12',
      auth_token: 'token_abc123',
      device: 'ANDROID',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-03-29T00:00:00.000Z',
    }
    const result = LineAccountCredentialsSchema.parse(data)
    expect(result.account_id).toBe('u1234567890abcdef1234567890abcdef12')
    expect(result.device).toBe('ANDROID')
  })

  it('parses valid data with optional fields', () => {
    const data = {
      account_id: 'u1234567890abcdef1234567890abcdef12',
      auth_token: 'token_abc123',
      certificate: 'cert_xyz',
      device: 'IOS',
      display_name: 'Test User',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-03-29T00:00:00.000Z',
    }
    const result = LineAccountCredentialsSchema.parse(data)
    expect(result.certificate).toBe('cert_xyz')
    expect(result.display_name).toBe('Test User')
  })

  it('rejects invalid device type', () => {
    const data = {
      account_id: 'u1234',
      auth_token: 'token',
      device: 'WINDOWS',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-03-29T00:00:00.000Z',
    }
    expect(() => LineAccountCredentialsSchema.parse(data)).toThrow()
  })
})
