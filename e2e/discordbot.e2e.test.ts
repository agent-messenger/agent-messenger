import { describe, it, expect, beforeAll, afterEach } from 'bun:test'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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
let testThreads: string[] = []
let cleanupClient: DiscordBotClient

async function getClient(): Promise<DiscordBotClient> {
  const credManager = new DiscordBotCredentialManager()
  const creds = await credManager.getCredentials()
  if (!creds) throw new Error('No discordbot credentials')
  return new DiscordBotClient().login({ token: creds.token })
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

async function cleanupBotThreads(threads: string[]) {
  for (const threadId of threads) {
    try {
      await cleanupClient.archiveThread(threadId)
      await waitForRateLimit(500)
    } catch {
      // best-effort cleanup
    }
  }
}

function trackMessage(id: string, channelId: string = DISCORDBOT_TEST_CHANNEL_ID) {
  testMessages.push({ id, channelId })
}

function trackThread(id: string) {
  testThreads.push(id)
}

function untrackThread(id: string) {
  testThreads = testThreads.filter((threadId) => threadId !== id)
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
    if (testThreads.length > 0) {
      await cleanupBotThreads(testThreads)
      testThreads = []
    }
    await waitForRateLimit()
  })

  describe('auth', () => {
    it('auth status returns valid bot info', async () => {
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
    it('message send creates message and returns id', async () => {
      const testId = generateTestId()
      const result = await runCLI('discordbot', ['message', 'send', DISCORDBOT_TEST_CHANNEL_ID, `Bot test ${testId}`])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ id: string; channel_id: string }>(result.stdout)
      expect(data?.id).toBeTruthy()
      expect(data?.channel_id).toBe(DISCORDBOT_TEST_CHANNEL_ID)

      if (data?.id) trackMessage(data.id)
    })

    it('message list returns messages array', async () => {
      const result = await runCLI('discordbot', ['message', 'list', DISCORDBOT_TEST_CHANNEL_ID, '--limit', '5'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ messages: Array<{ id: string }> }>(result.stdout)
      expect(Array.isArray(data?.messages)).toBe(true)
    })

    it('message get retrieves specific message', async () => {
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

    it('message edit modifies message', async () => {
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
        'edit',
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

    it('message delete removes message', async () => {
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

    it('message send with --thread creates reply in the thread', async () => {
      const testId = generateTestId()
      const threadResult = await runCLI('discordbot', [
        'thread',
        'create',
        DISCORDBOT_TEST_CHANNEL_ID,
        `E2E Thread ${testId}`,
      ])
      expect(threadResult.exitCode).toBe(0)

      const thread = parseJSON<{ thread: { id: string } }>(threadResult.stdout)
      expect(thread?.thread?.id).toBeTruthy()
      const threadId = thread!.thread.id
      trackThread(threadId)

      await waitForRateLimit()

      const replyResult = await runCLI('discordbot', [
        'message',
        'send',
        DISCORDBOT_TEST_CHANNEL_ID,
        `Reply ${testId}`,
        '--thread',
        threadId,
      ])
      expect(replyResult.exitCode).toBe(0)

      const reply = parseJSON<{ id: string; channel_id: string }>(replyResult.stdout)
      expect(reply?.id).toBeTruthy()
      expect(reply?.channel_id).toBe(threadId)
      if (reply?.id) trackMessage(reply.id, threadId)
    }, 30000)

    it('message replies gets thread messages', async () => {
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
      trackThread(threadId)

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
      untrackThread(threadId)
    })
  })

  describe('file', () => {
    it('uploads a file into a thread and round-trips its metadata', async () => {
      const testId = generateTestId()
      const filePath = join(tmpdir(), `e2e-${testId}.txt`)
      await Bun.write(filePath, testId)

      try {
        const threadResult = await runCLI('discordbot', [
          'thread',
          'create',
          DISCORDBOT_TEST_CHANNEL_ID,
          `E2E Thread ${testId}`,
        ])
        expect(threadResult.exitCode).toBe(0)
        const thread = parseJSON<{ thread: { id: string } }>(threadResult.stdout)
        expect(thread?.thread?.id).toBeTruthy()
        const threadId = thread!.thread.id
        trackThread(threadId)

        await waitForRateLimit()

        const uploadResult = await runCLI('discordbot', [
          'file',
          'upload',
          DISCORDBOT_TEST_CHANNEL_ID,
          filePath,
          '--text',
          `File ${testId}`,
          '--thread',
          threadId,
        ])
        expect(uploadResult.exitCode).toBe(0)
        const upload = parseJSON<{
          channel_id: string
          message_id: string
          file: { id: string; filename: string }
          files: Array<{ filename: string }>
        }>(uploadResult.stdout)
        expect(upload?.channel_id).toBe(threadId)
        expect(upload?.message_id).toBeTruthy()
        expect(upload?.file?.filename).toBe(`e2e-${testId}.txt`)
        expect(upload?.files).toHaveLength(1)
        trackMessage(upload!.message_id, threadId)

        await waitForRateLimit()

        const messageResult = await runCLI('discordbot', ['message', 'get', threadId, upload!.message_id])
        expect(messageResult.exitCode).toBe(0)
        const message = parseJSON<{
          channel_id: string
          content: string
          attachments: Array<{ id: string; filename: string; size: number }>
        }>(messageResult.stdout)
        expect(message?.channel_id).toBe(threadId)
        expect(message?.content).toBe(`File ${testId}`)
        expect(message?.attachments).toHaveLength(1)
        expect(message!.attachments[0].filename).toBe(`e2e-${testId}.txt`)
        expect(message!.attachments[0].size).toBe(Buffer.byteLength(testId))

        await waitForRateLimit()

        const namedResult = await runCLI('discordbot', [
          'message',
          'send',
          DISCORDBOT_TEST_CHANNEL_ID,
          `Reply ${testId}`,
          '--thread',
          `E2E Thread ${testId}`,
        ])
        expect(namedResult.exitCode).toBe(0)
        const named = parseJSON<{ id: string; channel_id: string }>(namedResult.stdout)
        expect(named?.channel_id).toBe(threadId)
        if (named?.id) trackMessage(named.id, threadId)

        await waitForRateLimit()

        const missingNameResult = await runCLI('discordbot', [
          'message',
          'send',
          DISCORDBOT_TEST_CHANNEL_ID,
          'x',
          '--thread',
          `no-such-thread-${testId}`,
        ])
        expect(missingNameResult.exitCode).toBe(1)
        const missingName = parseJSON<{ error: string }>(missingNameResult.stdout)
        expect(missingName?.error).toContain('thread list')
        expect(missingNameResult.stderr).toBe('')

        await waitForRateLimit()

        const activeListResult = await runCLI('discordbot', ['thread', 'list', DISCORDBOT_TEST_CHANNEL_ID])
        expect(activeListResult.exitCode).toBe(0)
        const activeList = parseJSON<{
          threads: Array<{ id: string; parent_id?: string; archived?: boolean }>
        }>(activeListResult.stdout)
        expect(
          activeList?.threads?.some(
            (item) => item.id === threadId && item.parent_id === DISCORDBOT_TEST_CHANNEL_ID && item.archived === false,
          ),
        ).toBe(true)

        await waitForRateLimit()

        const infoResult = await runCLI('discordbot', ['file', 'info', threadId, upload!.file.id])
        expect(infoResult.exitCode).toBe(0)
        const info = parseJSON<{ id: string; filename: string }>(infoResult.stdout)
        expect(info?.id).toBe(upload!.file.id)
        expect(info?.filename).toBe(`e2e-${testId}.txt`)

        const missingInfoResult = await runCLI('discordbot', [
          'file',
          'info',
          DISCORDBOT_TEST_CHANNEL_ID,
          '000000000000000000',
        ])
        expect(missingInfoResult.exitCode).toBe(0)
        const missingInfo = parseJSON<{ error: string }>(missingInfoResult.stdout)
        expect(missingInfo?.error).toContain('File not found')

        await waitForRateLimit()

        const parentMessagesResult = await runCLI('discordbot', [
          'message',
          'list',
          DISCORDBOT_TEST_CHANNEL_ID,
          '--limit',
          '5',
        ])
        expect(parentMessagesResult.exitCode).toBe(0)
        const parentMessages = parseJSON<{ messages: Array<{ content: string }> }>(parentMessagesResult.stdout)
        expect(parentMessages?.messages?.some((item) => item.content === 'x')).toBe(false)

        const archiveResult = await runCLI('discordbot', ['thread', 'archive', threadId])
        expect(archiveResult.exitCode).toBe(0)
        untrackThread(threadId)

        // Discord's archived-thread index is eventually consistent; active listing above is the stable proof.
        await waitForRateLimit(2000)
      } finally {
        await rm(filePath, { force: true })
      }
    }, 60000)
  })

  describe('channel', () => {
    it('channel list returns channels array', async () => {
      const result = await runCLI('discordbot', ['channel', 'list'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ channels: Array<{ id: string; name: string }> }>(result.stdout)
      expect(Array.isArray(data?.channels)).toBe(true)
      expect(data!.channels.length).toBeGreaterThan(0)
    })

    it('channel info returns channel details', async () => {
      const result = await runCLI('discordbot', ['channel', 'info', DISCORDBOT_TEST_CHANNEL_ID])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ id: string; name: string }>(result.stdout)
      expect(data?.id).toBe(DISCORDBOT_TEST_CHANNEL_ID)
      expect(data?.name).toBe(DISCORDBOT_TEST_CHANNEL)
    })
  })

  describe('user', () => {
    it('user list returns users array', async () => {
      const result = await runCLI('discordbot', ['user', 'list'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ users: Array<{ id: string; username: string }> }>(result.stdout)
      expect(Array.isArray(data?.users)).toBe(true)
      expect(data!.users.length).toBeGreaterThan(0)
    })

    it('user info returns user details', async () => {
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
    it('reaction add and remove lifecycle', async () => {
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

      const emptyListResult = await runCLI('discordbot', ['reaction', 'list', DISCORDBOT_TEST_CHANNEL_ID, sent!.id])
      expect(emptyListResult.exitCode).toBe(0)
      const emptyList = parseJSON<{ reactions: unknown[] }>(emptyListResult.stdout)
      expect(emptyList?.reactions).toEqual([])

      // when: add reaction
      const addResult = await runCLI('discordbot', ['reaction', 'add', DISCORDBOT_TEST_CHANNEL_ID, sent!.id, '👍'])
      expect(addResult.exitCode).toBe(0)

      const addData = parseJSON<{ success: boolean }>(addResult.stdout)
      expect(addData?.success).toBe(true)

      await waitForRateLimit(2000)

      const listResult = await runCLI('discordbot', ['reaction', 'list', DISCORDBOT_TEST_CHANNEL_ID, sent!.id])
      expect(listResult.exitCode).toBe(0)
      const listed = parseJSON<{
        reactions: Array<{ emoji: { name: string }; count: number; me: boolean }>
      }>(listResult.stdout)
      expect(listed?.reactions?.[0]?.emoji?.name).toBe('👍')
      expect(listed?.reactions?.[0]?.count).toBe(1)
      expect(listed?.reactions?.[0]?.me).toBe(true)

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
    }, 30000)
  })

  describe('server', () => {
    it('server list returns servers array', async () => {
      const result = await runCLI('discordbot', ['server', 'list'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ servers: Array<{ id: string; name: string }> }>(result.stdout)
      expect(Array.isArray(data?.servers)).toBe(true)
      expect(data!.servers.length).toBeGreaterThan(0)
    })

    it('server current returns current server', async () => {
      const result = await runCLI('discordbot', ['server', 'current'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ id: string; name: string }>(result.stdout)
      expect(data?.id).toBe(DISCORDBOT_TEST_SERVER_ID)
    })
  })
})
