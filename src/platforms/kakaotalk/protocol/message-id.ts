// Client-message IDs are time-derived, with a per-device suffix and collision
// handling. Keep a generator across reconnects; this is not a durable job ID.
export function createMessageIdGenerator(identity: string, clock: () => number = Date.now): () => number {
  let hash = 0
  for (let i = 0; i < identity.length; i++) hash = (Math.imul(31, hash) + identity.charCodeAt(i)) | 0
  const suffix = ((hash % 100) + 100) % 100
  const buckets = Math.floor((0x7fffffff - 99) / 100) + 1
  let previous = -1
  return () => {
    const base = Math.trunc((clock() % 0x7fffff9b) / 100)
    // Retain the unwrapped counter: wrapping the returned ID must not reset it.
    previous = Math.max(base, previous + 1)
    let id = (previous % buckets) * 100 + suffix
    if (id === 0) id = (++previous % buckets) * 100 + suffix
    return id
  }
}
