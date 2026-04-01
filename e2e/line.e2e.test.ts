import { afterEach, beforeAll, describe, expect, test } from 'bun:test'

import { LINE_TEST_CHAT_ID, validateLineEnvironment } from './config'
import { generateTestId, parseJSON, runCLI, waitForRateLimit } from './helpers'

let lineAvailable = false

describe('LINE E2E Tests', () => {
  beforeAll(async () => {
    lineAvailable = await validateLineEnvironment()
  })

  afterEach(async () => {
    await waitForRateLimit()
  })

  describe('auth', () => {
    test('auth status returns valid auth info', async () => {
      if (!lineAvailable) return

      const result = await runCLI('line', ['auth', 'status'])
      expect(result.exitCode).toBe(0)
    })

    test('auth list returns accounts array', async () => {
      if (!lineAvailable) return

      const result = await runCLI('line', ['auth', 'list'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<unknown[]>(result.stdout)
      expect(Array.isArray(data)).toBe(true)
    })
  })

  describe('chat', () => {
    test('chat list returns chats', async () => {
      if (!lineAvailable) return

      const result = await runCLI('line', ['chat', 'list', '--limit', '5'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<unknown>(result.stdout)
      expect(data).toBeDefined()
    })
  })

  describe('friend', () => {
    test('friend list returns friends', async () => {
      if (!lineAvailable) return

      const result = await runCLI('line', ['friend', 'list'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<unknown>(result.stdout)
      expect(data).toBeDefined()
    })
  })

  describe('message', () => {
    test('message send sends a message to the test chat', async () => {
      if (!lineAvailable) return

      const testId = generateTestId()
      const result = await runCLI('line', ['message', 'send', LINE_TEST_CHAT_ID, `e2e ${testId}`])
      expect(result.exitCode).toBe(0)
    })

    test('message list returns messages from the test chat', async () => {
      if (!lineAvailable) return

      const result = await runCLI('line', ['message', 'list', LINE_TEST_CHAT_ID, '-n', '5'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<unknown>(result.stdout)
      expect(data).toBeDefined()
    })
  })

  describe('profile', () => {
    test('profile returns current user profile', async () => {
      if (!lineAvailable) return

      const result = await runCLI('line', ['profile'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<Record<string, unknown>>(result.stdout)
      expect(data).toBeDefined()
      expect(typeof data).toBe('object')
    })
  })
})
