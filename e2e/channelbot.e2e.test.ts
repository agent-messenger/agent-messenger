import { afterEach, beforeAll, describe, expect, test } from 'bun:test'

import {
  CHANNELBOT_TEST_GROUP_ID,
  CHANNELBOT_TEST_GROUP_NAME,
  CHANNELBOT_TEST_WORKSPACE_ID,
  CHANNELBOT_TEST_WORKSPACE_NAME,
  validateChannelBotEnvironment,
} from './config'
import { generateTestId, parseJSON, runCLI, waitForRateLimit } from './helpers'

let channelbotAvailable = false

describe('ChannelBot E2E Tests', () => {
  beforeAll(async () => {
    if (!CHANNELBOT_TEST_WORKSPACE_ID || !CHANNELBOT_TEST_GROUP_ID) {
      console.warn(
        'Skipping ChannelBot E2E: set E2E_CHANNELBOT_WORKSPACE_ID and E2E_CHANNELBOT_GROUP_ID to run against a dedicated test workspace.',
      )
      return
    }
    await validateChannelBotEnvironment()
    channelbotAvailable = true
  })

  afterEach(async () => {
    await waitForRateLimit()
  })

  describe('auth', () => {
    test('auth status returns valid workspace info', async () => {
      if (!channelbotAvailable) return

      const result = await runCLI('channelbot', ['auth', 'status'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{
        valid: boolean
        workspace_id: string
        workspace_name: string
      }>(result.stdout)
      expect(data).not.toBeNull()
      expect(data?.valid).toBe(true)
      expect(data?.workspace_id).toBe(CHANNELBOT_TEST_WORKSPACE_ID)
      expect(data?.workspace_name).toBe(CHANNELBOT_TEST_WORKSPACE_NAME)
    })
  })

  describe('group', () => {
    test('group list returns groups array', async () => {
      if (!channelbotAvailable) return

      const result = await runCLI('channelbot', ['group', 'list', '--limit', '10'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ groups: Array<{ id: string; name: string }> }>(result.stdout)
      expect(Array.isArray(data?.groups)).toBe(true)
      expect(data!.groups.length).toBeGreaterThan(0)
    })

    test('group get by id returns the target group', async () => {
      if (!channelbotAvailable) return

      const result = await runCLI('channelbot', ['group', 'get', CHANNELBOT_TEST_GROUP_ID])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ id: string; name: string }>(result.stdout)
      expect(data?.id).toBe(CHANNELBOT_TEST_GROUP_ID)
      expect(data?.name).toBe(CHANNELBOT_TEST_GROUP_NAME)
    })

    test('group get by @name returns the target group', async () => {
      if (!channelbotAvailable) return

      const result = await runCLI('channelbot', ['group', 'get', `@${CHANNELBOT_TEST_GROUP_NAME}`])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ id: string; name: string }>(result.stdout)
      expect(data?.id).toBe(CHANNELBOT_TEST_GROUP_ID)
      expect(data?.name).toBe(CHANNELBOT_TEST_GROUP_NAME)
    })

    test('group messages returns messages array', async () => {
      if (!channelbotAvailable) return

      const result = await runCLI('channelbot', ['group', 'messages', CHANNELBOT_TEST_GROUP_ID, '--limit', '5'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ messages: Array<{ id: string }> }>(result.stdout)
      expect(Array.isArray(data?.messages)).toBe(true)
    })
  })

  describe('message', () => {
    test('message send creates a group message', async () => {
      if (!channelbotAvailable) return

      const testId = generateTestId()
      const result = await runCLI('channelbot', [
        'message',
        'send',
        `@${CHANNELBOT_TEST_GROUP_NAME}`,
        `e2e ${testId}`,
      ])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ id: string; plain_text: string; chat_type: string }>(result.stdout)
      expect(data?.id).toBeTruthy()
      expect(data?.chat_type).toBe('group')
      expect(data?.plain_text).toContain(testId)
    })

    test('message list returns messages array', async () => {
      if (!channelbotAvailable) return

      const result = await runCLI('channelbot', ['message', 'list', `@${CHANNELBOT_TEST_GROUP_NAME}`, '--limit', '5'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ messages: Array<{ id: string }> }>(result.stdout)
      expect(Array.isArray(data?.messages)).toBe(true)
    })

    test('message get retrieves a specific group message', async () => {
      if (!channelbotAvailable) return

      const testId = generateTestId()
      const sendResult = await runCLI('channelbot', [
        'message',
        'send',
        `@${CHANNELBOT_TEST_GROUP_NAME}`,
        `get ${testId}`,
      ])
      expect(sendResult.exitCode).toBe(0)

      const sent = parseJSON<{ id: string; plain_text: string }>(sendResult.stdout)
      expect(sent?.id).toBeTruthy()

      await waitForRateLimit()

      const result = await runCLI('channelbot', ['message', 'get', `@${CHANNELBOT_TEST_GROUP_NAME}`, sent!.id])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ id: string; plain_text: string }>(result.stdout)
      expect(data?.id).toBe(sent?.id)
      expect(data?.plain_text).toContain(testId)
    }, 30000)
  })

  describe('manager', () => {
    test('manager list returns managers array', async () => {
      if (!channelbotAvailable) return

      const result = await runCLI('channelbot', ['manager', 'list', '--limit', '10'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ managers: Array<{ id: string; name: string }> }>(result.stdout)
      expect(Array.isArray(data?.managers)).toBe(true)
      expect(data!.managers.length).toBeGreaterThan(0)
    })

    test('manager get returns manager details', async () => {
      if (!channelbotAvailable) return

      const listResult = await runCLI('channelbot', ['manager', 'list', '--limit', '1'])
      expect(listResult.exitCode).toBe(0)

      const listData = parseJSON<{ managers: Array<{ id: string; name: string }> }>(listResult.stdout)
      expect(listData?.managers?.[0]?.id).toBeTruthy()

      await waitForRateLimit()

      const result = await runCLI('channelbot', ['manager', 'get', listData!.managers[0].id])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ id: string; name: string }>(result.stdout)
      expect(data?.id).toBe(listData!.managers[0].id)
    })
  })

  describe('bot', () => {
    test('bot list returns bots array', async () => {
      if (!channelbotAvailable) return

      const result = await runCLI('channelbot', ['bot', 'list', '--limit', '10'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{ bots: Array<{ id: string; name: string }> }>(result.stdout)
      expect(Array.isArray(data?.bots)).toBe(true)
      expect(data!.bots.length).toBeGreaterThan(0)
    })
  })

  describe('snapshot', () => {
    test('snapshot returns workspace overview', async () => {
      if (!channelbotAvailable) return

      const result = await runCLI('channelbot', ['snapshot', '--limit', '2'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<{
        workspace: { id: string; name: string }
        groups: unknown[]
        managers: unknown[]
        bots: unknown[]
      }>(result.stdout)
      expect(data?.workspace?.id).toBe(CHANNELBOT_TEST_WORKSPACE_ID)
      expect(data?.workspace?.name).toBe(CHANNELBOT_TEST_WORKSPACE_NAME)
      expect(data?.groups).toBeDefined()
      expect(data?.managers).toBeDefined()
      expect(data?.bots).toBeDefined()
    }, 30000)
  })
})
