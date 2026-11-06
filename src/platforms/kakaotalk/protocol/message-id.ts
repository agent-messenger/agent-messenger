// Client-message IDs are time-derived, with a per-device suffix and collision
// handling. Keep a generator across reconnects; this is not a durable job ID.
export function createMessageIdGenerator(identity: string, clock: () => number = Date.now): () => number {
  let hash = 0
  for (let i = 0; i < identity.length; i++) hash = (Math.imul(31, hash) + identity.charCodeAt(i)) | 0
  const suffix = hash % 100
  const fold = (value: number): number => Math.trunc((value % 0x7fffff9b) / 100) * 100 + suffix
  let lastClock = 0
  let previous = fold(clock())
  let previousBase = previous
  return () => {
    lastClock = Math.max(clock(), lastClock + 1)
    const base = fold(lastClock)
    let id = base
    if (base <= previous && base >= previousBase) {
      id = previous + 100
      if (id > 0x7fffffff) id = fold(id)
    }
    previous = id
    previousBase = base
    return id
  }
}
