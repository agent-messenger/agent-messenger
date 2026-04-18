import { afterEach, beforeAll, describe, expect, it } from 'bun:test'

import { INSTAGRAM_TEST_THREAD_ID, INSTAGRAM_TEST_USERNAME, validateInstagramEnvironment } from './config'
import { generateTestId, parseJSON, runCLI, waitForRateLimit } from './helpers'

let instagramAvailable = false

describe('Instagram E2E Tests', () => {
  beforeAll(async () => {
    instagramAvailable = await validateInstagramEnvironment()
  })

  afterEach(async () => {
    await waitForRateLimit()
  })

  describe('auth', () => {
    it('auth status returns exit code 0', async () => {
      if (!instagramAvailable) return

      const result = await runCLI('instagram', ['auth', 'status'])
      expect(result.exitCode).toBe(0)
    })

    it('auth list returns accounts array', async () => {
      if (!instagramAvailable) return

      const result = await runCLI('instagram', ['auth', 'list'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<unknown[]>(result.stdout)
      expect(Array.isArray(data)).toBe(true)
    })
  })

  describe('chat', () => {
    it('chat list returns chats', async () => {
      if (!instagramAvailable) return

      const result = await runCLI('instagram', ['chat', 'list', '--limit', '5'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<unknown[] | { chats: unknown[] }>(result.stdout)
      expect(data).toBeDefined()
    })

    it('chat search returns results', async () => {
      if (!instagramAvailable) return

      const result = await runCLI('instagram', ['chat', 'search', 'test', '--limit', '5'])
      expect(result.exitCode).toBe(0)
    })
  })

  describe('message', () => {
    it('message send sends a message to thread', async () => {
      if (!instagramAvailable) return

      const testId = generateTestId()
      const result = await runCLI('instagram', ['message', 'send', INSTAGRAM_TEST_THREAD_ID, `e2e ${testId}`])
      expect(result.exitCode).toBe(0)
    })

    it('message list returns messages from thread', async () => {
      if (!instagramAvailable) return

      const result = await runCLI('instagram', ['message', 'list', INSTAGRAM_TEST_THREAD_ID, '--limit', '5'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<unknown[] | { messages: unknown[] }>(result.stdout)
      expect(data).toBeDefined()
    })

    it('message send-to sends a message to username', async () => {
      if (!instagramAvailable) return
      if (!INSTAGRAM_TEST_USERNAME) return

      const testId = generateTestId()
      const result = await runCLI('instagram', ['message', 'send-to', INSTAGRAM_TEST_USERNAME, `e2e ${testId}`])
      expect(result.exitCode).toBe(0)
    })

    it('message search returns results', async () => {
      if (!instagramAvailable) return

      const result = await runCLI('instagram', ['message', 'search', 'test', '--limit', '5'])
      expect(result.exitCode).toBe(0)
    })

    it('message search-users returns results', async () => {
      if (!instagramAvailable) return

      const result = await runCLI('instagram', ['message', 'search-users', 'test'])
      expect(result.exitCode).toBe(0)
    })
  })
})
