import { afterEach, describe, expect, it } from 'bun:test'

import { cacheTtlMs, clearSessionCache, readCache, writeCache } from './session-cache'

function memStore(initial: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = { ...initial }
  return {
    data,
    async get(key: string) {
      return data[key]
    },
    async set(key: string, value: unknown) {
      data[key] = value
    },
    async delete(key: string) {
      delete data[key]
    },
    async getAll() {
      return { ...data }
    },
  }
}

const HOUR = 60 * 60 * 1000
const originalTtl = process.env.AGENT_LINE_CACHE_TTL_SECONDS

afterEach(() => {
  if (originalTtl === undefined) delete process.env.AGENT_LINE_CACHE_TTL_SECONDS
  else process.env.AGENT_LINE_CACHE_TTL_SECONDS = originalTtl
})

describe('session cache', () => {
  it('returns a value written less than the TTL ago', async () => {
    const store = memStore()
    await writeCache(store, 'cache:profile', { mid: 'u1' }, 1_000)

    expect(await readCache(store, 'cache:profile', 1_000 + HOUR - 1)).toEqual({ mid: 'u1' })
  })

  it('treats a value as missing once the TTL has passed', async () => {
    const store = memStore()
    await writeCache(store, 'cache:profile', { mid: 'u1' }, 1_000)

    expect(await readCache(store, 'cache:profile', 1_000 + HOUR)).toBeUndefined()
  })

  it('honours an earlier explicit expiry', async () => {
    const store = memStore()
    await writeCache(store, 'cache:channelToken:1', 'tok', 1_000, { expiresAt: 5_000 })

    expect(await readCache(store, 'cache:channelToken:1', 4_999)).toBe('tok')
    expect(await readCache(store, 'cache:channelToken:1', 5_000)).toBeUndefined()
  })

  it('ignores malformed entries', async () => {
    const store = memStore({ 'cache:profile': 'not-json', 'cache:other': JSON.stringify({ value: 1 }) })

    expect(await readCache(store, 'cache:profile')).toBeUndefined()
    expect(await readCache(store, 'cache:other')).toBeUndefined()
  })

  it('can be disabled with AGENT_LINE_CACHE_TTL_SECONDS=0', async () => {
    process.env.AGENT_LINE_CACHE_TTL_SECONDS = '0'
    const store = memStore()
    await writeCache(store, 'cache:profile', { mid: 'u1' }, 1_000)

    expect(cacheTtlMs()).toBe(0)
    expect(await readCache(store, 'cache:profile', 1_000)).toBeUndefined()
  })

  it('reads the TTL from AGENT_LINE_CACHE_TTL_SECONDS', () => {
    process.env.AGENT_LINE_CACHE_TTL_SECONDS = '600'
    expect(cacheTtlMs()).toBe(600_000)
    process.env.AGENT_LINE_CACHE_TTL_SECONDS = 'garbage'
    expect(cacheTtlMs()).toBe(HOUR)
  })

  it('clearSessionCache removes only cache:* keys', async () => {
    const store = memStore({ 'cache:profile': '{}', 'cache:channelToken:1': '{}', 'e2eeKeys:u1': '{}' })

    await clearSessionCache(store)

    expect(Object.keys(store.data)).toEqual(['e2eeKeys:u1'])
  })
})
