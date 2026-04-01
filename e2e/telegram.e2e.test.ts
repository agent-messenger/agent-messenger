import { afterEach, beforeAll, describe, expect, test } from 'bun:test'

import { TELEGRAM_TEST_CHAT_ID, validateTelegramEnvironment } from './config'
import { generateTestId, parseJSON, runCLI, waitForRateLimit } from './helpers'

let telegramAvailable = false

describe('Telegram E2E Tests', () => {
  beforeAll(async () => {
    if (!TELEGRAM_TEST_CHAT_ID) {
      console.warn(
        'Skipping Telegram E2E: set E2E_TELEGRAM_CHAT_ID to run against a dedicated test chat.',
      )
      return
    }
    await validateTelegramEnvironment()
    telegramAvailable = true
  })

  afterEach(async () => {
    await waitForRateLimit()
  })

  describe('auth', () => {
    test('auth status returns exit code 0', async () => {
      if (!telegramAvailable) return

      const result = await runCLI('telegram', ['auth', 'status'])
      expect(result.exitCode).toBe(0)
    })

    test('auth list returns accounts array', async () => {
      if (!telegramAvailable) return

      const result = await runCLI('telegram', ['auth', 'list'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<unknown[]>(result.stdout)
      expect(Array.isArray(data)).toBe(true)
    })
  })

  describe('chat', () => {
    test('chat list returns chats', async () => {
      if (!telegramAvailable) return

      const result = await runCLI('telegram', ['chat', 'list', '--limit', '5'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ chats: unknown[] } | unknown[]>(result.stdout)
      expect(data).toBeTruthy()
    })

    test('chat search returns results', async () => {
      if (!telegramAvailable) return

      const result = await runCLI('telegram', ['chat', 'search', 'test', '--limit', '5'])
      expect(result.exitCode).toBe(0)
    })

    test('chat get returns chat with id', async () => {
      if (!telegramAvailable) return

      const result = await runCLI('telegram', ['chat', 'get', TELEGRAM_TEST_CHAT_ID])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ id: string | number }>(result.stdout)
      expect(data?.id).toBeTruthy()
    })
  })

  describe('message', () => {
    test('message send delivers message to chat', async () => {
      if (!telegramAvailable) return

      const testId = generateTestId()
      const result = await runCLI('telegram', ['message', 'send', TELEGRAM_TEST_CHAT_ID, `e2e ${testId}`])
      expect(result.exitCode).toBe(0)
    })

    test('message list returns messages', async () => {
      if (!telegramAvailable) return

      const result = await runCLI('telegram', ['message', 'list', TELEGRAM_TEST_CHAT_ID, '--limit', '5'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ messages: unknown[] } | unknown[]>(result.stdout)
      expect(data).toBeTruthy()
    })
  })
})
