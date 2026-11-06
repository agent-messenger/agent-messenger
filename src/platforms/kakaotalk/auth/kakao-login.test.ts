import { afterEach, expect, it } from 'bun:test'

import { generateDeviceUuid, loginFlow } from './kakao-login'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

it('derives a new device identifier from UUID and time using the observed SHA-256 vector', () => {
  expect(generateDeviceUuid('00000000-0000-4000-8000-000000000001', 1_700_000_000_000)).toBe(
    'defb48753f557c8e101cc476e9c39e354b86ca6295a55125118261e47ab7c89b',
  )
  expect(generateDeviceUuid()).toMatch(/^[0-9a-f]{64}$/)
})

it('reuses an already registered identifier without rehashing it', async () => {
  let used: string | null = null
  globalThis.fetch = (async (_url, options) => {
    used = new URLSearchParams(String(options?.body)).get('device_uuid')
    return new Response(JSON.stringify({ status: 0, access_token: 'fixture-token', userId: 7 }))
  }) as typeof fetch
  const result = await loginFlow({
    email: 'fixture@example.invalid',
    password: 'fixture',
    savedDeviceUuid: 'registered-fixture',
  })
  expect(result.authenticated).toBe(true)
  expect(used).toBe('registered-fixture')
})
