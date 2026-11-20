import { describe, expect, it } from 'bun:test'

import { ensureSelfKeyForMid, migrateOwnE2EEKeys } from './e2ee-storage'

function memStore(initial: Record<string, string> = {}) {
  const data: Record<string, string> = { ...initial }
  return {
    data,
    async get(key: string) {
      return data[key]
    },
    async set(key: string, value: string) {
      data[key] = value
    },
    async getAll() {
      return { ...data }
    },
  }
}

const SELF_A = { keyId: 100, privKey: 'privA', pubKey: 'pubA', e2eeVersion: 2 }
const SELF_B = { keyId: 200, privKey: 'privB', pubKey: 'pubB', e2eeVersion: 2 }

describe('ensureSelfKeyForMid', () => {
  it('keeps an existing MID-addressed self-key', async () => {
    const store = memStore({ 'e2eeKeys:midA': JSON.stringify(SELF_A) })

    const ok = await ensureSelfKeyForMid(store, 'midA', [{ keyId: 100 }])

    expect(ok).toBe(true)
    expect(JSON.parse(store.data['e2eeKeys:midA'])).toMatchObject({ privKey: 'privA' })
  })

  it('promotes a keyId-addressed self-key when the server advertises that keyId', async () => {
    const store = memStore({ 'e2eeKeys:100': JSON.stringify(SELF_A) })

    const ok = await ensureSelfKeyForMid(store, 'midA', [{ keyId: 100 }])

    expect(ok).toBe(true)
    expect(JSON.parse(store.data['e2eeKeys:midA'])).toMatchObject({ privKey: 'privA' })
  })

  it('supports the array-shaped public key (keyId at index 2)', async () => {
    const store = memStore({ 'e2eeKeys:100': JSON.stringify(SELF_A) })

    const ok = await ensureSelfKeyForMid(store, 'midA', [[undefined, undefined, 100] as never])

    expect(ok).toBe(true)
  })

  it('supports the unparsed thrift struct shape (keyId under field id 2)', async () => {
    // given: getE2EEPublicKeys is requested unparsed, so each E2EEPublicKey arrives
    // as a plain object keyed by thrift field id: { 1: version, 2: keyId, 4: keyData, 5: createdTime }
    const store = memStore({ 'e2eeKeys:100': JSON.stringify(SELF_A) })

    const ok = await ensureSelfKeyForMid(store, 'midA', [{ 1: 1, 2: 100, 4: 'keyData', 5: 0n } as never])

    expect(ok).toBe(true)
    expect(JSON.parse(store.data['e2eeKeys:midA'])).toMatchObject({ privKey: 'privA' })
  })

  it('never promotes a foreign-MID-addressed key (no advertised match)', async () => {
    // given: storage contaminated with another account's self-key under its MID
    const store = memStore({ 'e2eeKeys:midB': JSON.stringify(SELF_B) })

    // when: account A has no advertised keyId matching any stored key
    const ok = await ensureSelfKeyForMid(store, 'midA', [{ keyId: 999 }])

    // then: A's MID key is not created from B's material
    expect(ok).toBe(false)
    expect(store.data['e2eeKeys:midA']).toBeUndefined()
  })

  it('never promotes a keyId key the server did not advertise for this account', async () => {
    const store = memStore({ 'e2eeKeys:200': JSON.stringify(SELF_B) })

    const ok = await ensureSelfKeyForMid(store, 'midA', [{ keyId: 100 }])

    expect(ok).toBe(false)
    expect(store.data['e2eeKeys:midA']).toBeUndefined()
  })

  it('rejects a payload whose own keyId does not match the advertised slot', async () => {
    // given: the slot e2eeKeys:100 holds a payload that claims keyId 999
    const mislabeled = { keyId: 999, privKey: 'privX', pubKey: 'pubX', e2eeVersion: 2 }
    const store = memStore({ 'e2eeKeys:100': JSON.stringify(mislabeled) })

    const ok = await ensureSelfKeyForMid(store, 'midA', [{ keyId: 100 }])

    expect(ok).toBe(false)
    expect(store.data['e2eeKeys:midA']).toBeUndefined()
  })

  it('returns false when no keys exist', async () => {
    const store = memStore()
    expect(await ensureSelfKeyForMid(store, 'midA', [{ keyId: 100 }])).toBe(false)
  })

  it('returns false for an empty mid', async () => {
    const store = memStore({ 'e2eeKeys:100': JSON.stringify(SELF_A) })
    expect(await ensureSelfKeyForMid(store, '', [{ keyId: 100 }])).toBe(false)
  })
})

