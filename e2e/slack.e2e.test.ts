import { describe, test, expect, beforeAll, afterEach } from 'bun:test'

import { WebClient } from '@slack/web-api'

import { CredentialManager } from '../src/platforms/slack/credential-manager'
import { SLACK_TEST_CHANNEL, SLACK_TEST_CHANNEL_ID, validateSlackEnvironment } from './config'
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

describe('Slack E2E Tests', () => {
  beforeAll(async () => {
    // Validate we're in the correct workspace
    await validateSlackEnvironment()
  })

  afterEach(async () => {
    if (testMessages.length > 0) {
      await cleanupMessages('slack', SLACK_TEST_CHANNEL_ID, testMessages)
      testMessages = []
    }
    await waitForRateLimit()
  })

  describe('auth', () => {
    test('auth status returns authenticated workspace info', async () => {
      const result = await runCLI('slack', ['auth', 'status'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ workspace_id: string; workspace_name: string }>(result.stdout)
      expect(data).not.toBeNull()
      expect(data?.workspace_id).toBeTruthy()
      expect(data?.workspace_name).toBeTruthy()
    })
  })

  describe('workspace', () => {
    test('workspace list returns array', async () => {
      const result = await runCLI('slack', ['workspace', 'list'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<Array<{ id: string; name: string }>>(result.stdout)
      expect(Array.isArray(data)).toBe(true)
    })

    test('workspace current returns current workspace', async () => {
      const result = await runCLI('slack', ['workspace', 'current'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ workspace_id: string }>(result.stdout)
      expect(data?.workspace_id).toBeTruthy()
    })
  })

  describe('message', () => {
    test('message send creates message and returns ts', async () => {
      const testId = generateTestId()
      const result = await runCLI('slack', ['message', 'send', SLACK_TEST_CHANNEL_ID, `Test message ${testId}`])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ ts: string }>(result.stdout)
      expect(data?.ts).toBeTruthy()

      if (data?.ts) testMessages.push(data.ts)
    })

    test('message list returns messages array', async () => {
      const result = await runCLI('slack', ['message', 'list', SLACK_TEST_CHANNEL_ID, '--limit', '5'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<Array<{ ts: string }>>(result.stdout)
      expect(Array.isArray(data)).toBe(true)
    })

    test('message get retrieves specific message', async () => {
      const testId = generateTestId()
      const { id: ts } = await createTestMessage('slack', SLACK_TEST_CHANNEL_ID, `Get test ${testId}`)
      testMessages.push(ts)

      await waitForRateLimit()

      const result = await runCLI('slack', ['message', 'get', SLACK_TEST_CHANNEL_ID, ts])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ text: string }>(result.stdout)
      expect(data?.text).toContain(testId)
    })

    test('message update modifies message', async () => {
      const testId = generateTestId()
      const { id: ts } = await createTestMessage('slack', SLACK_TEST_CHANNEL_ID, `Original ${testId}`)
      testMessages.push(ts)

      await waitForRateLimit()

      const result = await runCLI('slack', ['message', 'update', SLACK_TEST_CHANNEL_ID, ts, `Updated ${testId}`])
      expect(result.exitCode).toBe(0)

      await waitForRateLimit()
      const getResult = await runCLI('slack', ['message', 'get', SLACK_TEST_CHANNEL_ID, ts])
      const data = parseJSON<{ text: string }>(getResult.stdout)
      expect(data?.text).toContain('Updated')
    })

    test('message search finds messages', async () => {
      const result = await runCLI('slack', ['message', 'search', 'test', '--limit', '5'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<Array<{ ts: string }>>(result.stdout)
      expect(Array.isArray(data)).toBe(true)
    })

    test('message send with thread creates reply', async () => {
      const testId = generateTestId()
      const { id: parentTs } = await createTestMessage('slack', SLACK_TEST_CHANNEL_ID, `Parent ${testId}`)
      testMessages.push(parentTs)

      await waitForRateLimit()

      const result = await runCLI('slack', [
        'message',
        'send',
        SLACK_TEST_CHANNEL_ID,
        `Reply ${testId}`,
        '--thread',
        parentTs,
      ])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ ts: string; thread_ts: string }>(result.stdout)
      expect(data?.thread_ts).toBe(parentTs)

      if (data?.ts) testMessages.push(data.ts)
    }, 30000)

    test('message replies gets thread replies', async () => {
      const testId = generateTestId()
      const { id: parentTs } = await createTestMessage('slack', SLACK_TEST_CHANNEL_ID, `Thread parent ${testId}`)
      testMessages.push(parentTs)

      await waitForRateLimit()

      await runCLI('slack', ['message', 'send', SLACK_TEST_CHANNEL_ID, `Thread reply ${testId}`, '--thread', parentTs])

      await waitForRateLimit()

      const result = await runCLI('slack', ['message', 'replies', SLACK_TEST_CHANNEL_ID, parentTs])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<Array<{ ts: string }>>(result.stdout)
      expect(Array.isArray(data)).toBe(true)
      expect(data?.length).toBeGreaterThanOrEqual(1)
    })

    test('message delete removes message', async () => {
      const testId = generateTestId()
      const { id: ts } = await createTestMessage('slack', SLACK_TEST_CHANNEL_ID, `Delete me ${testId}`)

      await waitForRateLimit()

      const result = await runCLI('slack', ['message', 'delete', SLACK_TEST_CHANNEL_ID, ts, '--force'])
      expect(result.exitCode).toBe(0)
    })
  })

  describe('message files', () => {
    test('message get includes files when message has file attachment', async () => {
      // Upload file directly via Slack WebClient (bypasses CLI file upload mapping issue)
      const credManager = new CredentialManager()
      const workspace = await credManager.getWorkspace()
      const webClient = new WebClient(workspace!.token, {
        headers: { Cookie: `d=${workspace!.cookie}` },
      })
      const testId = generateTestId()
      await webClient.files.uploadV2({
        channel_id: SLACK_TEST_CHANNEL_ID,
        file: Buffer.from(`E2E file test content ${testId}`),
        filename: `e2e-test-${testId}.txt`,
      })

      await waitForRateLimit(3000)
      const listResult = await runCLI('slack', ['message', 'list', SLACK_TEST_CHANNEL_ID, '--limit', '1'])
      expect(listResult.exitCode).toBe(0)
      const messages = parseJSON<
        Array<{
          ts: string
          files?: Array<{ id: string; name: string; mimetype: string; size: number; url_private: string }>
        }>
      >(listResult.stdout)
      expect(Array.isArray(messages)).toBe(true)
      expect(messages!.length).toBeGreaterThan(0)
      const latestMessage = messages![0]
      testMessages.push(latestMessage.ts)
      expect(latestMessage.files).toBeDefined()
      expect(Array.isArray(latestMessage.files)).toBe(true)
      expect(latestMessage.files!.length).toBeGreaterThan(0)
      const file = latestMessage.files![0]
      expect(file.id).toBeTruthy()
      expect(file.name).toBeTruthy()
      expect(file.size).toBeGreaterThan(0)
      expect(file.url_private).toBeTruthy()

      await waitForRateLimit()
      // message get should also include files
      const getResult = await runCLI('slack', ['message', 'get', SLACK_TEST_CHANNEL_ID, latestMessage.ts])
      expect(getResult.exitCode).toBe(0)
      const getMessage = parseJSON<{
        ts: string
        files?: Array<{ id: string; name: string }>
      }>(getResult.stdout)
      expect(getMessage?.files).toBeDefined()
      expect(getMessage?.files!.length).toBeGreaterThan(0)
      expect(getMessage?.files![0].id).toBe(file.id)
    }, 30000)

    test('message get omits files for plain text message', async () => {
      const testId = generateTestId()
      const { id: ts } = await createTestMessage('slack', SLACK_TEST_CHANNEL_ID, `No files ${testId}`)
      testMessages.push(ts)

      await waitForRateLimit()

      const result = await runCLI('slack', ['message', 'get', SLACK_TEST_CHANNEL_ID, ts])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ ts: string; text: string; files?: unknown[] }>(result.stdout)
      expect(data?.text).toContain(testId)
      expect(data?.files).toBeUndefined()
    })
  })

  describe('channel', () => {
    test('channel list returns channels array', async () => {
      const result = await runCLI('slack', ['channel', 'list'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<Array<{ id: string; name: string }>>(result.stdout)
      expect(Array.isArray(data)).toBe(true)
      expect(data?.length).toBeGreaterThan(0)
    })

    test('channel list --type public filters channels', async () => {
      const result = await runCLI('slack', ['channel', 'list', '--type', 'public'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<Array<{ is_private: boolean }>>(result.stdout)
      expect(Array.isArray(data)).toBe(true)
    })

    test('channel info returns channel details', async () => {
      const result = await runCLI('slack', ['channel', 'info', SLACK_TEST_CHANNEL_ID])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ id: string; name: string }>(result.stdout)
      expect(data?.id).toBeTruthy()
      expect(data?.name).toBe('e2e-test')
    })
  })

  describe('user', () => {
    test('user list returns users array', async () => {
      const result = await runCLI('slack', ['user', 'list'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<Array<{ id: string }>>(result.stdout)
      expect(Array.isArray(data)).toBe(true)
    })

    test('user me returns current user', async () => {
      const result = await runCLI('slack', ['user', 'me'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ id: string; name: string }>(result.stdout)
      expect(data?.id).toBeTruthy()
      expect(data?.name).toBeTruthy()
    })

    test('user info returns user details', async () => {
      // First get current user ID
      const meResult = await runCLI('slack', ['user', 'me'])
      const me = parseJSON<{ id: string }>(meResult.stdout)
      expect(me?.id).toBeTruthy()

      await waitForRateLimit()

      // Get user info
      const result = await runCLI('slack', ['user', 'info', me!.id])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ id: string }>(result.stdout)
      expect(data?.id).toBe(me?.id)
    })
  })

  describe('reaction', () => {
    test('reaction add/list/remove lifecycle', async () => {
      const testId = generateTestId()
      const { id: ts } = await createTestMessage('slack', SLACK_TEST_CHANNEL_ID, `Reaction test ${testId}`)
      testMessages.push(ts)

      await waitForRateLimit(2000)

      const addResult = await runCLI('slack', ['reaction', 'add', SLACK_TEST_CHANNEL_ID, ts, 'thumbsup'])
      expect(addResult.exitCode).toBe(0)

      await waitForRateLimit(2000)

      const listResult = await runCLI('slack', ['reaction', 'list', SLACK_TEST_CHANNEL_ID, ts])
      expect(listResult.exitCode).toBe(0)

      const data = parseJSON<{ reactions: Array<{ name: string }> }>(listResult.stdout)
      expect(Array.isArray(data?.reactions)).toBe(true)

      await waitForRateLimit(2000)

      const removeResult = await runCLI('slack', ['reaction', 'remove', SLACK_TEST_CHANNEL_ID, ts, 'thumbsup'])
      expect(removeResult.exitCode).toBe(0)
    }, 15000)
  })

  describe('file', () => {
    test('file list returns files array', async () => {
      const result = await runCLI('slack', ['file', 'list'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<Array<{ id: string }>>(result.stdout)
      expect(Array.isArray(data)).toBe(true)
    })

    test.skip('file upload uploads file', async () => {
      const testId = generateTestId()
      const testFilePath = `/tmp/slack-e2e-${testId}.txt`
      await Bun.write(testFilePath, `E2E test file content ${testId}`)

      try {
        const result = await runCLI('slack', ['file', 'upload', SLACK_TEST_CHANNEL_ID, testFilePath])
        expect(result.exitCode).toBe(0)

        const data = parseJSON<{ id: string }>(result.stdout)
        expect(data?.id).toBeTruthy()

        if (data?.id) {
          await waitForRateLimit()
          const infoResult = await runCLI('slack', ['file', 'info', data.id])
          expect(infoResult.exitCode).toBe(0)
        }
      } finally {
        await Bun.$`rm -f ${testFilePath}`.quiet()
      }
    })

    test('file download downloads a file', async () => {
      const testId = generateTestId()
      const testContent = `E2E download test ${testId}`
      const testFilePath = `/tmp/slack-e2e-upload-${testId}.txt`
      const downloadPath = `/tmp/slack-e2e-download-${testId}.txt`
      await Bun.write(testFilePath, testContent)

      let uploadedFileId: string | undefined
      try {
        const credManager = new CredentialManager()
        const workspace = await credManager.getWorkspace()
        const webClient = new WebClient(workspace!.token, {
          headers: { Cookie: `d=${workspace!.cookie}` },
        })
        const uploadResponse = await webClient.files.uploadV2({
          channel_id: SLACK_TEST_CHANNEL_ID,
          file: Buffer.from(testContent),
          filename: `e2e-download-test-${testId}.txt`,
        })
        const uploadedFile = (uploadResponse as any).files?.[0]?.files?.[0]
        uploadedFileId = uploadedFile?.id
        expect(uploadedFileId).toBeTruthy()

        await waitForRateLimit(3000)

        const result = await runCLI('slack', ['file', 'download', uploadedFileId!, downloadPath])
        expect(result.exitCode).toBe(0)

        const data = parseJSON<{ id: string; name: string; path: string; size: number }>(result.stdout)
        expect(data?.id).toBe(uploadedFileId)
        expect(data?.path).toBe(downloadPath)
        expect(data?.size).toBeGreaterThan(0)

        const downloadedContent = await Bun.file(downloadPath).text()
        expect(downloadedContent).toBe(testContent)
      } finally {
        if (uploadedFileId) {
          const credManager = new CredentialManager()
          const workspace = await credManager.getWorkspace()
          const webClient = new WebClient(workspace!.token, {
            headers: { Cookie: `d=${workspace!.cookie}` },
          })
          await webClient.files.delete({ file: uploadedFileId }).catch(() => {})
        }
        await Bun.$`rm -f ${testFilePath} ${downloadPath}`.quiet()
      }
    }, 30000)
  })

  describe('channel history', () => {
    test('channel history returns messages', async () => {
      const result = await runCLI('slack', ['channel', 'history', SLACK_TEST_CHANNEL_ID, '--limit', '5'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<Array<{ ts: string }>>(result.stdout)
      expect(Array.isArray(data)).toBe(true)
    })
  })

  describe('unread', () => {
    test('unread counts returns unread summary', async () => {
      const result = await runCLI('slack', ['unread', 'counts'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ total_unread: number; channels: unknown[] }>(result.stdout)
      expect(data?.total_unread).toBeDefined()
      expect(Array.isArray(data?.channels)).toBe(true)
    })

    test('unread mark marks channel as read', async () => {
      const testId = generateTestId()
      const { id: ts } = await createTestMessage('slack', SLACK_TEST_CHANNEL_ID, `Unread mark test ${testId}`)
      testMessages.push(ts)

      await waitForRateLimit()

      const result = await runCLI('slack', ['unread', 'mark', SLACK_TEST_CHANNEL_ID, ts])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ marked_read: boolean }>(result.stdout)
      expect(data?.marked_read).toBe(true)
    })
  })

  describe('activity', () => {
    test('activity list returns activity items', async () => {
      const result = await runCLI('slack', ['activity', 'list', '--limit', '5'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ items: unknown[]; count: number }>(result.stdout)
      expect(data?.items).toBeDefined()
      expect(typeof data?.count).toBe('number')
    })
  })

  describe('saved', () => {
    test('saved list returns saved items', async () => {
      const result = await runCLI('slack', ['saved', 'list'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ items: unknown[] }>(result.stdout)
      expect(data?.items).toBeDefined()
      expect(Array.isArray(data?.items)).toBe(true)
    })
  })

  describe('drafts', () => {
    test('drafts list returns drafts', async () => {
      const result = await runCLI('slack', ['drafts', 'list'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<unknown[]>(result.stdout)
      expect(Array.isArray(data)).toBe(true)
    })
  })

  describe('sections', () => {
    test('sections list returns channel sections', async () => {
      const result = await runCLI('slack', ['sections', 'list'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<unknown[]>(result.stdout)
      expect(Array.isArray(data)).toBe(true)
    })
  })

  describe('snapshot', () => {
    test('snapshot returns full workspace data', async () => {
      const result = await runCLI('slack', ['snapshot', '--limit', '2'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ channels: unknown[]; users: unknown[] }>(result.stdout)
      expect(data?.channels).toBeDefined()
      expect(data?.users).toBeDefined()
    })

    test('snapshot --channels-only returns only channels', async () => {
      const result = await runCLI('slack', ['snapshot', '--channels-only'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ channels: unknown[] }>(result.stdout)
      expect(data?.channels).toBeDefined()
    })

    test('snapshot --users-only returns only users', async () => {
      const result = await runCLI('slack', ['snapshot', '--users-only'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ users: unknown[] }>(result.stdout)
      expect(data?.users).toBeDefined()
    })
  })
})
