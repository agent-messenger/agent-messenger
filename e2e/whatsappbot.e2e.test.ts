import { afterEach, beforeAll, describe, expect, test } from 'bun:test'

import { WHATSAPPBOT_TEST_PHONE_NUMBER, validateWhatsAppBotEnvironment } from './config'
import { generateTestId, parseJSON, runCLI, waitForRateLimit } from './helpers'

let whatsappbotAvailable = false

describe('WhatsApp Bot E2E Tests', () => {
  beforeAll(async () => {
    whatsappbotAvailable = await validateWhatsAppBotEnvironment()
  })

  afterEach(async () => {
    await waitForRateLimit()
  })

  describe('auth', () => {
    test('auth status returns valid credentials', async () => {
      if (!whatsappbotAvailable) return

      const result = await runCLI('whatsappbot', ['auth', 'status'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ valid: boolean }>(result.stdout)
      expect(data?.valid).toBe(true)
    })

    test('auth list returns accounts array', async () => {
      if (!whatsappbotAvailable) return

      const result = await runCLI('whatsappbot', ['auth', 'list'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<unknown[]>(result.stdout)
      expect(Array.isArray(data)).toBe(true)
    })
  })

  describe('message', () => {
    test('message send delivers to test phone number', async () => {
      if (!whatsappbotAvailable) return

      const testId = generateTestId()
      const result = await runCLI('whatsappbot', ['message', 'send', WHATSAPPBOT_TEST_PHONE_NUMBER, `e2e ${testId}`])
      expect(result.exitCode).toBe(0)
    })
  })

  describe('template', () => {
    test('template list returns templates', async () => {
      if (!whatsappbotAvailable) return

      const result = await runCLI('whatsappbot', ['template', 'list', '--limit', '5'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<unknown>(result.stdout)
      expect(data).toBeDefined()
    })

    test('template get returns template details', async () => {
      if (!whatsappbotAvailable) return

      const listResult = await runCLI('whatsappbot', ['template', 'list', '--limit', '1'])
      expect(listResult.exitCode).toBe(0)

      const listData = parseJSON<Array<{ name: string }>>(listResult.stdout)
      if (!Array.isArray(listData) || listData.length === 0) return

      await waitForRateLimit()

      const result = await runCLI('whatsappbot', ['template', 'get', listData[0].name])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ name: string }>(result.stdout)
      expect(data?.name).toBe(listData[0].name)
    }, 30000)
  })
})
