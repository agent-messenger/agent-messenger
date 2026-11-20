export interface E2EEKeyStore {
  get(key: string): Promise<unknown> | unknown
  set(key: string, value: string): Promise<void> | void
}

export interface E2EEKeyData {
  keyId: number | string
  privKey: string
  pubKey: string
  e2eeVersion?: number
}

export type E2EEPublicKey = { keyId?: number | string } | { 2?: unknown } | ReadonlyArray<unknown>

const SELF_KEY_PREFIX = 'e2eeKeys:'

function selfKey(id: number | string): string {
  return `${SELF_KEY_PREFIX}${id}`
}

function isE2EEKeyData(value: unknown): value is E2EEKeyData {
  if (!value || typeof value !== 'object') return false
  const data = value as Partial<E2EEKeyData>
  return typeof data.privKey === 'string' && typeof data.pubKey === 'string'
}

function parseKeyData(raw: unknown): E2EEKeyData | null {
  if (typeof raw !== 'string') return isE2EEKeyData(raw) ? raw : null
  try {
    const parsed: unknown = JSON.parse(raw)
    return isE2EEKeyData(parsed) ? parsed : null
  } catch {
    return null
  }
}

// The stored payload carries its own keyId. Requiring it to equal the slot it was
// read from rejects entries mislabeled under an advertised keyId, so only a payload
// genuinely belonging to that keyId is ever trusted.
function keyDataMatchesSlot(data: E2EEKeyData, keyId: number | string): boolean {
  return String(data.keyId) === String(keyId)
}

// getE2EEPublicKeys is requested unparsed, so each key normally arrives as a raw
// thrift struct keyed by field id ({ 1: version, 2: keyId, ... }), not as a named
// object. Mirror linejs's own `key.keyId ?? key[2]` so every shape resolves.
function keyIdOf(key: E2EEPublicKey): number | string | undefined {
  if (!key || typeof key !== 'object') return undefined
  const named = (key as { keyId?: unknown }).keyId
  const id = named ?? (key as Record<number, unknown>)[2]
  return typeof id === 'number' || typeof id === 'string' ? id : undefined
}

function advertisedKeyIds(keys: ReadonlyArray<E2EEPublicKey> | undefined): Array<number | string> {
  if (!keys) return []
  const ids: Array<number | string> = []
  for (const key of keys) {
    const id = keyIdOf(key)
    if (id !== undefined) ids.push(id)
  }
  return ids
}

// Ensures the account's own self-key is addressable by MID for getE2EESelfKeyData,
// which checks `e2eeKeys:<mid>` before falling back to a live Thrift channel. The
// keyId-addressed entry is only trusted when the server advertises that exact keyId
// for this account, so a contaminated store (another account's key copied in) can
// never promote a foreign private key to this MID. Returns true when a self-key
// becomes available under the MID.
export async function ensureSelfKeyForMid(
  storage: E2EEKeyStore,
  mid: string,
  advertisedKeys: ReadonlyArray<E2EEPublicKey> | undefined,
): Promise<boolean> {
  if (!mid) return false

  const existing = parseKeyData(await storage.get(selfKey(mid)))
  if (existing) return true

  for (const keyId of advertisedKeyIds(advertisedKeys)) {
    const candidate = parseKeyData(await storage.get(selfKey(keyId)))
    if (candidate && keyDataMatchesSlot(candidate, keyId)) {
      await storage.set(selfKey(mid), JSON.stringify(candidate))
      return true
    }
  }

  return false
}

// Copies only this account's E2EE key material out of a shared (default) store into
// an isolated per-account store. Trust is anchored to the server-advertised keyIds
// for `mid`, so foreign-account keys present in the shared store are never carried
// over. Used right after a fresh login resolves the account MID.
export async function migrateOwnE2EEKeys(
  source: E2EEKeyStore,
  target: E2EEKeyStore,
  mid: string,
  advertisedKeys: ReadonlyArray<E2EEPublicKey> | undefined,
): Promise<number> {
  if (!mid) return 0

  let migrated = 0
  const own = parseKeyData(await source.get(selfKey(mid)))
  if (own) {
    await target.set(selfKey(mid), JSON.stringify(own))
    migrated++
  }

  for (const keyId of advertisedKeyIds(advertisedKeys)) {
    const data = parseKeyData(await source.get(selfKey(keyId)))
    if (!data || !keyDataMatchesSlot(data, keyId)) continue
    await target.set(selfKey(keyId), JSON.stringify(data))
    migrated++
    const publicKey = await source.get(`e2eePublicKeys:${keyId}`)
    if (typeof publicKey === 'string') await target.set(`e2eePublicKeys:${keyId}`, publicKey)
  }

  return migrated
}
