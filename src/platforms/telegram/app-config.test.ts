import { beforeEach, describe, expect, test } from 'bun:test'
import { getTelegramAppCredentials } from './app-config'

const ENV_KEYS = [
  'AGENT_TELEGRAM_API_ID',
  'AGENT_TELEGRAM_API_HASH',
  'AGENT_MESSENGER_TELEGRAM_API_ID',
  'AGENT_MESSENGER_TELEGRAM_API_HASH',
] as const

describe('telegram app config', () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) {
      delete process.env[key]
    }
  })

  test('returns env credentials when provided', () => {
    process.env.AGENT_TELEGRAM_API_ID = '12345'
    process.env.AGENT_TELEGRAM_API_HASH = 'secret'

    expect(getTelegramAppCredentials()).toEqual({
      api_id: 12345,
      api_hash: 'secret',
      source: 'env',
    })
  })

  test('returns none when nothing is configured', () => {
    expect(getTelegramAppCredentials()).toEqual({ source: 'none' })
  })
})
