import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const mockSendMessage = mock(() =>
  Promise.resolve({
    recipient_id: 'psid123',
    message_id: 'mid.123',
  }),
)

let capturedSendArgs: unknown[] = []

mock.module('../client', () => ({
  FBMessengerBotClient: class MockFBMessengerBotClient {
    sendMessage = (...args: unknown[]) => {
      capturedSendArgs = args
      return mockSendMessage()
    }
  },
}))

mock.module('./shared', () => ({
  getClient: async () => new (await import('../client')).FBMessengerBotClient('page123', 'token123'),
}))

import { FBMessengerBotCredentialManager } from '../credential-manager'
import { sendAction } from './message'

describe('message commands', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = join(tmpdir(), `fbmessengerbot-msg-test-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })
    capturedSendArgs = []
    mockSendMessage.mockClear()
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true })
    }
  })

  describe('sendAction', () => {
    test('sends a text message with default messaging type', async () => {
      const manager = new FBMessengerBotCredentialManager(tempDir)
      const result = await sendAction('psid123', 'Hello world', { _credManager: manager })

      expect(result.error).toBeUndefined()
      expect(result.recipient_id).toBe('psid123')
      expect(result.message_id).toBe('mid.123')
      expect(result.messaging_type).toBe('RESPONSE')
      expect(capturedSendArgs).toEqual(['psid123', 'Hello world', 'RESPONSE'])
    })

    test('passes messaging type when provided', async () => {
      const manager = new FBMessengerBotCredentialManager(tempDir)
      await sendAction('psid123', 'Hello world', { messagingType: 'UPDATE', _credManager: manager })

      expect(capturedSendArgs[2]).toBe('UPDATE')
    })

    test('returns error for invalid messaging type', async () => {
      const manager = new FBMessengerBotCredentialManager(tempDir)
      const result = await sendAction('psid123', 'Hello world', { messagingType: 'INVALID', _credManager: manager })

      expect(result.error).toContain('Invalid --messaging-type value')
      expect(mockSendMessage).not.toHaveBeenCalled()
    })
  })
})