describe('migrateOwnE2EEKeys', () => {
  it('copies only the advertised keyId material into the target', async () => {
    const source = memStore({
      'e2eeKeys:100': JSON.stringify(SELF_A),
      'e2eePublicKeys:100': 'pubkey-blob-A',
      'e2eeKeys:200': JSON.stringify(SELF_B),
      'e2eePublicKeys:200': 'pubkey-blob-B',
    })
    const target = memStore()

    const count = await migrateOwnE2EEKeys(source, target, 'midA', [{ keyId: 100 }])

    expect(count).toBe(1)
    expect(JSON.parse(target.data['e2eeKeys:100'])).toMatchObject({ privKey: 'privA' })
    expect(target.data['e2eePublicKeys:100']).toBe('pubkey-blob-A')
    // foreign account B keys must not leak across
    expect(target.data['e2eeKeys:200']).toBeUndefined()
    expect(target.data['e2eePublicKeys:200']).toBeUndefined()
  })

  it('migrates own keys when the server returns unparsed thrift structs', async () => {
    // given: a fresh QR login stored the self-key under its keyId in the shared store,
    // and getE2EEPublicKeys returns { 2: keyId } structs (the real wire shape)
    const source = memStore({
      'e2eeKeys:100': JSON.stringify(SELF_A),
      'e2eeKeys:200': JSON.stringify(SELF_B),
    })
    const target = memStore()

    const count = await migrateOwnE2EEKeys(source, target, 'midA', [{ 1: 1, 2: 100, 4: 'keyData', 5: 0n } as never])

    expect(count).toBe(1)
    expect(JSON.parse(target.data['e2eeKeys:100'])).toMatchObject({ privKey: 'privA' })
    expect(target.data['e2eeKeys:200']).toBeUndefined()
  })

  it('copies the MID-addressed self-key when present', async () => {
    const source = memStore({ 'e2eeKeys:midA': JSON.stringify(SELF_A) })
    const target = memStore()

    const count = await migrateOwnE2EEKeys(source, target, 'midA', [])

    expect(count).toBe(1)
    expect(JSON.parse(target.data['e2eeKeys:midA'])).toMatchObject({ privKey: 'privA' })
  })

  it('migrates nothing when only foreign keys are present', async () => {
    const source = memStore({ 'e2eeKeys:midB': JSON.stringify(SELF_B), 'e2eeKeys:200': JSON.stringify(SELF_B) })
    const target = memStore()

    const count = await migrateOwnE2EEKeys(source, target, 'midA', [{ keyId: 100 }])

    expect(count).toBe(0)
    expect(Object.keys(target.data)).toHaveLength(0)
  })

  it('skips a payload whose own keyId does not match the advertised slot', async () => {
    const mislabeled = { keyId: 999, privKey: 'privX', pubKey: 'pubX', e2eeVersion: 2 }
    const source = memStore({ 'e2eeKeys:100': JSON.stringify(mislabeled), 'e2eePublicKeys:100': 'blob' })
    const target = memStore()

    const count = await migrateOwnE2EEKeys(source, target, 'midA', [{ keyId: 100 }])

    expect(count).toBe(0)
    expect(target.data['e2eeKeys:100']).toBeUndefined()
    expect(target.data['e2eePublicKeys:100']).toBeUndefined()
  })

  it('ignores malformed key entries', async () => {
    const source = memStore({ 'e2eeKeys:100': 'not-json', 'e2eeKeys:midA': '{"keyId":1}' })
    const target = memStore()

    const count = await migrateOwnE2EEKeys(source, target, 'midA', [{ keyId: 100 }])

    expect(count).toBe(0)
  })
})
