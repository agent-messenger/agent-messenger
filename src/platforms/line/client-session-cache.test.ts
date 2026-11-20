import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { CONFIG_DIR_ENV_VAR } from '@/shared/utils/config-dir'

import { LineClient } from './client'
import { readCache, writeCache } from './session-cache'
import type { LineAccountCredentials } from './types'

const MID = 'uSelf'
const CREDS: LineAccountCredentials = {
  account_id: MID,
  auth_token: 'auth-token',
  device: 'ANDROIDSECONDARY',
  created_at: '2023-11-14T22:13:20.000Z',
  updated_at: '2023-11-14T22:13:20.000Z',
}
const SELF_KEY = JSON.stringify({ keyId: 1, privKey: 'priv', pubKey: 'pub', e2eeVersion: 1 })

let configDir: string
const originalConfigDir = process.env[CONFIG_DIR_ENV_VAR]
const originalFetch = globalThis.fetch
let fetchCalls: string[]

function writeAccountStorage(entries: Record<string, string>) {
  const dir = join(configDir, 'line-storage')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${MID}.json`), JSON.stringify(entries))
}

function memStore(initial: Record<string, unknown> = {}) {
  const data: Record<string, unknown> = { ...initial }
  return {
    data,
    get: async (k: string) => data[k],
    set: async (k: string, v: unknown) => void (data[k] = v),
    delete: async (k: string) => void delete data[k],
    getAll: async () => ({ ...data }),
  }
}

beforeEach(() => {
  configDir = mkdtempSync(join(tmpdir(), 'line-cache-'))
  process.env[CONFIG_DIR_ENV_VAR] = configDir
  fetchCalls = []
  globalThis.fetch = mock(async (url: string | URL | Request) => {
    fetchCalls.push(String(url))
    throw new Error('network disabled in test')
  }) as unknown as typeof fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalConfigDir === undefined) delete process.env[CONFIG_DIR_ENV_VAR]
  else process.env[CONFIG_DIR_ENV_VAR] = originalConfigDir
  rmSync(configDir, { recursive: true, force: true })
})

describe('login() with a cached session', () => {
  it('restores the session from the cached profile without any network call', async () => {
    // given: a profile cached within the TTL and the self E2EE key already stored
    const entry = JSON.stringify({ value: { mid: MID, displayName: 'Me' }, cached_at: Date.now() })
    writeAccountStorage({ 'cache:profile': entry, [`e2eeKeys:${MID}`]: SELF_KEY })

    // when
    const client = await new LineClient().login(CREDS)

    // then: neither getProfile nor getE2EEPublicKeys hit the network
    expect(fetchCalls).toEqual([])
    const base = (client as any).client.base
    expect(base.profile.mid).toBe(MID)
    expect(base.authToken).toBe('auth-token')
  })

  it('does not reuse a cached profile that belongs to another account', async () => {
    const entry = JSON.stringify({ value: { mid: 'uOther' }, cached_at: Date.now() })
    writeAccountStorage({ 'cache:profile': entry, [`e2eeKeys:${MID}`]: SELF_KEY })

    // falls back to a real token login, which needs the network
    await expect(new LineClient().login(CREDS)).rejects.toMatchObject({ code: 'login_failed' })
    expect(fetchCalls.length).toBeGreaterThan(0)
  })

  it('does not reuse an expired cached profile', async () => {
    const entry = JSON.stringify({ value: { mid: MID }, cached_at: Date.now() - 2 * 60 * 60 * 1000 })
    writeAccountStorage({ 'cache:profile': entry, [`e2eeKeys:${MID}`]: SELF_KEY })

    await expect(new LineClient().login(CREDS)).rejects.toMatchObject({ code: 'login_failed' })
    expect(fetchCalls.length).toBeGreaterThan(0)
  })
})

describe('repairSelfE2EEKey()', () => {
  it('skips getE2EEPublicKeys when the MID-addressed key already exists', async () => {
    const getE2EEPublicKeys = mock(async () => [])
    const client = new LineClient()
    const fake = { base: { storage: memStore({ [`e2eeKeys:${MID}`]: SELF_KEY }), talk: { getE2EEPublicKeys } } }

    await (client as any).repairSelfE2EEKey(fake, MID)

    expect(getE2EEPublicKeys).not.toHaveBeenCalled()
  })

  it('still asks the server when the key is missing', async () => {
    const getE2EEPublicKeys = mock(async () => [])
    const client = new LineClient()
    const fake = { base: { storage: memStore(), talk: { getE2EEPublicKeys } } }

    await (client as any).repairSelfE2EEKey(fake, MID)

    expect(getE2EEPublicKeys).toHaveBeenCalledTimes(1)
  })
})

describe('channel token cache', () => {
  function sessionWith(storage: ReturnType<typeof memStore>, respond: (headers: Record<string, string>) => Response) {
    const approve = mock(async ({ channelId }: { channelId: string }) => ({
      channelAccessToken: `fresh-${channelId}`,
    }))
    const seenTokens: string[] = []
    const client = new LineClient()
    ;(client as any).client = {
      base: {
        storage,
        authToken: 'auth-token',
        profile: { mid: MID },
        request: { endpoint: 'legy.line-apps.com', userAgent: 'ua', systemType: 'sys', getHeader: () => ({}) },
        channel: { approveChannelAndIssueChannelToken: approve },
        fetch: mock(async (_url: string, init: { headers: Record<string, string> }) => {
          seenTokens.push(init.headers['x-line-channeltoken'])
          return respond(init.headers)
        }),
      },
    }
    return { client, approve, seenTokens }
  }

  const ok = () => new Response(JSON.stringify({ code: 0, result: { items: [] } }))

  it('issues the timeline token once and reuses it from disk in the next session', async () => {
    const storage = memStore()

    const first = sessionWith(storage, ok)
    await first.client.getAlbums('cRoom')
    const second = sessionWith(storage, ok)
    await second.client.getAlbums('cRoom')

    expect(first.approve).toHaveBeenCalledTimes(1)
    expect(second.approve).not.toHaveBeenCalled()
    expect(second.seenTokens).toEqual(['fresh-1341209850'])
  })

  it('re-issues once and retries when a cached timeline token is rejected', async () => {
    const storage = memStore()
    await writeCache(storage, 'cache:channelToken:1341209850', 'stale-token')
    const { client, approve, seenTokens } = sessionWith(storage, (headers) =>
      headers['x-line-channeltoken'] === 'stale-token'
        ? new Response(JSON.stringify({ code: 401, message: 'invalid token' }))
        : ok(),
    )

    const albums = await client.getAlbums('cRoom')

    expect(albums).toEqual([])
    expect(seenTokens).toEqual(['stale-token', 'fresh-1341209850'])
    expect(approve).toHaveBeenCalledTimes(1)
    expect(await readCache(storage, 'cache:channelToken:1341209850')).toBe('fresh-1341209850')
  })

  it('does not retry when a freshly issued token is rejected', async () => {
    const { client, approve } = sessionWith(
      memStore(),
      () => new Response(JSON.stringify({ code: 500, message: 'error' })),
    )

    await expect(client.getAlbums('cRoom')).rejects.toMatchObject({ code: 'timeline_request_failed' })
    expect(approve).toHaveBeenCalledTimes(1)
  })

  it('re-issues the album token once when a cached one gets HTTP 401', async () => {
    const storage = memStore()
    await writeCache(storage, 'cache:channelToken:1375220249', 'stale-album')
    const { client, seenTokens } = sessionWith(storage, (headers) =>
      headers['x-line-channeltoken'] === 'stale-album'
        ? new Response('', { status: 401 })
        : new Response(new Uint8Array([1]), { headers: { 'content-type': 'image/jpeg' } }),
    )

    const photo = await client.downloadAlbumPhoto('cRoom', 'a1', 'obj.1')

    expect(seenTokens).toEqual(['stale-album', 'fresh-1375220249'])
    expect(photo.contentType).toBe('image/jpeg')
  })
})
