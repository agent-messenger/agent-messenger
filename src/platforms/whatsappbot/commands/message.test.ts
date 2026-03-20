import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { existsSync, rmSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const mockSendTextMessage = mock(() =>
  Promise.resolve({
    messaging_product: 'whatsapp' as const,
    contacts: [{ input: '+15551234567', wa_id: '15551234567' }],
    messages: [{ id: 'wamid.1' }],
  }),
)

const mockSendTemplateMessage = mock(() =>
  Promise.resolve({
    messaging_product: 'whatsapp' as const,
    contacts: [{ input: '+15557654321', wa_id: '15557654321' }],
    messages: [{ id: 'wamid.2' }],
  }),
)

let capturedSendTextArgs: unknown[] = []
let capturedSendTemplateArgs: unknown[] = []

mock.module('../client', () => ({
  WhatsAppBotClient: class MockWhatsAppBotClient {
    sendTextMessage = (...args: unknown[]) => {
      capturedSendTextArgs = args
      return mockSendTextMessage()
    }
    sendTemplateMessage = (...args: unknown[]) => {
      capturedSendTemplateArgs = args
      return mockSendTemplateMessage()
    }
  },
}))

mock.module('./shared', () => ({
  getClient: async () => new (await import('../client')).WhatsAppBotClient('1234567890', 'token'),
}))

import { WhatsAppBotCredentialManager } from '../credential-manager'
import { sendAction, sendTemplateAction } from './message'

describe('message commands', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = join(tmpdir(), `whatsappbot-msg-test-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })
    capturedSendTextArgs = []
    capturedSendTemplateArgs = []
    mockSendTextMessage.mockClear()
    mockSendTemplateMessage.mockClear()
  })

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true })
    }
  })

  describe('sendAction', () => {
    test('sends text message and returns normalized fields', async () => {
      const manager = new WhatsAppBotCredentialManager(tempDir)
      const result = await sendAction('+15551234567', 'Hello world', { _credManager: manager })

      expect(result.error).toBeUndefined()
      expect(result.message_id).toBe('wamid.1')
      expect(result.wa_id).toBe('15551234567')
      expect(capturedSendTextArgs).toEqual(['+15551234567', 'Hello world'])
    })
  })

  describe('sendTemplateAction', () => {
    test('sends template message and returns normalized fields', async () => {
      const manager = new WhatsAppBotCredentialManager(tempDir)
      const result = await sendTemplateAction('+15557654321', 'hello_world', 'en_US', { _credManager: manager })

      expect(result.error).toBeUndefined()
      expect(result.message_id).toBe('wamid.2')
      expect(result.template_name).toBe('hello_world')
      expect(result.language).toBe('en_US')
      expect(capturedSendTemplateArgs).toEqual(['+15557654321', 'hello_world', 'en_US'])
    })

    test('handles client errors gracefully', async () => {
      mockSendTemplateMessage.mockImplementationOnce(() => Promise.reject(new Error('Template is not approved')))

      const manager = new WhatsAppBotCredentialManager(tempDir)
      const result = await sendTemplateAction('+15557654321', 'bad_template', 'en_US', { _credManager: manager })

      expect(result.error).toBeDefined()
      expect(result.error).toContain('Template is not approved')
    })
  })
})
