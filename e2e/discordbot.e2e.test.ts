import { describe, test, expect, beforeAll, afterEach } from 'bun:test'

import { DiscordBotClient } from '../src/platforms/discordbot/client'
import { DiscordBotCredentialManager } from '../src/platforms/discordbot/credential-manager'
import {
  DISCORDBOT_TEST_SERVER_ID,
  DISCORDBOT_TEST_CHANNEL_ID,
  DISCORDBOT_TEST_CHANNEL,
  validateDiscordBotEnvironment,
} from './config'
import { runCLI, parseJSON, generateTestId, waitForRateLimit } from './helpers'

interface TrackedMessage {
  id: string
  channelId: string
}

let testMessages: TrackedMessage[] = []
let cleanupClient: DiscordBotClient

async function getClient(): Promise<DiscordBotClient> {
  const credManager = new DiscordBotCredentialManager()
  const creds = await credManager.getCredentials()
  if (!creds) throw new Error('No discordbot credentials')
  return new DiscordBotClient(creds.token)
}

async function cleanupBotMessages(messages: TrackedMessage[]) {
  for (const msg of messages) {
    try {
      await cleanupClient.deleteMessage(msg.channelId, msg.id)
      await waitForRateLimit(500)
    } catch {
      // best-effort cleanup
    }
  }
}

function trackMessage(id: string, channelId: string = DISCORDBOT_TEST_CHANNEL_ID) {
  testMessages.push({ id, channelId })
}

