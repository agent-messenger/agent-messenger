// Short-lived cache for per-session lookups (own profile, channel tokens) kept in the
// account's storage file. Every CLI command opens a fresh session; without this, each
// one re-fetches the same profile and re-issues the same channel tokens, which adds
// avoidable traffic on a real user account.

export interface CacheStore {
  get(key: string): Promise<unknown> | unknown
  set(key: string, value: string): Promise<void> | void
  delete?(key: string): Promise<void> | void
  getAll?(): Promise<Record<string, unknown>> | Record<string, unknown>
}

interface CacheEntry<T> {
  value: T
  cached_at: number
  expires_at?: number
}

const DEFAULT_TTL_SECONDS = 60 * 60
const CACHE_PREFIX = 'cache:'

// AGENT_LINE_CACHE_TTL_SECONDS overrides the default of one hour; 0 disables caching.
export function cacheTtlMs(): number {
  const raw = process.env.AGENT_LINE_CACHE_TTL_SECONDS
  if (raw === undefined || raw.trim() === '') return DEFAULT_TTL_SECONDS * 1000
  const seconds = Number(raw)
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : DEFAULT_TTL_SECONDS * 1000
}

export async function readCache<T>(store: CacheStore, key: string, now = Date.now()): Promise<T | undefined> {
  const ttl = cacheTtlMs()
  if (ttl === 0) return undefined

  const raw = await store.get(key)
  if (typeof raw !== 'string') return undefined
  let entry: Partial<CacheEntry<T>>
  try {
    entry = JSON.parse(raw)
  } catch {
    return undefined
  }
  if (typeof entry.cached_at !== 'number' || entry.value === undefined) return undefined
  if (now - entry.cached_at >= ttl) return undefined
  if (typeof entry.expires_at === 'number' && now >= entry.expires_at) return undefined
  return entry.value
}

export async function writeCache<T>(
  store: CacheStore,
  key: string,
  value: T,
  now = Date.now(),
  options?: { expiresAt?: number },
): Promise<void> {
  const entry: CacheEntry<T> = { value, cached_at: now, ...(options?.expiresAt && { expires_at: options.expiresAt }) }
  await store.set(key, JSON.stringify(entry))
}

export async function deleteCache(store: CacheStore, key: string): Promise<void> {
  await store.delete?.(key)
}

// Drops every cached session value, e.g. after a new login replaced the auth token.
export async function clearSessionCache(store: CacheStore): Promise<void> {
  if (!store.getAll || !store.delete) return
  const all = await store.getAll()
  for (const key of Object.keys(all)) {
    if (key.startsWith(CACHE_PREFIX)) await store.delete(key)
  }
}
