import { afterEach, beforeAll, describe, expect, it } from 'bun:test'

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
    webexAvailable = await validateWebexEnvironment()
  })

  afterEach(async () => {
    if (testMessages.length > 0) {
      await cleanupWebexMessages()
    }
    await waitForRateLimit()
  })

  describe('auth', () => {
    it('auth status returns authenticated', async () => {
      if (!webexAvailable) return

      const result = await runCLI('webex', ['auth', 'status'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ authenticated: boolean }>(result.stdout)
      expect(data?.authenticated).toBe(true)
    })
  })

  describe('message', () => {
    it('message send creates a message', async () => {
      if (!webexAvailable) return

      const testId = generateTestId()
      const result = await runCLI('webex', ['message', 'send', WEBEX_TEST_SPACE_ID, `e2e ${testId}`])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ id: string }>(result.stdout)
      expect(data?.id).toBeTruthy()

      if (data?.id) testMessages.push(data.id)
    })

    it('message list returns messages array', async () => {
      if (!webexAvailable) return

      const result = await runCLI('webex', ['message', 'list', WEBEX_TEST_SPACE_ID, '--limit', '5'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<unknown[]>(result.stdout)
      expect(Array.isArray(data)).toBe(true)
    })

    it('message get retrieves specific message', async () => {
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

    it('message delete removes message', async () => {
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

    it('message edit updates message content', async () => {
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

      const edited = parseJSON<{ id: string; text: string }>(result.stdout)
      expect(edited?.id).toBeTruthy()
      expect(edited?.text).toBe(`edited ${testId}`)
    }, 30000)

    // Regression for the silent-edit-failure bug: plain-text and markdown edits go
    // through different `buildEncryptedObject` branches, and a second edit catches
    // cases where the first edit corrupted the activity chain.
    //
    // Uses `editWithRetry` because the Webex internal conversation endpoint has
    // a tighter 429 budget than the public REST gateway, and internal requests
    // do not share the same auto-retry logic as public-API requests.
    const editWithRetry = async (args: string[]) => {
      for (let attempt = 0; attempt < 3; attempt++) {
        const r = await runCLI('webex', args)
        if (r.exitCode === 0 || !r.stderr.includes('HTTP 429')) return r
        await waitForRateLimit(5000 * (attempt + 1))
      }
      return runCLI('webex', args)
    }

    it('message edit survives second edit and markdown edit (regression for silent failure)', async () => {
      if (!webexAvailable) return

      const testId = generateTestId()
      const sendResult = await runCLI('webex', ['message', 'send', WEBEX_TEST_SPACE_ID, `regression ${testId}`])
      expect(sendResult.exitCode).toBe(0)

      const sent = parseJSON<{ id: string }>(sendResult.stdout)
      expect(sent?.id).toBeTruthy()
      if (sent?.id) testMessages.push(sent.id)

      await waitForRateLimit(3000)

      const first = await editWithRetry(['message', 'edit', sent!.id, WEBEX_TEST_SPACE_ID, `first edit ${testId}`])
      expect(first.exitCode).toBe(0)
      expect(first.stderr).not.toContain('edit_failed')
      expect(first.stderr).not.toContain('Edit rejected')

      await waitForRateLimit(3000)

      const second = await editWithRetry([
        'message',
        'edit',
        sent!.id,
        WEBEX_TEST_SPACE_ID,
        `**second edit** ${testId}`,
        '--markdown',
      ])
      expect(second.exitCode).toBe(0)
      expect(second.stderr).not.toContain('edit_failed')
      expect(second.stderr).not.toContain('Edit rejected')

      const secondData = parseJSON<{ id: string; text: string }>(second.stdout)
      expect(secondData?.id).toBeTruthy()
      expect(secondData?.text).toContain(testId)
    }, 60000)
  })

  describe('space', () => {
    it('space list returns spaces array', async () => {
      if (!webexAvailable) return

      const result = await runCLI('webex', ['space', 'list', '--limit', '5'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<unknown[]>(result.stdout)
      expect(Array.isArray(data)).toBe(true)
    })

    it('space info returns space details', async () => {
      if (!webexAvailable) return

      const result = await runCLI('webex', ['space', 'info', WEBEX_TEST_SPACE_ID])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ id: string }>(result.stdout)
      expect(data?.id).toBe(WEBEX_TEST_SPACE_ID)
    })
  })

  describe('member', () => {
    it('member list returns members array', async () => {
      if (!webexAvailable) return

      const result = await runCLI('webex', ['member', 'list', WEBEX_TEST_SPACE_ID, '--limit', '5'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<unknown[]>(result.stdout)
      expect(Array.isArray(data)).toBe(true)
    })
  })

  describe('snapshot', () => {
    it('snapshot returns spaces and members', async () => {
      if (!webexAvailable) return

      const result = await runCLI('webex', ['snapshot', '--limit', '2'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ spaces: unknown; members: unknown; recent_messages: unknown }>(result.stdout)
      expect(data?.spaces).toBeDefined()
      expect(data?.members).toBeDefined()
      expect(data?.recent_messages).toBeDefined()
    }, 30000)

    it('snapshot --spaces-only returns only spaces', async () => {
      if (!webexAvailable) return

      const result = await runCLI('webex', ['snapshot', '--spaces-only'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ spaces: unknown }>(result.stdout)
      expect(data?.spaces).toBeDefined()
    })

    it('snapshot --members-only returns only members', async () => {
      if (!webexAvailable) return

      const result = await runCLI('webex', ['snapshot', '--members-only'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ members: unknown }>(result.stdout)
      expect(data?.members).toBeDefined()
    })
  })
})