describe('DiscordBot E2E Tests', () => {
  beforeAll(async () => {
    await validateDiscordBotEnvironment()
    cleanupClient = await getClient()
  })

  afterEach(async () => {
    if (testMessages.length > 0) {
      await cleanupBotMessages(testMessages)
      testMessages = []
    }
    await waitForRateLimit()
  })

  describe('auth', () => {
    test('auth status returns valid bot info', async () => {
      const result = await runCLI('discordbot', ['auth', 'status'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{
        valid: boolean
        bot_id: string
        bot_name: string
      }>(result.stdout)
      expect(data).not.toBeNull()
      expect(data?.valid).toBe(true)
      expect(data?.bot_id).toBeTruthy()
      expect(data?.bot_name).toBeTruthy()
    })
  })

  describe('message', () => {
    test('message send creates message and returns id', async () => {
      const testId = generateTestId()
      const result = await runCLI('discordbot', ['message', 'send', DISCORDBOT_TEST_CHANNEL_ID, `Bot test ${testId}`])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ id: string; channel_id: string }>(result.stdout)
      expect(data?.id).toBeTruthy()
      expect(data?.channel_id).toBe(DISCORDBOT_TEST_CHANNEL_ID)

      if (data?.id) trackMessage(data.id)
    })

    test('message list returns messages array', async () => {
      const result = await runCLI('discordbot', ['message', 'list', DISCORDBOT_TEST_CHANNEL_ID, '--limit', '5'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ messages: Array<{ id: string }> }>(result.stdout)
      expect(Array.isArray(data?.messages)).toBe(true)
    })

    test('message get retrieves specific message', async () => {
      const testId = generateTestId()
      const sendResult = await runCLI('discordbot', [
        'message',
        'send',
        DISCORDBOT_TEST_CHANNEL_ID,
        `Get test ${testId}`,
      ])
      const sent = parseJSON<{ id: string }>(sendResult.stdout)
      expect(sent?.id).toBeTruthy()
      if (sent?.id) trackMessage(sent.id)

      await waitForRateLimit()

      const result = await runCLI('discordbot', ['message', 'get', DISCORDBOT_TEST_CHANNEL_ID, sent!.id])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ content: string; id: string }>(result.stdout)
      expect(data?.content).toContain(testId)
      expect(data?.id).toBe(sent!.id)
    })

    test('message update modifies message', async () => {
      const testId = generateTestId()
      const sendResult = await runCLI('discordbot', [
        'message',
        'send',
        DISCORDBOT_TEST_CHANNEL_ID,
        `Original ${testId}`,
      ])
      const sent = parseJSON<{ id: string }>(sendResult.stdout)
      expect(sent?.id).toBeTruthy()
      if (sent?.id) trackMessage(sent.id)

      await waitForRateLimit()

      const result = await runCLI('discordbot', [
        'message',
        'update',
        DISCORDBOT_TEST_CHANNEL_ID,
        sent!.id,
        `Updated ${testId}`,
      ])
      expect(result.exitCode).toBe(0)

      await waitForRateLimit()

      const getResult = await runCLI('discordbot', ['message', 'get', DISCORDBOT_TEST_CHANNEL_ID, sent!.id])
      const data = parseJSON<{ content: string }>(getResult.stdout)
      expect(data?.content).toContain('Updated')
    })

    test('message delete removes message', async () => {
      const testId = generateTestId()
      const sendResult = await runCLI('discordbot', [
        'message',
        'send',
        DISCORDBOT_TEST_CHANNEL_ID,
        `Delete me ${testId}`,
      ])
      const sent = parseJSON<{ id: string }>(sendResult.stdout)
      expect(sent?.id).toBeTruthy()

      await waitForRateLimit()

      const result = await runCLI('discordbot', ['message', 'delete', DISCORDBOT_TEST_CHANNEL_ID, sent!.id, '--force'])
      expect(result.exitCode).toBe(0)
    })

    test('message send with --thread creates reply', async () => {
      const testId = generateTestId()
      const sendResult = await runCLI('discordbot', ['message', 'send', DISCORDBOT_TEST_CHANNEL_ID, `Parent ${testId}`])
      const parent = parseJSON<{ id: string }>(sendResult.stdout)
      expect(parent?.id).toBeTruthy()
      if (parent?.id) trackMessage(parent.id)

      await waitForRateLimit()

      const replyResult = await runCLI('discordbot', [
        'message',
        'send',
        DISCORDBOT_TEST_CHANNEL_ID,
        `Reply ${testId}`,
        '--thread',
        parent!.id,
      ])
      expect(replyResult.exitCode).toBe(0)

      const reply = parseJSON<{ id: string; thread_id: string }>(replyResult.stdout)
      expect(reply?.id).toBeTruthy()

      const replyChannel = reply?.thread_id || DISCORDBOT_TEST_CHANNEL_ID
      if (reply?.id) trackMessage(reply.id, replyChannel)
    }, 30000)

    test('message replies gets thread messages', async () => {
      const testId = generateTestId()

      // given: create a real thread channel
      const threadResult = await runCLI('discordbot', [
        'thread',
        'create',
        DISCORDBOT_TEST_CHANNEL_ID,
        `Thread ${testId}`,
      ])
      expect(threadResult.exitCode).toBe(0)
      const thread = parseJSON<{ thread: { id: string } }>(threadResult.stdout)
      expect(thread?.thread?.id).toBeTruthy()
      const threadId = thread!.thread.id

      await waitForRateLimit()

      // when: send a message to the thread
      const sendResult = await runCLI('discordbot', ['message', 'send', threadId, `Reply in thread ${testId}`])
      expect(sendResult.exitCode).toBe(0)
      const threadMsg = parseJSON<{ id: string }>(sendResult.stdout)
      if (threadMsg?.id) trackMessage(threadMsg.id, threadId)

      await waitForRateLimit()

      // then: replies returns messages from the thread
      const result = await runCLI('discordbot', ['message', 'replies', DISCORDBOT_TEST_CHANNEL_ID, threadId])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ messages: Array<{ id: string }> }>(result.stdout)
      expect(Array.isArray(data?.messages)).toBe(true)
      expect(data!.messages.length).toBeGreaterThanOrEqual(1)

      // cleanup: archive the thread
      await runCLI('discordbot', ['thread', 'archive', threadId])
    })
  })

  describe('channel', () => {
    test('channel list returns channels array', async () => {
      const result = await runCLI('discordbot', ['channel', 'list'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ channels: Array<{ id: string; name: string }> }>(result.stdout)
      expect(Array.isArray(data?.channels)).toBe(true)
      expect(data!.channels.length).toBeGreaterThan(0)
    })

    test('channel info returns channel details', async () => {
      const result = await runCLI('discordbot', ['channel', 'info', DISCORDBOT_TEST_CHANNEL_ID])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ id: string; name: string }>(result.stdout)
      expect(data?.id).toBe(DISCORDBOT_TEST_CHANNEL_ID)
      expect(data?.name).toBe(DISCORDBOT_TEST_CHANNEL)
    })
  })

  describe('user', () => {
    test('user list returns users array', async () => {
      const result = await runCLI('discordbot', ['user', 'list'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ users: Array<{ id: string; username: string }> }>(result.stdout)
      expect(Array.isArray(data?.users)).toBe(true)
      expect(data!.users.length).toBeGreaterThan(0)
    })

    test('user info returns user details', async () => {
      // given: get the bot's own user_id via auth status
      const statusResult = await runCLI('discordbot', ['auth', 'status'])
      const status = parseJSON<{ bot_id: string }>(statusResult.stdout)
      expect(status?.bot_id).toBeTruthy()

      await waitForRateLimit()

      // then: user info returns matching data
      const result = await runCLI('discordbot', ['user', 'info', status!.bot_id])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ id: string; username: string }>(result.stdout)
      expect(data?.id).toBe(status!.bot_id)
    })
  })

  describe('reaction', () => {
    test('reaction add and remove lifecycle', async () => {
      // given: a message to react to
      const testId = generateTestId()
      const sendResult = await runCLI('discordbot', [
        'message',
        'send',
        DISCORDBOT_TEST_CHANNEL_ID,
        `Reaction test ${testId}`,
      ])
      const sent = parseJSON<{ id: string }>(sendResult.stdout)
      expect(sent?.id).toBeTruthy()
      if (sent?.id) trackMessage(sent.id)

      await waitForRateLimit(2000)

      // when: add reaction
      const addResult = await runCLI('discordbot', ['reaction', 'add', DISCORDBOT_TEST_CHANNEL_ID, sent!.id, '👍'])
      expect(addResult.exitCode).toBe(0)

      const addData = parseJSON<{ success: boolean }>(addResult.stdout)
      expect(addData?.success).toBe(true)

      await waitForRateLimit(2000)

      // then: remove reaction
      const removeResult = await runCLI('discordbot', [
        'reaction',
        'remove',
        DISCORDBOT_TEST_CHANNEL_ID,
        sent!.id,
        '👍',
      ])
      expect(removeResult.exitCode).toBe(0)

      const removeData = parseJSON<{ success: boolean }>(removeResult.stdout)
      expect(removeData?.success).toBe(true)
    }, 15000)
  })

  describe('server', () => {
    test('server list returns servers array', async () => {
      const result = await runCLI('discordbot', ['server', 'list'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ servers: Array<{ id: string; name: string }> }>(result.stdout)
      expect(Array.isArray(data?.servers)).toBe(true)
      expect(data!.servers.length).toBeGreaterThan(0)
    })

    test('server current returns current server', async () => {
      const result = await runCLI('discordbot', ['server', 'current'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ id: string; name: string }>(result.stdout)
      expect(data?.id).toBe(DISCORDBOT_TEST_SERVER_ID)
    })
  })
})
