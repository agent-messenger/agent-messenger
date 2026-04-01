import { afterEach, beforeAll, describe, expect, test } from 'bun:test'

import { WEBEX_TEST_SPACE_ID, WEBEX_TEST_DM_EMAIL, validateWebexEnvironment } from './config'
import { generateTestId, parseJSON, runCLI, waitForRateLimit } from './helpers'

let webexAvailable = false
let testMessages: string[] = []

async function cleanupWebexMessages() {
  for (const id of testMessages) {
    try {
      await runCLI('webex', ['message', 'delete', id, '--force'])
      await waitForRateLimit(500)
    } catch {
      // best-effort cleanup
    }
  }
  testMessages = []
}

describe('Webex E2E Tests', () => {
  beforeAll(async () => {
    if (!WEBEX_TEST_SPACE_ID) {
      console.warn(
        'Skipping Webex E2E: set E2E_WEBEX_SPACE_ID to run against a dedicated test space.',
      )
      return
    }
    await validateWebexEnvironment()
    webexAvailable = true
  })

  afterEach(async () => {
    if (testMessages.length > 0) {
      await cleanupWebexMessages()
    }
    await waitForRateLimit()
  })

  describe('auth', () => {
    test('auth status returns authenticated', async () => {
      if (!webexAvailable) return

      const result = await runCLI('webex', ['auth', 'status'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ authenticated: boolean }>(result.stdout)
      expect(data?.authenticated).toBe(true)
    })
  })

  describe('message', () => {
    test('message send creates a message', async () => {
      if (!webexAvailable) return

      const testId = generateTestId()
      const result = await runCLI('webex', ['message', 'send', WEBEX_TEST_SPACE_ID, `e2e ${testId}`])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ id: string }>(result.stdout)
      expect(data?.id).toBeTruthy()

      if (data?.id) testMessages.push(data.id)
    })

    test('message list returns messages array', async () => {
      if (!webexAvailable) return

      const result = await runCLI('webex', ['message', 'list', WEBEX_TEST_SPACE_ID, '--limit', '5'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<unknown[]>(result.stdout)
      expect(Array.isArray(data)).toBe(true)
    })

    test('message get retrieves specific message', async () => {
      if (!webexAvailable) return

      const testId = generateTestId()
      const sendResult = await runCLI('webex', ['message', 'send', WEBEX_TEST_SPACE_ID, `get test ${testId}`])
      expect(sendResult.exitCode).toBe(0)

      const sent = parseJSON<{ id: string }>(sendResult.stdout)
      expect(sent?.id).toBeTruthy()
      if (sent?.id) testMessages.push(sent.id)

      await waitForRateLimit()

      const result = await runCLI('webex', ['message', 'get', sent!.id])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ id: string; text: string }>(result.stdout)
      expect(data?.text).toContain(testId)
    }, 30000)

    test('message delete removes message', async () => {
      if (!webexAvailable) return

      const testId = generateTestId()
      const sendResult = await runCLI('webex', ['message', 'send', WEBEX_TEST_SPACE_ID, `delete me ${testId}`])
      expect(sendResult.exitCode).toBe(0)

      const sent = parseJSON<{ id: string }>(sendResult.stdout)
      expect(sent?.id).toBeTruthy()

      await waitForRateLimit()

      const result = await runCLI('webex', ['message', 'delete', sent!.id, '--force'])
      expect(result.exitCode).toBe(0)
    }, 30000)

    test('message edit updates message content', async () => {
      if (!webexAvailable) return

      const testId = generateTestId()
      const sendResult = await runCLI('webex', ['message', 'send', WEBEX_TEST_SPACE_ID, `edit me ${testId}`])
      expect(sendResult.exitCode).toBe(0)

      const sent = parseJSON<{ id: string }>(sendResult.stdout)
      expect(sent?.id).toBeTruthy()
      if (sent?.id) testMessages.push(sent.id)

      await waitForRateLimit()

      const result = await runCLI('webex', ['message', 'edit', sent!.id, WEBEX_TEST_SPACE_ID, `edited ${testId}`])
      expect(result.exitCode).toBe(0)
    }, 30000)
  })

  describe('space', () => {
    test('space list returns spaces array', async () => {
      if (!webexAvailable) return

      const result = await runCLI('webex', ['space', 'list', '--limit', '5'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<unknown[]>(result.stdout)
      expect(Array.isArray(data)).toBe(true)
    })

    test('space info returns space details', async () => {
      if (!webexAvailable) return

      const result = await runCLI('webex', ['space', 'info', WEBEX_TEST_SPACE_ID])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ id: string }>(result.stdout)
      expect(data?.id).toBe(WEBEX_TEST_SPACE_ID)
    })
  })

  describe('member', () => {
    test('member list returns members array', async () => {
      if (!webexAvailable) return

      const result = await runCLI('webex', ['member', 'list', WEBEX_TEST_SPACE_ID, '--limit', '5'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<unknown[]>(result.stdout)
      expect(Array.isArray(data)).toBe(true)
    })
  })

  describe('snapshot', () => {
    test('snapshot returns spaces and members', async () => {
      if (!webexAvailable) return

      const result = await runCLI('webex', ['snapshot', '--limit', '2'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ spaces: unknown; members: unknown }>(result.stdout)
      expect(data?.spaces).toBeDefined()
      expect(data?.members).toBeDefined()
    }, 30000)

    test('snapshot --spaces-only returns only spaces', async () => {
      if (!webexAvailable) return

      const result = await runCLI('webex', ['snapshot', '--spaces-only'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ spaces: unknown }>(result.stdout)
      expect(data?.spaces).toBeDefined()
    })

    test('snapshot --members-only returns only members', async () => {
      if (!webexAvailable) return

      const result = await runCLI('webex', ['snapshot', '--members-only'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ members: unknown }>(result.stdout)
      expect(data?.members).toBeDefined()
    })
  })
})
