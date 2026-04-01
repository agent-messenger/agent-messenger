import { afterEach, beforeAll, describe, expect, test } from 'bun:test'

import { INSTAGRAM_TEST_THREAD_ID, INSTAGRAM_TEST_USERNAME, validateInstagramEnvironment } from './config'
import { generateTestId, parseJSON, runCLI, waitForRateLimit } from './helpers'

let instagramAvailable = false

describe('Instagram E2E Tests', () => {
  beforeAll(async () => {
    if (!INSTAGRAM_TEST_THREAD_ID) {
      console.warn(
        'Skipping Instagram E2E: set E2E_INSTAGRAM_THREAD_ID to run against a dedicated test thread.',
      )
      return
    }
    await validateInstagramEnvironment()
    instagramAvailable = true
  })

  afterEach(async () => {
    await waitForRateLimit()
  })

  describe('auth', () => {
    test('auth status returns exit code 0', async () => {
      if (!instagramAvailable) return

      const result = await runCLI('instagram', ['auth', 'status'])
      expect(result.exitCode).toBe(0)
    })

    test('auth list returns accounts array', async () => {
      if (!instagramAvailable) return

      const result = await runCLI('instagram', ['auth', 'list'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<unknown[]>(result.stdout)
      expect(Array.isArray(data)).toBe(true)
    })
  })

  describe('chat', () => {
    test('chat list returns chats', async () => {
      if (!instagramAvailable) return

      const result = await runCLI('instagram', ['chat', 'list', '--limit', '5'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<unknown[] | { chats: unknown[] }>(result.stdout)
      expect(data).toBeDefined()
    })

    test('chat search returns results', async () => {
      if (!instagramAvailable) return

      const result = await runCLI('instagram', ['chat', 'search', 'test', '--limit', '5'])
      expect(result.exitCode).toBe(0)
    })
  })

  describe('message', () => {
    test('message send sends a message to thread', async () => {
      if (!instagramAvailable) return

      const testId = generateTestId()
      const result = await runCLI('instagram', ['message', 'send', INSTAGRAM_TEST_THREAD_ID, `e2e ${testId}`])
      expect(result.exitCode).toBe(0)
    })

    test('message list returns messages from thread', async () => {
      if (!instagramAvailable) return

      const result = await runCLI('instagram', ['message', 'list', INSTAGRAM_TEST_THREAD_ID, '--limit', '5'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<unknown[] | { messages: unknown[] }>(result.stdout)
      expect(data).toBeDefined()
    })

    test('message send-to sends a message to username', async () => {
      if (!instagramAvailable) return
      if (!INSTAGRAM_TEST_USERNAME) return

      const testId = generateTestId()
      const result = await runCLI('instagram', ['message', 'send-to', INSTAGRAM_TEST_USERNAME, `e2e ${testId}`])
      expect(result.exitCode).toBe(0)
    })

    test('message search returns results', async () => {
      if (!instagramAvailable) return

      const result = await runCLI('instagram', ['message', 'search', 'test', '--limit', '5'])
      expect(result.exitCode).toBe(0)
    })

    test('message search-users returns results', async () => {
      if (!instagramAvailable) return

      const result = await runCLI('instagram', ['message', 'search-users', 'test'])
      expect(result.exitCode).toBe(0)
    })
  })
})
