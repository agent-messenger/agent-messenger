import { afterEach, beforeAll, describe, expect, test } from 'bun:test'

import { WHATSAPP_TEST_CHAT_ID, validateWhatsAppEnvironment } from './config'
import { generateTestId, parseJSON, runCLI, waitForRateLimit } from './helpers'

let whatsappAvailable = false

describe('WhatsApp E2E Tests', () => {
  beforeAll(async () => {
    whatsappAvailable = await validateWhatsAppEnvironment()
  })

  afterEach(async () => {
    await waitForRateLimit()
  })

  describe('auth', () => {
    test('auth status returns exit code 0', async () => {
      if (!whatsappAvailable) return

      const result = await runCLI('whatsapp', ['auth', 'status'])
      expect(result.exitCode).toBe(0)
    })

    test('auth list returns accounts array', async () => {
      if (!whatsappAvailable) return

      const result = await runCLI('whatsapp', ['auth', 'list'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<unknown[]>(result.stdout)
      expect(Array.isArray(data)).toBe(true)
    })
  })

  describe('chat', () => {
    test('chat list returns chats', async () => {
      if (!whatsappAvailable) return

      const result = await runCLI('whatsapp', ['chat', 'list', '--limit', '5'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ chats: unknown[] } | unknown[]>(result.stdout)
      expect(data).toBeTruthy()
    })

    test('chat search returns results', async () => {
      if (!whatsappAvailable) return

      const result = await runCLI('whatsapp', ['chat', 'search', 'test', '--limit', '5'])
      expect(result.exitCode).toBe(0)
    })
  })

  describe('message', () => {
    test('message send delivers message to chat', async () => {
      if (!whatsappAvailable) return

      const testId = generateTestId()
      const result = await runCLI('whatsapp', ['message', 'send', WHATSAPP_TEST_CHAT_ID, `e2e ${testId}`])
      expect(result.exitCode).toBe(0)
    })

    test('message list returns messages', async () => {
      if (!whatsappAvailable) return

      const result = await runCLI('whatsapp', ['message', 'list', WHATSAPP_TEST_CHAT_ID, '--limit', '5'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ messages: unknown[] } | unknown[]>(result.stdout)
      expect(data).toBeTruthy()
    })

    test('message react adds reaction to message', async () => {
      if (!whatsappAvailable) return

      const testId = generateTestId()
      const sendResult = await runCLI('whatsapp', ['message', 'send', WHATSAPP_TEST_CHAT_ID, `react ${testId}`])
      expect(sendResult.exitCode).toBe(0)

      const sent = parseJSON<{ id: string }>(sendResult.stdout)
      expect(sent?.id).toBeTruthy()

      await waitForRateLimit()

      const result = await runCLI('whatsapp', ['message', 'react', WHATSAPP_TEST_CHAT_ID, sent!.id, '👍'])
      expect(result.exitCode).toBe(0)
    }, 15000)
  })
})
