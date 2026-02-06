import { describe, test, expect, beforeAll, afterEach } from 'bun:test'
import { runCLI, parseJSON, generateTestId, waitForRateLimit } from './helpers'
import {
  SLACKBOT_TEST_CHANNEL_ID,
  SLACKBOT_TEST_CHANNEL,
  validateSlackBotEnvironment,
} from './config'
import { SlackBotClient } from '../src/platforms/slackbot/client'
import { SlackBotCredentialManager } from '../src/platforms/slackbot/credential-manager'

let testMessages: string[] = []
let cleanupClient: SlackBotClient

async function getClient(): Promise<SlackBotClient> {
  const credManager = new SlackBotCredentialManager()
  const creds = await credManager.getCredentials()
  if (!creds) throw new Error('No slackbot credentials')
  return new SlackBotClient(creds.token)
}

async function cleanupBotMessages(channel: string, timestamps: string[]) {
  for (const ts of timestamps) {
    try {
      await cleanupClient.deleteMessage(channel, ts)
      await waitForRateLimit(500)
    } catch {
      // best-effort cleanup
    }
  }
}

describe('SlackBot E2E Tests', () => {
  beforeAll(async () => {
    await validateSlackBotEnvironment()
    cleanupClient = await getClient()

    // Bot must be in the channel to send messages
    try {
      await cleanupClient.joinChannel(SLACKBOT_TEST_CHANNEL_ID)
    } catch {
      // already in channel
    }
  })

  afterEach(async () => {
    if (testMessages.length > 0) {
      await cleanupBotMessages(SLACKBOT_TEST_CHANNEL_ID, testMessages)
      testMessages = []
    }
    await waitForRateLimit()
  })

  describe('auth', () => {
    test('auth status returns valid bot info', async () => {
      const result = await runCLI('slackbot', ['auth', 'status'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{
        valid: boolean
        workspace_id: string
        workspace_name: string
        bot_id: string
      }>(result.stdout)
      expect(data).not.toBeNull()
      expect(data?.valid).toBe(true)
      expect(data?.workspace_id).toBeTruthy()
      expect(data?.workspace_name).toBeTruthy()
      expect(data?.bot_id).toBeTruthy()
    })
  })

  describe('message', () => {
    test('message send creates message and returns ts', async () => {
      const testId = generateTestId()
      const result = await runCLI('slackbot', [
        'message', 'send', SLACKBOT_TEST_CHANNEL_ID, `Bot test ${testId}`,
      ])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ ts: string; channel: string }>(result.stdout)
      expect(data?.ts).toBeTruthy()
      expect(data?.channel).toBe(SLACKBOT_TEST_CHANNEL_ID)

      if (data?.ts) testMessages.push(data.ts)
    })

    test('message list returns messages array', async () => {
      const result = await runCLI('slackbot', [
        'message', 'list', SLACKBOT_TEST_CHANNEL_ID, '--limit', '5',
      ])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<Array<{ ts: string }>>(result.stdout)
      expect(Array.isArray(data)).toBe(true)
    })

    test('message get retrieves specific message', async () => {
      const testId = generateTestId()
      const sendResult = await runCLI('slackbot', [
        'message', 'send', SLACKBOT_TEST_CHANNEL_ID, `Get test ${testId}`,
      ])
      const sent = parseJSON<{ ts: string }>(sendResult.stdout)
      expect(sent?.ts).toBeTruthy()
      if (sent?.ts) testMessages.push(sent.ts)

      await waitForRateLimit()

      const result = await runCLI('slackbot', [
        'message', 'get', SLACKBOT_TEST_CHANNEL_ID, sent!.ts,
      ])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ text: string; ts: string }>(result.stdout)
      expect(data?.text).toContain(testId)
      expect(data?.ts).toBe(sent!.ts)
    })

    test('message update modifies message', async () => {
      const testId = generateTestId()
      const sendResult = await runCLI('slackbot', [
        'message', 'send', SLACKBOT_TEST_CHANNEL_ID, `Original ${testId}`,
      ])
      const sent = parseJSON<{ ts: string }>(sendResult.stdout)
      expect(sent?.ts).toBeTruthy()
      if (sent?.ts) testMessages.push(sent.ts)

      await waitForRateLimit()

      const result = await runCLI('slackbot', [
        'message', 'update', SLACKBOT_TEST_CHANNEL_ID, sent!.ts, `Updated ${testId}`,
      ])
      expect(result.exitCode).toBe(0)

      await waitForRateLimit()

      const getResult = await runCLI('slackbot', [
        'message', 'get', SLACKBOT_TEST_CHANNEL_ID, sent!.ts,
      ])
      const data = parseJSON<{ text: string }>(getResult.stdout)
      expect(data?.text).toContain('Updated')
    })

    test('message delete removes message', async () => {
      const testId = generateTestId()
      const sendResult = await runCLI('slackbot', [
        'message', 'send', SLACKBOT_TEST_CHANNEL_ID, `Delete me ${testId}`,
      ])
      const sent = parseJSON<{ ts: string }>(sendResult.stdout)
      expect(sent?.ts).toBeTruthy()

      await waitForRateLimit()

      const result = await runCLI('slackbot', [
        'message', 'delete', SLACKBOT_TEST_CHANNEL_ID, sent!.ts, '--force',
      ])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ deleted: string }>(result.stdout)
      expect(data?.deleted).toBe(sent!.ts)
    })

    test('message send with --thread creates reply', async () => {
      const testId = generateTestId()
      const sendResult = await runCLI('slackbot', [
        'message', 'send', SLACKBOT_TEST_CHANNEL_ID, `Parent ${testId}`,
      ])
      const parent = parseJSON<{ ts: string }>(sendResult.stdout)
      expect(parent?.ts).toBeTruthy()
      if (parent?.ts) testMessages.push(parent.ts)

      await waitForRateLimit()

      const replyResult = await runCLI('slackbot', [
        'message', 'send', SLACKBOT_TEST_CHANNEL_ID, `Reply ${testId}`,
        '--thread', parent!.ts,
      ])
      expect(replyResult.exitCode).toBe(0)

      const reply = parseJSON<{ ts: string; thread_ts: string }>(replyResult.stdout)
      expect(reply?.thread_ts).toBe(parent!.ts)

      if (reply?.ts) testMessages.push(reply.ts)
    }, 30000)

    test('message replies gets thread replies', async () => {
      const testId = generateTestId()
      const sendResult = await runCLI('slackbot', [
        'message', 'send', SLACKBOT_TEST_CHANNEL_ID, `Thread parent ${testId}`,
      ])
      const parent = parseJSON<{ ts: string }>(sendResult.stdout)
      expect(parent?.ts).toBeTruthy()
      if (parent?.ts) testMessages.push(parent.ts)

      await waitForRateLimit()

      const replyResult = await runCLI('slackbot', [
        'message', 'send', SLACKBOT_TEST_CHANNEL_ID, `Thread reply ${testId}`,
        '--thread', parent!.ts,
      ])
      expect(replyResult.exitCode).toBe(0)
      const reply = parseJSON<{ ts: string }>(replyResult.stdout)
      if (reply?.ts) testMessages.push(reply.ts)

      await waitForRateLimit()

      const result = await runCLI('slackbot', [
        'message', 'replies', SLACKBOT_TEST_CHANNEL_ID, parent!.ts,
      ])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<Array<{ ts: string }>>(result.stdout)
      expect(Array.isArray(data)).toBe(true)
      expect(data!.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('channel', () => {
    test('channel list returns channels array', async () => {
      const result = await runCLI('slackbot', ['channel', 'list', '--limit', '10'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<Array<{ id: string; name: string }>>(result.stdout)
      expect(Array.isArray(data)).toBe(true)
      expect(data!.length).toBeGreaterThan(0)
    })

    test('channel info returns channel details', async () => {
      const result = await runCLI('slackbot', ['channel', 'info', SLACKBOT_TEST_CHANNEL_ID])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ id: string; name: string }>(result.stdout)
      expect(data?.id).toBe(SLACKBOT_TEST_CHANNEL_ID)
      expect(data?.name).toBe(SLACKBOT_TEST_CHANNEL)
    })
  })

  describe('user', () => {
    test('user list returns users array', async () => {
      const result = await runCLI('slackbot', ['user', 'list', '--limit', '10'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<Array<{ id: string; name: string }>>(result.stdout)
      expect(Array.isArray(data)).toBe(true)
      expect(data!.length).toBeGreaterThan(0)
    })

    test('user info returns user details', async () => {
      // given: get the bot's own user_id via auth status
      const statusResult = await runCLI('slackbot', ['auth', 'status'])
      const status = parseJSON<{ bot_id: string; user: string }>(statusResult.stdout)
      expect(status?.user).toBeTruthy()

      await waitForRateLimit()

      // when: list users and find the bot user
      const listResult = await runCLI('slackbot', ['user', 'list', '--limit', '50'])
      const users = parseJSON<Array<{ id: string; name: string }>>(listResult.stdout)
      const botUser = users?.find((u) => u.name === status!.user)
      expect(botUser).toBeTruthy()

      await waitForRateLimit()

      // then: user info returns matching data
      const result = await runCLI('slackbot', ['user', 'info', botUser!.id])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ id: string; name: string }>(result.stdout)
      expect(data?.id).toBe(botUser!.id)
    })
  })

  describe('reaction', () => {
    test('reaction add and remove lifecycle', async () => {
      // given: a message to react to
      const testId = generateTestId()
      const sendResult = await runCLI('slackbot', [
        'message', 'send', SLACKBOT_TEST_CHANNEL_ID, `Reaction test ${testId}`,
      ])
      const sent = parseJSON<{ ts: string }>(sendResult.stdout)
      expect(sent?.ts).toBeTruthy()
      if (sent?.ts) testMessages.push(sent.ts)

      await waitForRateLimit(2000)

      // when: add reaction
      const addResult = await runCLI('slackbot', [
        'reaction', 'add', SLACKBOT_TEST_CHANNEL_ID, sent!.ts, 'thumbsup',
      ])
      expect(addResult.exitCode).toBe(0)

      const addData = parseJSON<{ success: boolean }>(addResult.stdout)
      expect(addData?.success).toBe(true)

      await waitForRateLimit(2000)

      // then: remove reaction
      const removeResult = await runCLI('slackbot', [
        'reaction', 'remove', SLACKBOT_TEST_CHANNEL_ID, sent!.ts, 'thumbsup',
      ])
      expect(removeResult.exitCode).toBe(0)

      const removeData = parseJSON<{ success: boolean }>(removeResult.stdout)
      expect(removeData?.success).toBe(true)
    }, 15000)
  })
})
