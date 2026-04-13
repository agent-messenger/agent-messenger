import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { getWebexAppCredentials } from './app-config'

const ENV_KEYS = [
  'AGENT_WEBEX_CLIENT_ID',
  'AGENT_WEBEX_CLIENT_SECRET',
  'AGENT_MESSENGER_WEBEX_CLIENT_ID',
  'AGENT_MESSENGER_WEBEX_CLIENT_SECRET',
] as const

describe('webex app config', () => {
  let savedEnv: Record<string, string | undefined> = {}

  beforeEach(() => {
    savedEnv = {}
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key]
      delete process.env[key]
    }
  })

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = savedEnv[key]
      }
    }
  })

  test('returns env credentials when primary env vars are set', () => {
    process.env.AGENT_WEBEX_CLIENT_ID = 'my-client-id'
    process.env.AGENT_WEBEX_CLIENT_SECRET = 'my-client-secret'

    expect(getWebexAppCredentials()).toEqual({
      clientId: 'my-client-id',
      clientSecret: 'my-client-secret',
      source: 'env',
    })
  })

  test('returns env credentials when legacy env vars are set', () => {
    process.env.AGENT_MESSENGER_WEBEX_CLIENT_ID = 'legacy-client-id'
    process.env.AGENT_MESSENGER_WEBEX_CLIENT_SECRET = 'legacy-client-secret'

    expect(getWebexAppCredentials()).toEqual({
      clientId: 'legacy-client-id',
      clientSecret: 'legacy-client-secret',
      source: 'env',
    })
  })

  test('returns builtin credentials when nothing is configured', () => {
    const result = getWebexAppCredentials()
    expect(result.source).toBe('builtin')
    expect(result.clientId).toBeTruthy()
    expect(result.clientSecret).toBeTruthy()
  })

  test('returns builtin when only clientId is set', () => {
    process.env.AGENT_WEBEX_CLIENT_ID = 'my-client-id'

    const result = getWebexAppCredentials()
    expect(result.source).toBe('builtin')
  })

  test('returns builtin when only clientSecret is set', () => {
    process.env.AGENT_WEBEX_CLIENT_SECRET = 'my-client-secret'

    const result = getWebexAppCredentials()
    expect(result.source).toBe('builtin')
  })

  test('trims whitespace from clientId and clientSecret', () => {
    process.env.AGENT_WEBEX_CLIENT_ID = '  my-client-id  '
    process.env.AGENT_WEBEX_CLIENT_SECRET = '  my-client-secret  '

    expect(getWebexAppCredentials()).toEqual({
      clientId: 'my-client-id',
      clientSecret: 'my-client-secret',
      source: 'env',
    })
  })

  test('primary env takes precedence over legacy env', () => {
    process.env.AGENT_WEBEX_CLIENT_ID = 'primary-id'
    process.env.AGENT_WEBEX_CLIENT_SECRET = 'primary-secret'
    process.env.AGENT_MESSENGER_WEBEX_CLIENT_ID = 'legacy-id'
    process.env.AGENT_MESSENGER_WEBEX_CLIENT_SECRET = 'legacy-secret'

    expect(getWebexAppCredentials()).toEqual({
      clientId: 'primary-id',
      clientSecret: 'primary-secret',
      source: 'env',
    })
  })
})
