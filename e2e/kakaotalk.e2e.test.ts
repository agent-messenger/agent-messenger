import { afterEach, beforeAll, describe, expect, test } from 'bun:test'

import { KAKAOTALK_TEST_CHAT_ID, validateKakaoTalkEnvironment } from './config'
import { generateTestId, parseJSON, runCLI, waitForRateLimit } from './helpers'

let kakaotalkAvailable = false

describe('KakaoTalk E2E Tests', () => {
  beforeAll(async () => {
    kakaotalkAvailable = await validateKakaoTalkEnvironment()
  })

  afterEach(async () => {
    await waitForRateLimit()
  })

  describe('auth', () => {
    test('auth status returns valid auth info', async () => {
      if (!kakaotalkAvailable) return

      const result = await runCLI('kakaotalk', ['auth', 'status'])
      expect(result.exitCode).toBe(0)
    })

    test('auth list returns accounts array', async () => {
      if (!kakaotalkAvailable) return

      const result = await runCLI('kakaotalk', ['auth', 'list'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<unknown[]>(result.stdout)
      expect(Array.isArray(data)).toBe(true)
    })
  })

  describe('chat', () => {
    test('chat list returns chats', async () => {
      if (!kakaotalkAvailable) return

      const result = await runCLI('kakaotalk', ['chat', 'list'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<unknown>(result.stdout)
      expect(data).toBeDefined()
    })

    test('chat list with search filter returns chats', async () => {
      if (!kakaotalkAvailable) return

      const result = await runCLI('kakaotalk', ['chat', 'list', '--search', 'test'])
      expect(result.exitCode).toBe(0)
    })
  })

  describe('message', () => {
    test('message send sends a message to the test chat', async () => {
      if (!kakaotalkAvailable) return

      const testId = generateTestId()
      const result = await runCLI('kakaotalk', ['message', 'send', KAKAOTALK_TEST_CHAT_ID, `e2e ${testId}`])
      expect(result.exitCode).toBe(0)
    })

    test('message list returns messages from the test chat', async () => {
      if (!kakaotalkAvailable) return

      const result = await runCLI('kakaotalk', ['message', 'list', KAKAOTALK_TEST_CHAT_ID, '-n', '5'])
      expect(result.exitCode).toBe(0)

      const data = parseJSON<unknown>(result.stdout)
      expect(data).toBeDefined()
    })
  })
})
