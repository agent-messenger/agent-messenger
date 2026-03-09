import { describe, test, expect, beforeAll, afterEach } from 'bun:test'

import { DISCORD_TEST_CHANNEL_ID, DISCORD_TEST_SERVER_ID, validateDiscordEnvironment } from './config'
import {
  runCLI,
  parseJSON,
  generateTestId,
  createTestMessage,
  deleteTestMessage,
  waitForRateLimit,
  cleanupMessages,
} from './helpers'

// Track messages created during tests for cleanup
let testMessages: string[] = []

describe('Discord E2E Tests', () => {
  beforeAll(async () => {
    await validateDiscordEnvironment()
  })

  afterEach(async () => {
    if (testMessages.length > 0) {
      await cleanupMessages('discord', DISCORD_TEST_CHANNEL_ID, testMessages)
      testMessages = []
    }
    await waitForRateLimit()
  })

  describe('auth', () => {
    test('auth status returns authenticated status', async () => {
      const result = await runCLI('discord', ['auth', 'status'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ authenticated: boolean }>(result.stdout)
      expect(data?.authenticated).toBe(true)
    })
  })

  describe('server', () => {
    test('server list returns array', async () => {
      const result = await runCLI('discord', ['server', 'list'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<Array<{ server_id: string }>>(result.stdout)
      expect(Array.isArray(data)).toBe(true)
    })

    test('server current returns current server', async () => {
      const result = await runCLI('discord', ['server', 'current'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ server_id: string }>(result.stdout)
      expect(data?.server_id).toBe(DISCORD_TEST_SERVER_ID)
    })

    test('server info returns server details', async () => {
      const result = await runCLI('discord', ['server', 'info', DISCORD_TEST_SERVER_ID])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ id: string }>(result.stdout)
      expect(data?.id).toBeTruthy()
    })
  })

  describe('message', () => {
    test('message send creates message', async () => {
      const testId = generateTestId()
      const result = await runCLI('discord', ['message', 'send', DISCORD_TEST_CHANNEL_ID, `Test message ${testId}`])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ id: string }>(result.stdout)
      expect(data?.id).toBeTruthy()

      if (data?.id) testMessages.push(data.id)
    })

    test('message list returns messages array', async () => {
      const result = await runCLI('discord', ['message', 'list', DISCORD_TEST_CHANNEL_ID, '--limit', '5'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<Array<{ id: string }>>(result.stdout)
      expect(Array.isArray(data)).toBe(true)
    })

    test.skip('message get retrieves specific message (requires bot token)', async () => {
      const testId = generateTestId()
      const { id } = await createTestMessage('discord', DISCORD_TEST_CHANNEL_ID, `Get test ${testId}`)
      testMessages.push(id)

      await waitForRateLimit()

      const result = await runCLI('discord', ['message', 'get', DISCORD_TEST_CHANNEL_ID, id])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ content: string }>(result.stdout)
      expect(data?.content).toContain(testId)
    })

    test('message delete removes message', async () => {
      const testId = generateTestId()
      const { id } = await createTestMessage('discord', DISCORD_TEST_CHANNEL_ID, `Delete me ${testId}`)

      await waitForRateLimit()

      const result = await runCLI('discord', ['message', 'delete', DISCORD_TEST_CHANNEL_ID, id, '--force'])
      expect(result.exitCode).toBe(0)
    })

    test('message ack acknowledges message', async () => {
      const testId = generateTestId()
      const { id } = await createTestMessage('discord', DISCORD_TEST_CHANNEL_ID, `Ack test ${testId}`)
      testMessages.push(id)

      await waitForRateLimit()

      const result = await runCLI('discord', ['message', 'ack', DISCORD_TEST_CHANNEL_ID, id])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ acknowledged: string }>(result.stdout)
      expect(data?.acknowledged).toBe(id)
    })

    test('message search finds messages', async () => {
      const result = await runCLI('discord', ['message', 'search', 'test', '--limit', '5'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ results: unknown[]; total_results: number }>(result.stdout)
      expect(data?.results).toBeDefined()
      expect(typeof data?.total_results).toBe('number')
    })
  })

  describe('channel', () => {
    test('channel list returns channels array', async () => {
      const result = await runCLI('discord', ['channel', 'list'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<Array<{ id: string }>>(result.stdout)
      expect(Array.isArray(data)).toBe(true)
    })

    test('channel info returns channel details', async () => {
      const result = await runCLI('discord', ['channel', 'info', DISCORD_TEST_CHANNEL_ID])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ id: string }>(result.stdout)
      expect(data?.id).toBe(DISCORD_TEST_CHANNEL_ID)
    })

    test('channel history returns messages', async () => {
      const result = await runCLI('discord', ['channel', 'history', DISCORD_TEST_CHANNEL_ID, '--limit', '5'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<Array<{ id: string }>>(result.stdout)
      expect(Array.isArray(data)).toBe(true)
    })
  })

  describe('user', () => {
    test.skip('user list returns users array (requires bot token)', async () => {
      const result = await runCLI('discord', ['user', 'list'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<Array<{ id: string }>>(result.stdout)
      expect(Array.isArray(data)).toBe(true)
    })

    test('user me returns current user', async () => {
      const result = await runCLI('discord', ['user', 'me'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ id: string; username: string }>(result.stdout)
      expect(data?.id).toBeTruthy()
      expect(data?.username).toBeTruthy()
    })

    test('user info returns user details', async () => {
      // First get current user ID
      const meResult = await runCLI('discord', ['user', 'me'])
      expect(meResult.exitCode).toBe(0)

      const me = parseJSON<{ id: string }>(meResult.stdout)
      expect(me?.id).toBeTruthy()

      await waitForRateLimit()

      const result = await runCLI('discord', ['user', 'info', me!.id])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ id: string }>(result.stdout)
      expect(data?.id).toBe(me?.id)
    })
  })

  describe('reaction', () => {
    test.skip('reaction add/list/remove lifecycle (requires bot token)', async () => {
      const testId = generateTestId()
      const { id } = await createTestMessage('discord', DISCORD_TEST_CHANNEL_ID, `Reaction test ${testId}`)
      testMessages.push(id)

      await waitForRateLimit()

      // Add reaction (using emoji name without colons)
      const addResult = await runCLI('discord', ['reaction', 'add', DISCORD_TEST_CHANNEL_ID, id, '👍'])
      expect(addResult.exitCode).toBe(0)

      await waitForRateLimit()

      // List reactions
      const listResult = await runCLI('discord', ['reaction', 'list', DISCORD_TEST_CHANNEL_ID, id])
      expect(listResult.exitCode).toBe(0)

      await waitForRateLimit()

      // Remove reaction
      const removeResult = await runCLI('discord', ['reaction', 'remove', DISCORD_TEST_CHANNEL_ID, id, '👍'])
      expect(removeResult.exitCode).toBe(0)
    }, 15000) // Longer timeout for multiple operations
  })

  describe('file', () => {
    test('file list returns files array', async () => {
      const result = await runCLI('discord', ['file', 'list', DISCORD_TEST_CHANNEL_ID])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<Array<{ id: string }>>(result.stdout)
      expect(Array.isArray(data)).toBe(true)
    })

    test('file upload uploads file and file info retrieves it', async () => {
      const testId = generateTestId()
      const testFilePath = `/tmp/discord-e2e-${testId}.txt`
      await Bun.write(testFilePath, `Discord E2E test file ${testId}`)

      try {
        const result = await runCLI('discord', ['file', 'upload', DISCORD_TEST_CHANNEL_ID, testFilePath])
        expect(result.exitCode).toBe(0)

        const data = parseJSON<{ id: string; attachments?: Array<{ id: string }> }>(result.stdout)
        expect(data?.id).toBeTruthy()

        // Track message for cleanup (file uploads create messages)
        if (data?.id) testMessages.push(data.id)

        // Test file info using the attachment from the uploaded message
        if (data?.attachments?.[0]?.id) {
          await waitForRateLimit()
          const infoResult = await runCLI('discord', ['file', 'info', DISCORD_TEST_CHANNEL_ID, data.attachments[0].id])
          expect(infoResult.exitCode).toBe(0)
        }
      } finally {
        await Bun.$`rm -f ${testFilePath}`.quiet()
      }
    })

    test('file info retrieves file details', async () => {
      // List files first to get a file ID
      const listResult = await runCLI('discord', ['file', 'list', DISCORD_TEST_CHANNEL_ID])
      expect(listResult.exitCode).toBe(0)

      const files = parseJSON<Array<{ id: string }>>(listResult.stdout)
      if (files && files.length > 0) {
        await waitForRateLimit()

        const result = await runCLI('discord', ['file', 'info', DISCORD_TEST_CHANNEL_ID, files[0].id])
        expect(result.exitCode).toBe(0)

        const data = parseJSON<{ id: string }>(result.stdout)
        expect(data?.id).toBeTruthy()
      }
    })
  })

  describe('snapshot', () => {
    test.skip('snapshot returns full server data (requires bot token)', async () => {
      const result = await runCLI('discord', ['snapshot', '--limit', '2'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ channels: unknown[]; users: unknown[] }>(result.stdout)
      expect(data?.channels).toBeDefined()
      expect(data?.users).toBeDefined()
    })

    test('snapshot --channels-only returns only channels', async () => {
      const result = await runCLI('discord', ['snapshot', '--channels-only'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ channels: unknown[] }>(result.stdout)
      expect(data?.channels).toBeDefined()
    })

    test.skip('snapshot --users-only returns only users (requires bot token)', async () => {
      const result = await runCLI('discord', ['snapshot', '--users-only'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ users: unknown[] }>(result.stdout)
      expect(data?.users).toBeDefined()
    })
  })
})
